import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"
import type { AiDeploymentSessionActor } from "@/modules/deploy/ai-deployment-session.service"
import {
  checkGitAccess,
  GitHubProviderAdapter,
  GitLabProviderAdapter,
  GitProviderRegistry,
  parseGithubUrl,
  parseGitLabUrl,
  resolveGitProvider,
} from "./index"

const mockActor: AiDeploymentSessionActor = {
  userId: "user-123",
  organizationId: "org-456",
  role: "admin",
}

describe("GitHubProviderAdapter", () => {
  describe("parseGithubUrl and matches", () => {
    const adapter = new GitHubProviderAdapter()

    it("matches standard HTTPS github URLs", () => {
      expect(adapter.matches("https://github.com/octocat/Hello-World")).toBe(
        true
      )
      expect(
        adapter.matches("https://github.com/octocat/Hello-World.git")
      ).toBe(true)
      expect(adapter.matches("https://github.com/octocat/Hello-World/")).toBe(
        true
      )
    })

    it("matches HTTP and schemeless github URLs", () => {
      expect(adapter.matches("http://github.com/octocat/Hello-World")).toBe(
        true
      )
      expect(adapter.matches("github.com/octocat/Hello-World")).toBe(true)
    })

    it("matches SSH github URLs", () => {
      expect(adapter.matches("git@github.com:octocat/Hello-World.git")).toBe(
        true
      )
      expect(adapter.matches("git@github.com:octocat/Hello-World")).toBe(true)
    })

    it("extracts owner and repo correctly", () => {
      const parsed = parseGithubUrl("https://github.com/facebook/react.git")
      expect(parsed).toEqual({ owner: "facebook", repo: "react" })
    })

    it("rejects non-github URLs", () => {
      expect(adapter.matches("https://gitlab.com/octocat/Hello-World")).toBe(
        false
      )
      expect(adapter.matches("https://example.com/octocat/Hello-World")).toBe(
        false
      )
      expect(adapter.matches("invalid-url")).toBe(false)
      expect(adapter.matches("")).toBe(false)
    })
  })

  describe("checkAccess", () => {
    it("returns accessible for public repositories", async () => {
      const mockFetch = mock(async () => {
        return new Response(
          JSON.stringify({
            private: false,
            default_branch: "main",
          }),
          { status: 200 }
        )
      })

      const adapter = new GitHubProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      const result = await adapter.checkAccess(
        "https://github.com/octocat/Hello-World"
      )
      expect(result).toEqual({
        accessible: true,
        provider: "github",
        isPrivate: false,
        defaultBranch: "main",
      })
    })

    it("returns requiresAuth when public request returns 404 and actor has no installation token", async () => {
      const mockFetch = mock(async () => {
        return new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
        })
      })

      const mockDb = {
        githubRepositoryConnection: {
          findFirst: mock(async () => null),
        },
        githubInstallation: {
          findFirst: mock(async () => null),
        },
      } as unknown as PrismaClient

      const adapter = new GitHubProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
        db: mockDb,
      })

      const result = await adapter.checkAccess(
        "https://github.com/octocat/private-repo",
        mockActor
      )
      expect(result.accessible).toBe(false)
      expect(result.requiresAuth).toBe(true)
      expect(result.isPrivate).toBe(true)
      expect(result.provider).toBe("github")
    })

    it("authenticates private repository using tenant installation token", async () => {
      const mockDb = {
        githubRepositoryConnection: {
          findFirst: mock(async () => ({
            installation: {
              githubInstallationId: 9999n,
            },
          })),
        },
      } as unknown as PrismaClient

      const mockFetch = mock(async (_url: unknown, options?: RequestInit) => {
        const headers = options?.headers as Record<string, string>
        if (headers?.Authorization === "Bearer test-install-token") {
          return new Response(
            JSON.stringify({
              private: true,
              default_branch: "master",
            }),
            { status: 200 }
          )
        }
        return new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
        })
      })

      const adapter = new GitHubProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
        db: mockDb,
        getInstallationToken: mock(async () => "test-install-token"),
      })

      const result = await adapter.checkAccess(
        "https://github.com/octocat/private-repo",
        mockActor
      )
      expect(result).toEqual({
        accessible: true,
        provider: "github",
        isPrivate: true,
        defaultBranch: "master",
      })
    })

    it("handles 401 unauthorized gracefully", async () => {
      const mockFetch = mock(async () => {
        return new Response(JSON.stringify({ message: "Bad credentials" }), {
          status: 401,
        })
      })

      const adapter = new GitHubProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      const result = await adapter.checkAccess(
        "https://github.com/octocat/repo"
      )
      expect(result.accessible).toBe(false)
      expect(result.requiresAuth).toBe(true)
      expect(result.provider).toBe("github")
    })

    it("handles 403 rate limit error", async () => {
      const mockFetch = mock(async () => {
        return new Response(JSON.stringify({ message: "API rate limit" }), {
          status: 403,
        })
      })

      const adapter = new GitHubProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      const result = await adapter.checkAccess(
        "https://github.com/octocat/repo"
      )
      expect(result.accessible).toBe(false)
      expect(result.reason).toContain("rate limit")
    })

    it("handles invalid GitHub URL", async () => {
      const adapter = new GitHubProviderAdapter()
      const result = await adapter.checkAccess("https://notgithub.com/a/b")
      expect(result.accessible).toBe(false)
      expect(result.reason).toContain("Invalid GitHub")
    })
  })

  describe("listTree", () => {
    it("fetches recursive tree and filters blobs and subpath", async () => {
      const mockFetch = mock(async (url: string | URL | Request) => {
        const urlStr = String(url)
        if (urlStr.includes("/git/trees/main")) {
          return new Response(
            JSON.stringify({
              sha: "tree-sha-1",
              tree: [
                { path: "apps/web/package.json", type: "blob" },
                { path: "apps/web/src/index.ts", type: "blob" },
                { path: "apps/web/src", type: "tree" },
                { path: "apps/api/package.json", type: "blob" },
                { path: "README.md", type: "blob" },
              ],
              truncated: false,
            }),
            { status: 200 }
          )
        }
        return new Response(null, { status: 404 })
      })

      const adapter = new GitHubProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      const result = await adapter.listTree(
        "https://github.com/octocat/monorepo",
        "main",
        "apps/web"
      )

      expect(result.files).toEqual(["package.json", "src/index.ts"])
      expect(result.truncated).toBe(false)
    })

    it("resolves default branch if ref is not specified", async () => {
      const mockFetch = mock(async (url: string | URL | Request) => {
        const urlStr = String(url)
        if (urlStr.endsWith("/repos/octocat/repo")) {
          return new Response(
            JSON.stringify({ default_branch: "production" }),
            { status: 200 }
          )
        }
        if (urlStr.includes("/git/trees/production")) {
          return new Response(
            JSON.stringify({
              tree: [{ path: "index.js", type: "blob" }],
              truncated: false,
            }),
            { status: 200 }
          )
        }
        return new Response(null, { status: 404 })
      })

      const adapter = new GitHubProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      const result = await adapter.listTree("https://github.com/octocat/repo")
      expect(result.files).toEqual(["index.js"])
    })

    it("falls back to commit lookup if branch ref gives 404 on tree endpoint", async () => {
      const mockFetch = mock(async (url: string | URL | Request) => {
        const urlStr = String(url)
        if (urlStr.includes("/git/trees/release-v1")) {
          return new Response(null, { status: 404 })
        }
        if (urlStr.includes("/commits/release-v1")) {
          return new Response(
            JSON.stringify({
              sha: "commit-sha-123",
              commit: { tree: { sha: "resolved-tree-sha" } },
            }),
            { status: 200 }
          )
        }
        if (urlStr.includes("/git/trees/resolved-tree-sha")) {
          return new Response(
            JSON.stringify({
              tree: [{ path: "app.ts", type: "blob" }],
              truncated: true,
            }),
            { status: 200 }
          )
        }
        return new Response(null, { status: 404 })
      })

      const adapter = new GitHubProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      const result = await adapter.listTree(
        "https://github.com/octocat/repo",
        "release-v1"
      )
      expect(result.files).toEqual(["app.ts"])
      expect(result.truncated).toBe(true)
    })
  })

  describe("readFile", () => {
    it("reads and decodes base64 file content", async () => {
      const sampleContent = JSON.stringify({ name: "my-app", version: "1.0.0" })
      const encoded = Buffer.from(sampleContent).toString("base64")

      const mockFetch = mock(async () => {
        return new Response(
          JSON.stringify({
            name: "package.json",
            path: "package.json",
            encoding: "base64",
            content: encoded,
            size: sampleContent.length,
          }),
          { status: 200 }
        )
      })

      const adapter = new GitHubProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      const file = await adapter.readFile(
        "https://github.com/octocat/repo",
        "package.json"
      )
      expect(file.content).toBe(sampleContent)
      expect(file.size).toBe(sampleContent.length)
    })

    it("throws when file is not found (404)", async () => {
      const mockFetch = mock(async () => {
        return new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
        })
      })

      const adapter = new GitHubProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      expect(
        adapter.readFile("https://github.com/octocat/repo", "missing.json")
      ).rejects.toThrow("File not found: missing.json")
    })
  })
})

describe("GitLabProviderAdapter", () => {
  describe("parseGitLabUrl and matches", () => {
    const adapter = new GitLabProviderAdapter()

    it("matches standard HTTPS gitlab URLs and nested subgroups", () => {
      expect(adapter.matches("https://gitlab.com/gitlab-org/gitlab")).toBe(true)
      expect(
        adapter.matches("https://gitlab.com/my-group/subgroup/deep/project.git")
      ).toBe(true)
      expect(adapter.matches("https://gitlab.com/group/repo/")).toBe(true)
    })

    it("matches schemeless and SSH gitlab URLs", () => {
      expect(adapter.matches("gitlab.com/group/repo")).toBe(true)
      expect(adapter.matches("git@gitlab.com:group/subgroup/repo.git")).toBe(
        true
      )
    })

    it("extracts host, projectPath, and URL-encoded id", () => {
      const parsed = parseGitLabUrl(
        "https://gitlab.com/my-org/backend-service.git"
      )
      expect(parsed).toEqual({
        host: "gitlab.com",
        projectPath: "my-org/backend-service",
        encodedId: "my-org%2Fbackend-service",
      })
    })

    it("matches custom GitLab host when configured", () => {
      const customAdapter = new GitLabProviderAdapter({
        allowedHosts: ["gitlab.internal.co"],
      })
      expect(
        customAdapter.matches("https://gitlab.internal.co/team/service")
      ).toBe(true)
    })

    it("rejects non-gitlab URLs", () => {
      expect(adapter.matches("https://github.com/gitlab-org/gitlab")).toBe(
        false
      )
      expect(adapter.matches("https://example.com/team/repo")).toBe(false)
      expect(adapter.matches("invalid-url")).toBe(false)
    })
  })

  describe("checkAccess", () => {
    it("returns accessible for public GitLab project", async () => {
      const mockFetch = mock(async () => {
        return new Response(
          JSON.stringify({
            visibility: "public",
            default_branch: "main",
          }),
          { status: 200 }
        )
      })

      const adapter = new GitLabProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      const result = await adapter.checkAccess(
        "https://gitlab.com/gitlab-org/gitlab"
      )
      expect(result).toEqual({
        accessible: true,
        provider: "gitlab",
        isPrivate: false,
        defaultBranch: "main",
      })
    })

    it("returns isPrivate for private project when authenticated", async () => {
      const mockFetch = mock(async () => {
        return new Response(
          JSON.stringify({
            visibility: "private",
            default_branch: "develop",
          }),
          { status: 200 }
        )
      })

      const adapter = new GitLabProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
        getToken: () => "glpat-test-token",
      })

      const result = await adapter.checkAccess(
        "https://gitlab.com/group/private-project"
      )
      expect(result).toEqual({
        accessible: true,
        provider: "gitlab",
        isPrivate: true,
        defaultBranch: "develop",
      })
    })

    it("returns requiresAuth on 404 (private or missing project)", async () => {
      const mockFetch = mock(async () => {
        return new Response(
          JSON.stringify({ message: "404 Project Not Found" }),
          {
            status: 404,
          }
        )
      })

      const adapter = new GitLabProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      const result = await adapter.checkAccess(
        "https://gitlab.com/group/secret-project"
      )
      expect(result.accessible).toBe(false)
      expect(result.requiresAuth).toBe(true)
      expect(result.isPrivate).toBe(true)
      expect(result.provider).toBe("gitlab")
    })

    it("returns requiresAuth on 401 unauthorized", async () => {
      const mockFetch = mock(async () => {
        return new Response(JSON.stringify({ message: "401 Unauthorized" }), {
          status: 401,
        })
      })

      const adapter = new GitLabProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      const result = await adapter.checkAccess(
        "https://gitlab.com/group/project"
      )
      expect(result.accessible).toBe(false)
      expect(result.requiresAuth).toBe(true)
      expect(result.provider).toBe("gitlab")
    })
  })

  describe("listTree", () => {
    it("handles pagination across multiple pages and filters subpath", async () => {
      const mockFetch = mock(async (url: string | URL | Request) => {
        const parsedUrl = new URL(String(url))
        const pageParam = parsedUrl.searchParams.get("page")
        if (pageParam === "1") {
          return new Response(
            JSON.stringify([
              {
                id: "1",
                name: "package.json",
                path: "src/package.json",
                type: "blob",
              },
              { id: "2", name: "index.ts", path: "src/index.ts", type: "blob" },
            ]),
            {
              status: 200,
              headers: {
                "x-next-page": "2",
              },
            }
          )
        }
        if (pageParam === "2") {
          return new Response(
            JSON.stringify([
              { id: "3", name: "util.ts", path: "src/util.ts", type: "blob" },
              { id: "4", name: "docs", path: "docs", type: "tree" },
            ]),
            {
              status: 200,
              headers: {
                "x-next-page": "",
              },
            }
          )
        }
        return new Response(null, { status: 404 })
      })

      const adapter = new GitLabProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      const result = await adapter.listTree(
        "https://gitlab.com/group/project",
        "main",
        "src"
      )

      expect(result.files).toEqual(["package.json", "index.ts", "util.ts"])
      expect(result.truncated).toBe(false)
    })

    it("marks truncated true if maxPages is reached with more pages available", async () => {
      const mockFetch = mock(async () => {
        return new Response(
          JSON.stringify([
            { id: "1", name: "a.ts", path: "a.ts", type: "blob" },
          ]),
          {
            status: 200,
            headers: {
              "x-next-page": "2",
            },
          }
        )
      })

      const adapter = new GitLabProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
        maxPages: 1,
      })

      const result = await adapter.listTree("https://gitlab.com/group/project")
      expect(result.files).toEqual(["a.ts"])
      expect(result.truncated).toBe(true)
    })
  })

  describe("readFile", () => {
    it("reads raw file content with URL-encoded file path", async () => {
      let requestedUrl = ""
      const mockFetch = mock(async (url: string | URL | Request) => {
        requestedUrl = String(url)
        return new Response("console.log('hello from gitlab')", {
          status: 200,
          headers: {
            "content-length": "30",
          },
        })
      })

      const adapter = new GitLabProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      const file = await adapter.readFile(
        "https://gitlab.com/group/subgroup/project",
        "src/nested/index.ts",
        "feat-branch"
      )

      expect(requestedUrl).toContain(
        "/repository/files/src%2Fnested%2Findex.ts/raw?ref=feat-branch"
      )
      expect(file.content).toBe("console.log('hello from gitlab')")
      expect(file.size).toBe(30)
    })

    it("throws when file is not found (404)", async () => {
      const mockFetch = mock(async () => {
        return new Response("404 Not Found", { status: 404 })
      })

      const adapter = new GitLabProviderAdapter({
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      expect(
        adapter.readFile("https://gitlab.com/group/project", "nonexistent.ts")
      ).rejects.toThrow("File not found: nonexistent.ts")
    })
  })
})

describe("GitProviderRegistry", () => {
  it("resolves GitHub and GitLab URLs using global registry", () => {
    const github = resolveGitProvider("https://github.com/org/repo")
    expect(github.name).toBe("github")

    const gitlab = resolveGitProvider("https://gitlab.com/org/repo")
    expect(gitlab.name).toBe("gitlab")
  })

  it("throws for unrecognized git URL", () => {
    expect(() => resolveGitProvider("https://bitbucket.org/org/repo")).toThrow(
      "No git provider adapter found"
    )
  })

  it("checkGitAccess resolves adapter and performs check", async () => {
    const registry = new GitProviderRegistry()
    registry.register({
      name: "github",
      matches: (url) => url.includes("github.com"),
      checkAccess: async () => ({
        accessible: true,
        provider: "github",
        defaultBranch: "main",
      }),
      listTree: async () => ({ files: [], truncated: false }),
      readFile: async () => ({ content: "", size: 0 }),
    })

    const access = await registry.checkAccess(
      "https://github.com/test/repo",
      mockActor
    )
    expect(access).toEqual({
      accessible: true,
      provider: "github",
      defaultBranch: "main",
    })
  })

  it("checkGitAccess returns generic error result when URL cannot be resolved", async () => {
    const registry = new GitProviderRegistry([])
    const result = await registry.checkAccess("https://unknown.com/repo")
    expect(result.accessible).toBe(false)
    expect(result.provider).toBe("generic")
    expect(result.reason).toContain("No git provider adapter found")
  })
})

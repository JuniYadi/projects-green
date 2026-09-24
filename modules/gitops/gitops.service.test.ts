import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test"

const mockFetch = mock()
const originalFetch = global.fetch
const originalGitopsRepoPat = process.env.GITOPS_REPO_PAT
const originalGithubAppId = process.env.GITHUB_APP_ID
const originalGithubAppPrivateKeyBase64 =
  process.env.GITHUB_APP_PRIVATE_KEY_BASE64

import { GitOpsRepositoryService } from "./gitops.service"

describe("GitOpsRepositoryService", () => {
  let service: GitOpsRepositoryService

  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof global.fetch
    process.env.GITOPS_REPO_PAT = "test-pat"
    process.env.GITHUB_APP_ID = "12345"
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 =
      Buffer.from("test-key").toString("base64")

    service = new GitOpsRepositoryService()
    mockFetch.mockClear()
  })

  it("should commit files using GitHub Trees API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ object: { sha: "base-sha" } }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sha: "blob-sha" }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sha: "tree-sha" }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sha: "commit-sha" }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const result = await service.commitFiles("owner/repo", "test message", [
      { path: "test.txt", content: "hello" },
    ])

    expect(result.sha).toBe("commit-sha")
    expect(mockFetch).toHaveBeenCalledTimes(5)
  })

  it("should handle deletions in commitFiles", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ object: { sha: "base-sha" } }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sha: "tree-sha" }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sha: "commit-sha" }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const result = await service.commitFiles(
      "owner/repo",
      "delete message",
      [],
      ["old-file.txt"]
    )

    expect(result.sha).toBe("commit-sha")
    expect(mockFetch).toHaveBeenCalledTimes(4)

    const treeCall = mockFetch.mock.calls.find((call) =>
      (call[0] as string).endsWith("/git/trees")
    )
    expect(treeCall).toBeDefined()
    const body = JSON.parse(
      (treeCall as unknown as [string, { body: string }])[1].body
    )
    expect(body.tree).toContainEqual({
      path: "old-file.txt",
      mode: "100644",
      type: "blob",
      sha: null,
    })
  })

  it("should list tracked files filtered by directory prefix", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ object: { sha: "base-sha" } }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sha: "base-sha",
        tree: [
          {
            path: "services-yaml/app-org/stack-a/helm.yml",
            type: "blob",
            mode: "100644",
            sha: "blob-1",
          },
          {
            path: "services-yaml/app-org/stack-a/value.yml",
            type: "blob",
            mode: "100644",
            sha: "blob-2",
          },
          {
            path: "services-yaml/app-org/stack-a",
            type: "tree",
            mode: "040000",
            sha: "tree-1",
          },
          {
            path: "services-yaml/app-org/stack-b/helm.yml",
            type: "blob",
            mode: "100644",
            sha: "blob-3",
          },
          {
            path: "argocd-projects/app-org.yml",
            type: "blob",
            mode: "100644",
            sha: "blob-4",
          },
        ],
      }),
    })

    const files = await service.listTrackedFiles(
      "owner/repo",
      "services-yaml/app-org/stack-a"
    )

    expect(files).toEqual([
      "services-yaml/app-org/stack-a/helm.yml",
      "services-yaml/app-org/stack-a/value.yml",
    ])
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("should list all tracked files when no prefix provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ object: { sha: "base-sha" } }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sha: "base-sha",
        tree: [
          {
            path: "file1.txt",
            type: "blob",
            mode: "100644",
            sha: "blob-1",
          },
          {
            path: "dir",
            type: "tree",
            mode: "040000",
            sha: "tree-1",
          },
          {
            path: "dir/file2.txt",
            type: "blob",
            mode: "100644",
            sha: "blob-2",
          },
        ],
      }),
    })

    const files = await service.listTrackedFiles("owner/repo")
    expect(files).toEqual(["file1.txt", "dir/file2.txt"])
  })

  it("should throw error when listTrackedFiles fails to fetch tree", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ object: { sha: "base-sha" } }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "Not Found",
    })

    await expect(service.listTrackedFiles("owner/repo")).rejects.toThrow(
      "Failed to list tree: Not Found"
    )
  })

  it("should throw error when GitHub tree response is truncated", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ object: { sha: "base-sha" } }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sha: "base-sha",
        tree: [
          {
            path: "services/file.yml",
            type: "blob",
            mode: "100644",
            sha: "blob-1",
          },
        ],
        truncated: true,
      }),
    })

    await expect(service.listTrackedFiles("owner/repo")).rejects.toThrow(
      "GITOPS_TREE_TRUNCATED"
    )
  })
})

afterAll(() => {
  global.fetch = originalFetch

  if (originalGitopsRepoPat === undefined) {
    delete process.env.GITOPS_REPO_PAT
  } else {
    process.env.GITOPS_REPO_PAT = originalGitopsRepoPat
  }

  if (originalGithubAppId === undefined) {
    delete process.env.GITHUB_APP_ID
  } else {
    process.env.GITHUB_APP_ID = originalGithubAppId
  }

  if (originalGithubAppPrivateKeyBase64 === undefined) {
    delete process.env.GITHUB_APP_PRIVATE_KEY_BASE64
  } else {
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 =
      originalGithubAppPrivateKeyBase64
  }
})

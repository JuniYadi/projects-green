import { describe, expect, it, mock } from "bun:test"
import type { GitProviderAdapter } from "@/modules/deploy/git-provider"
import type { AiDetectionToolTrace } from "../framework-detection.trace"
import { createRepoInspectorTools } from "./repo-inspector.tools"

describe("repo-inspector.tools", () => {
  const mockActor = {
    userId: "usr_test_123",
    organizationId: "org_test_123",
  }

  const createMockAdapter = (
    overrides?: Partial<GitProviderAdapter>
  ): GitProviderAdapter => ({
    name: "mock-adapter",
    matches: () => true,
    checkAccess: async () => ({ accessible: true, provider: "generic" }),
    listTree: async () => ({ files: ["file1.txt"], truncated: false }),
    readFile: async () => ({ content: "hello world", size: 11 }),
    ...overrides,
  })

  describe("list_repo_files tool", () => {
    it("uses explicit path parameter over default subpath", async () => {
      const traces: AiDetectionToolTrace[] = []
      const listTreeMock = mock(async () => ({
        files: ["sub/a.ts", "sub/b.ts"],
        truncated: false,
      }))

      const adapter = createMockAdapter({ listTree: listTreeMock })
      const tools = createRepoInspectorTools({
        adapter,
        repoUrl: "https://github.com/test/repo",
        ref: "main",
        subpath: "default-sub",
        actor: mockActor,
        onStep: (step) => traces.push(step),
      })

      const exec = tools.list_repo_files.execute as (
        args: { path?: string },
        ctx?: unknown
      ) => Promise<{ files: string[]; truncated: boolean }>

      const result = await exec({ path: "custom-path" })

      expect(result.files).toEqual(["sub/a.ts", "sub/b.ts"])
      expect(result.truncated).toBe(false)
      expect(listTreeMock).toHaveBeenCalledWith(
        "https://github.com/test/repo",
        "main",
        "custom-path",
        mockActor
      )
      expect(traces).toHaveLength(1)
      expect(traces[0].name).toBe("list_repo_files")
      expect(traces[0].status).toBe("completed")
      expect(traces[0].path).toBe("custom-path")
      expect(traces[0].listedFileCount).toBe(2)
      expect(traces[0].durationMs).toBeGreaterThanOrEqual(0)
    })

    it("falls back to subpath when path parameter is undefined", async () => {
      const listTreeMock = mock(async () => ({
        files: ["root.txt"],
        truncated: false,
      }))

      const adapter = createMockAdapter({ listTree: listTreeMock })
      const tools = createRepoInspectorTools({
        adapter,
        repoUrl: "https://github.com/test/repo",
        subpath: "subfolder",
      })

      const exec = tools.list_repo_files.execute as (
        args: { path?: string },
        ctx?: unknown
      ) => Promise<{ files: string[]; truncated: boolean }>

      await exec({})

      expect(listTreeMock).toHaveBeenCalledWith(
        "https://github.com/test/repo",
        undefined,
        "subfolder",
        undefined
      )
    })

    it("captures failure, logs trace item and rethrows error", async () => {
      const traces: AiDetectionToolTrace[] = []
      const adapter = createMockAdapter({
        listTree: async () => {
          throw new Error("Network timeout")
        },
      })
      const tools = createRepoInspectorTools({
        adapter,
        repoUrl: "https://github.com/test/repo",
        onStep: (step) => traces.push(step),
      })

      const exec = tools.list_repo_files.execute as (
        args: { path?: string },
        ctx?: unknown
      ) => Promise<{ files: string[]; truncated: boolean }>

      await expect(exec({})).rejects.toThrow("Network timeout")

      expect(traces).toHaveLength(1)
      expect(traces[0].name).toBe("list_repo_files")
      expect(traces[0].status).toBe("failed")
      expect(traces[0].outcome).toBe("failed")
      expect(traces[0].errorCategory).toBe("tool_failure")
      expect(traces[0].durationMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe("read_repo_file tool", () => {
    it("handles subpath joining and leading slashes cleaning", async () => {
      let readPath = ""
      const adapter = createMockAdapter({
        readFile: async (_repo, path) => {
          readPath = path
          return { content: "package-json-content", size: 20 }
        },
      })

      const tools = createRepoInspectorTools({
        adapter,
        repoUrl: "https://github.com/test/repo",
        subpath: "/apps/web/",
      })

      const exec = tools.read_repo_file.execute as (
        args: { filePath: string },
        ctx?: unknown
      ) => Promise<{ content: string; path: string; size: number }>

      const result = await exec({ filePath: "/package.json" })

      expect(readPath).toBe("apps/web/package.json")
      expect(result.content).toBe("package-json-content")
      expect(result.path).toBe("/package.json")
      expect(result.size).toBe(20)
    })

    it("does not duplicate subpath if filePath already begins with subpath", async () => {
      let readPath = ""
      const adapter = createMockAdapter({
        readFile: async (_repo, path) => {
          readPath = path
          return { content: "already-prefixed", size: 16 }
        },
      })

      const tools = createRepoInspectorTools({
        adapter,
        repoUrl: "https://github.com/test/repo",
        subpath: "apps/web",
      })

      const exec = tools.read_repo_file.execute as (
        args: { filePath: string },
        ctx?: unknown
      ) => Promise<{ content: string; path: string; size: number }>

      await exec({ filePath: "apps/web/src/main.ts" })

      expect(readPath).toBe("apps/web/src/main.ts")
    })

    it("falls back to raw filePath if targetPath with subpath fails", async () => {
      const attemptedPaths: string[] = []
      const adapter = createMockAdapter({
        readFile: async (_repo, path) => {
          attemptedPaths.push(path)
          if (path === "packages/api/shared.json") {
            throw new Error("Not found in subpath")
          }
          if (path === "shared.json") {
            return { content: "shared-root-content", size: 19 }
          }
          throw new Error("Not found")
        },
      })

      const tools = createRepoInspectorTools({
        adapter,
        repoUrl: "https://github.com/test/repo",
        subpath: "packages/api",
      })

      const exec = tools.read_repo_file.execute as (
        args: { filePath: string },
        ctx?: unknown
      ) => Promise<{ content: string; path: string; size: number }>

      const result = await exec({ filePath: "shared.json" })

      expect(attemptedPaths).toEqual([
        "packages/api/shared.json",
        "shared.json",
      ])
      expect(result.content).toBe("shared-root-content")
    })

    it("truncates large files exceeding 20KB and appends notice", async () => {
      const largeContent = "a".repeat(25_000)
      const adapter = createMockAdapter({
        readFile: async () => ({
          content: largeContent,
          size: 25_000,
        }),
      })

      const tools = createRepoInspectorTools({
        adapter,
        repoUrl: "https://github.com/test/repo",
      })

      const exec = tools.read_repo_file.execute as (
        args: { filePath: string },
        ctx?: unknown
      ) => Promise<{ content: string; path: string; size: number }>

      const result = await exec({ filePath: "large.txt" })

      expect(result.content).toHaveLength(20_000 + "\n... (truncated)".length)
      expect(result.content.endsWith("\n... (truncated)")).toBe(true)
      expect(result.size).toBe(25_000)
    })

    it("records failure trace and throws when readFile fails completely", async () => {
      const traces: AiDetectionToolTrace[] = []
      const adapter = createMockAdapter({
        readFile: async () => {
          throw new Error("File not found: missing.txt")
        },
      })

      const tools = createRepoInspectorTools({
        adapter,
        repoUrl: "https://github.com/test/repo",
        onStep: (step) => traces.push(step),
      })

      const exec = tools.read_repo_file.execute as (
        args: { filePath: string },
        ctx?: unknown
      ) => Promise<{ content: string; path: string; size: number }>

      await expect(exec({ filePath: "missing.txt" })).rejects.toThrow(
        "File not found: missing.txt"
      )

      expect(traces).toHaveLength(1)
      expect(traces[0].name).toBe("read_repo_file")
      expect(traces[0].status).toBe("failed")
      expect(traces[0].outcome).toBe("failed")
      expect(traces[0].errorCategory).toBe("tool_failure")
      expect(traces[0].durationMs).toBeGreaterThanOrEqual(0)
    })

    it("does not crash if onStep is not provided", async () => {
      const adapter = createMockAdapter({
        readFile: async () => ({ content: "no-callback", size: 11 }),
      })

      const tools = createRepoInspectorTools({
        adapter,
        repoUrl: "https://github.com/test/repo",
      })

      const exec = tools.read_repo_file.execute as (
        args: { filePath: string },
        ctx?: unknown
      ) => Promise<{ content: string; path: string; size: number }>

      const result = await exec({ filePath: "test.txt" })
      expect(result.content).toBe("no-callback")
    })
  })
})

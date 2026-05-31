import { describe, expect, it, mock, beforeEach } from "bun:test"

// 1. Define mock objects
const mockFetch = mock()
global.fetch = mockFetch as any

// 2. Register module mocks (none needed for this leaf service yet, but we'll mock process.env)
process.env.GITOPS_REPO_PAT = "test-pat"
process.env.GITHUB_APP_ID = "12345"
process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = Buffer.from("test-key").toString("base64")

// 3. Import the thing under test
import { GitOpsRepositoryService } from "./gitops.service"

describe("GitOpsRepositoryService", () => {
  let service: GitOpsRepositoryService

  beforeEach(() => {
    service = new GitOpsRepositoryService()
    mockFetch.mockClear()
  })

  it("should commit files using GitHub Trees API", async () => {
    // Mock getRef
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ object: { sha: "base-sha" } }),
    })
    // Mock createBlob
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sha: "blob-sha" }),
    })
    // Mock createTree
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sha: "tree-sha" }),
    })
    // Mock createCommit
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sha: "commit-sha" }),
    })
    // Mock updateRef
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const result = await service.commitFiles(
      "owner/repo",
      "test message",
      [{ path: "test.txt", content: "hello" }]
    )

    expect(result.sha).toBe("commit-sha")
    expect(mockFetch).toHaveBeenCalledTimes(5)
  })

  it("should handle deletions in commitFiles", async () => {
    // Mock getRef
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ object: { sha: "base-sha" } }),
    })
    // Mock createTree
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sha: "tree-sha" }),
    })
    // Mock createCommit
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sha: "commit-sha" }),
    })
    // Mock updateRef
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
    
    // Check createTree call body for deletion
    const treeCall = mockFetch.mock.calls.find(call => call[0].endsWith("/git/trees"))
    const body = JSON.parse(treeCall[1].body)
    expect(body.tree).toContainEqual({
      path: "old-file.txt",
      mode: "100644",
      type: "blob",
      sha: null,
    })
  })
})

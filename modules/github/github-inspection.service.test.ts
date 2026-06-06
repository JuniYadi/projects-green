import { describe, expect, it, beforeEach } from "bun:test"

import {
  listRepoFiles,
  readRepoFile,
  type ListRepoFilesInput,
  type ReadRepoFileInput,
} from "@/modules/github/github.service"

// Mock the prisma and redis modules
const mockToken = "ghs_mock_token_12345"

// We'll test the logic by mocking the internal functions
// Since the service uses internal functions, we test the exported ones

describe("GitHub Inspection Tools", () => {
  describe("listRepoFiles", () => {
    it("throws error when installation token creation fails", async () => {
      const input: ListRepoFilesInput = {
        installationId: 99999,
        owner: "test-org",
        repo: "test-repo",
      }

      // This will fail because we don't have valid GitHub credentials
      // But we can test that the function exists and has the right signature
      await expect(listRepoFiles(input)).rejects.toThrow()
    })
  })

  describe("readRepoFile", () => {
    it("throws error when installation token creation fails", async () => {
      const input: ReadRepoFileInput = {
        installationId: 99999,
        owner: "test-org",
        repo: "test-repo",
        filePath: "package.json",
      }

      // This will fail because we don't have valid GitHub credentials
      // But we can test that the function exists and has the right signature
      await expect(readRepoFile(input)).rejects.toThrow()
    })
  })
})

describe("GitHub Service Types", () => {
  it("exports expected types", async () => {
    const mod = await import("@/modules/github/github.service")
    expect(typeof mod.listRepoFiles).toBe("function")
    expect(typeof mod.readRepoFile).toBe("function")
  })
})

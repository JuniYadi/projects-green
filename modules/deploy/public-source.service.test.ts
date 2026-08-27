import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockParsePublicGitUrl = mock((url: string) => {
  if (url.includes("invalid")) {
    return { error: "INVALID_URL" }
  }
  return { url }
})

mock.module("./public-source", () => ({
  parsePublicGitUrl: mockParsePublicGitUrl,
}))

import {
  checkPublicSourceAccess,
  checkPublicSourceUpdate,
} from "./public-source.service"

describe("public-source.service", () => {
  const originalSpawn = Bun.spawn

  beforeEach(() => {
    mockParsePublicGitUrl.mockClear()
    Bun.spawn = originalSpawn
  })

  describe("checkPublicSourceAccess", () => {
    it("returns unavailable when URL parsing fails", async () => {
      const res = await checkPublicSourceAccess({
        url: "invalid-url",
      })

      expect(res).toEqual({
        accessible: false,
        reason: "unavailable",
      })
    })

    it("returns accessible true when git ls-remote succeeds with stdout", async () => {
      Bun.spawn = mock(() => ({
        stdout: new Blob([
          "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 refs/heads/main\n",
        ]).stream(),
        stderr: new Blob([""]).stream(),
        exited: Promise.resolve(0),
      })) as unknown as typeof Bun.spawn

      const res = await checkPublicSourceAccess({
        url: "https://github.com/org/repo",
        ref: "main",
      })

      expect(res).toEqual({ accessible: true })
    })

    it("returns ref_not_found when git ls-remote succeeds but stdout is empty", async () => {
      Bun.spawn = mock(() => ({
        stdout: new Blob([""]).stream(),
        stderr: new Blob([""]).stream(),
        exited: Promise.resolve(0),
      })) as unknown as typeof Bun.spawn

      const res = await checkPublicSourceAccess({
        url: "https://github.com/org/repo",
        ref: "non-existent-branch",
      })

      expect(res).toEqual({
        accessible: false,
        reason: "ref_not_found",
      })
    })

    it("returns private_or_missing when stderr matches permission or not found keywords", async () => {
      Bun.spawn = mock(() => ({
        stdout: new Blob([""]).stream(),
        stderr: new Blob([
          "fatal: could not read Username for 'https://github.com': terminal prompts disabled",
        ]).stream(),
        exited: Promise.resolve(128),
      })) as unknown as typeof Bun.spawn

      const res = await checkPublicSourceAccess({
        url: "https://github.com/org/private-repo",
      })

      expect(res).toEqual({
        accessible: false,
        reason: "private_or_missing",
      })
    })

    it("returns unavailable for generic network/command failure", async () => {
      Bun.spawn = mock(() => ({
        stdout: new Blob([""]).stream(),
        stderr: new Blob(["fatal: connection refused"]).stream(),
        exited: Promise.resolve(128),
      })) as unknown as typeof Bun.spawn

      const res = await checkPublicSourceAccess({
        url: "https://github.com/org/broken-repo",
      })

      expect(res).toEqual({
        accessible: false,
        reason: "unavailable",
      })
    })
  })

  describe("checkPublicSourceUpdate", () => {
    it("throws INVALID_PUBLIC_SOURCE if url parse fails", async () => {
      await expect(
        checkPublicSourceUpdate({
          url: "invalid-url",
          ref: "main",
        })
      ).rejects.toThrow("INVALID_PUBLIC_SOURCE")
    })

    it("throws error with stderr message when git ls-remote fails", async () => {
      Bun.spawn = mock(() => ({
        stdout: new Blob([""]).stream(),
        stderr: new Blob(["Host key verification failed"]).stream(),
        exited: Promise.resolve(1),
      })) as unknown as typeof Bun.spawn

      await expect(
        checkPublicSourceUpdate({
          url: "https://github.com/org/repo",
          ref: "main",
        })
      ).rejects.toThrow("Host key verification failed")
    })

    it("throws PUBLIC_SOURCE_REF_NOT_FOUND when sha is malformed or missing", async () => {
      Bun.spawn = mock(() => ({
        stdout: new Blob(["invalid-sha refs/heads/main"]).stream(),
        stderr: new Blob([""]).stream(),
        exited: Promise.resolve(0),
      })) as unknown as typeof Bun.spawn

      await expect(
        checkPublicSourceUpdate({
          url: "https://github.com/org/repo",
          ref: "main",
        })
      ).rejects.toThrow("PUBLIC_SOURCE_REF_NOT_FOUND")
    })

    it("returns remoteSha and updateAvailable boolean", async () => {
      const sha = "0123456789abcdef0123456789abcdef01234567"
      Bun.spawn = mock(() => ({
        stdout: new Blob([`${sha} refs/heads/main\n`]).stream(),
        stderr: new Blob([""]).stream(),
        exited: Promise.resolve(0),
      })) as unknown as typeof Bun.spawn

      const resWithDiff = await checkPublicSourceUpdate({
        url: "https://github.com/org/repo",
        ref: "main",
        deployedSha: "old-sha",
      })

      expect(resWithDiff).toEqual({
        remoteSha: sha,
        updateAvailable: true,
      })

      Bun.spawn = mock(() => ({
        stdout: new Blob([`${sha} refs/heads/main\n`]).stream(),
        stderr: new Blob([""]).stream(),
        exited: Promise.resolve(0),
      })) as unknown as typeof Bun.spawn

      const resWithoutDiff = await checkPublicSourceUpdate({
        url: "https://github.com/org/repo",
        ref: "main",
        deployedSha: sha,
      })

      expect(resWithoutDiff).toEqual({
        remoteSha: sha,
        updateAvailable: false,
      })
    })
  })
})

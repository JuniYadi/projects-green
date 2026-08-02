import { describe, expect, it } from "bun:test"
import {
  isPublicGitUrl,
  parsePublicGitUrl,
} from "@/modules/deploy/public-source"

describe("parsePublicGitUrl", () => {
  it("trims and normalizes public Git HTTPS URLs", () => {
    expect(parsePublicGitUrl("  HTTPS://GitHub.com/org/repo.git  ")).toEqual({
      url: "https://github.com/org/repo.git",
      host: "github.com",
    })
  })

  it("accepts public Git HTTPS hosts and query strings", () => {
    expect(
      parsePublicGitUrl("https://gitlab.com/group/project?ref=main")
    ).toEqual({
      url: "https://gitlab.com/group/project?ref=main",
      host: "gitlab.com",
    })
    expect(isPublicGitUrl("https://code.example.org/team/repo")).toBe(true)
  })

  it("rejects unsafe or malformed URLs", () => {
    const rejected = [
      "",
      "   ",
      "not a URL",
      "https://",
      "https:///repo.git",
      "https://github.com:bad/repo.git",
      "http://github.com/org/repo.git",
      "ftp://github.com/org/repo.git",
      "ssh://git@github.com/org/repo.git",
      "git://github.com/org/repo.git",
      "file:///tmp/repo.git",
      "/tmp/repo.git",
      "https://user:pass@github.com/org/repo.git",
      "https://@github.com/org/repo.git",
      "https://github.com/org/repo.git#fragment",
      "https://github.com/org/repo.git#",
      "https://localhost/org/repo.git",
      "https://foo.localhost/org/repo.git",
      "https://127.0.0.1/org/repo.git",
      "https://2130706433/org/repo.git",
      "https://[::1]/org/repo.git",
      "https://169.254.1.1/org/repo.git",
      "https://[fe80::1]/org/repo.git",
      "https://10.0.0.1/org/repo.git",
      "https://172.16.0.1/org/repo.git",
      "https://192.168.1.1/org/repo.git",
      "https://[fc00::1]/org/repo.git",
      "https://224.0.0.1/org/repo.git",
      "https://[ff02::1]/org/repo.git",
      "https://0.0.0.0/org/repo.git",
      "https://[::]/org/repo.git",
      "https://-invalid.example/org/repo.git",
      "https://invalid-.example/org/repo.git",
      "https://foo..example/org/repo.git",
      "https://127.0.0.999/org/repo.git",
      "https://[not-an-ip]/org/repo.git",
    ]

    for (const value of rejected) {
      expect(isPublicGitUrl(value), value).toBe(false)
      expect(parsePublicGitUrl(value)).toMatchObject({
        error: expect.any(String),
      })
    }
  })
})

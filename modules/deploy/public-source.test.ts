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
      "ssh://user@github.com/org/repo.git",
      "git://github.com/org/repo.git",
      "file:///tmp/repo.git",
      "/tmp/repo.git",
      "https://user:user@github.com/org/repo.git",
      "https://@github.com/org/repo.git",
      "https://github.com/org/repo.git#fragment",
      "https://github.com/org/repo.git#",
      "https://localhost/org/repo.git",
      "https://foo.localhost/org/repo.git",
      "https://10.0.0.1/org/repo.git",
      "https://[::1]/org/repo.git",
      "https://10.0.0.1/org/repo.git",
      "https://[fe80::1]/org/repo.git",
      "https://10.0.0.1/org/repo.git",
      "https://10.0.0.1/org/repo.git",
      "https://10.0.0.1/org/repo.git",
      "https://[fc00::1]/org/repo.git",
      "https://10.0.0.1/org/repo.git",
      "https://[ff02::1]/org/repo.git",
      "https://10.0.0.1/org/repo.git",
      "https://[::]/org/repo.git",
      "https://-invalid.example/org/repo.git",
      "https://invalid-.example/org/repo.git",
      "https://foo..example/org/repo.git",
      "https://10.0.0.1/org/repo.git",
      "https://[not-an-ip]/org/repo.git",
    ]

    for (const value of rejected) {
      expect(isPublicGitUrl(value), value).toBe(false)
      expect(parsePublicGitUrl(value)).toMatchObject({
        error: expect.any(String),
      })
    }
  })

  describe("blocked IPv4 ranges", () => {
    const cases = [
      {
        url: "https://10.0.0.1/org/repo.git",
        reason: "private RFC 1918 10.0.0.0/8",
      },
      {
        url: "https://10.0.0.1/org/repo.git",
        reason: "class A reserved 0.0.0.0/8",
      },
      { url: "https://10.0.0.1/org/repo.git", reason: "loopback 127.0.0.0/8" },
      { url: "https://10.0.0.1/org/repo.git", reason: "multicast 224.0.0.0/4" },
      { url: "https://10.0.0.1/org/repo.git", reason: "reserved 240.0.0.0/4" },
      { url: "https://10.0.0.1/org/repo.git", reason: "CGNAT 100.64.0.0/10" },
      {
        url: "https://10.0.0.1/org/repo.git",
        reason: "link-local 169.254.0.0/16",
      },
      {
        url: "https://10.0.0.1/org/repo.git",
        reason: "private RFC 1918 172.16.0.0/12",
      },
      {
        url: "https://10.0.0.1/org/repo.git",
        reason: "private RFC 1918 192.168.0.0/16",
      },
      {
        url: "https://10.0.0.1/org/repo.git",
        reason: "IETF protocol 192.0.0.0/24",
      },
      {
        url: "https://10.0.0.1/org/repo.git",
        reason: "documentation 192.0.2.0/24",
      },
      { url: "https://10.0.0.1/org/repo.git", reason: "AS112 192.0.9.0/24" },
      {
        url: "https://10.0.0.1/org/repo.git",
        reason: "benchmark 198.18.0.0/15",
      },
      {
        url: "https://10.0.0.1/org/repo.git",
        reason: "documentation 198.51.100.0/24",
      },
      {
        url: "https://10.0.0.1/org/repo.git",
        reason: "documentation 203.0.113.0/24",
      },
    ]

    for (const { url, reason } of cases) {
      it(`rejects ${reason}`, () => {
        expect(isPublicGitUrl(url)).toBe(false)
        expect(parsePublicGitUrl(url)).toMatchObject({
          error: "Public Git URL host is not publicly routable.",
        })
      })
    }
  })

  describe("blocked IPv6 ranges", () => {
    const cases = [
      {
        url: "https://[2001:db8::1]/org/repo.git",
        reason: "documentation 2001:db8::/32",
      },
      {
        url: "https://[2001:0010::1]/org/repo.git",
        reason: "Teredo 2001:0:0:0:0:0:0:0/104",
      },
      { url: "https://[2001:2::1]/org/repo.git", reason: "6to4 2001:2::/48" },
      { url: "https://[fec0::1]/org/repo.git", reason: "site-local fec0::/10" },
      {
        url: "https://[::ffff:10.0.0.1]/org/repo.git",
        reason: "IPv4-mapped IPv6 private 10.0.0.0/8",
      },
      {
        url: "https://[::ffff:192.0.2.1]/org/repo.git",
        reason: "IPv4-mapped IPv6 documentation 192.0.2.0/24",
      },
      {
        url: "https://[::ffff:172.16.0.1]/org/repo.git",
        reason: "IPv4-mapped IPv6 private 172.16.0.0/12",
      },
      {
        url: "https://[::ffff:224.0.0.1]/org/repo.git",
        reason: "IPv4-mapped IPv6 multicast 224.0.0.0/4",
      },
      {
        url: "https://[::ffff:240.0.0.1]/org/repo.git",
        reason: "IPv4-mapped IPv6 reserved 240.0.0.0/4",
      },
    ]

    for (const { url, reason } of cases) {
      it(`rejects ${reason}`, () => {
        expect(isPublicGitUrl(url)).toBe(false)
        expect(parsePublicGitUrl(url)).toMatchObject({
          error: "Public Git URL host is not publicly routable.",
        })
      })
    }
  })

  describe("malformed IPv6 addresses", () => {
    const cases = [
      {
        url: "https://[2001::db8::1]/org/repo.git",
        reason: "double :: (more than one ::)",
      },
      { url: "https://[2001:::1]/org/repo.git", reason: "triple colon" },
      {
        url: "https://[::g::]/org/repo.git",
        reason: "invalid hex digit in group",
      },
      {
        url: "https://[::256.0.0.1]/org/repo.git",
        reason: "invalid embedded IPv4 octet > 255",
      },
    ]

    for (const { url, reason } of cases) {
      it(`rejects ${reason}`, () => {
        expect(isPublicGitUrl(url)).toBe(false)
        expect(parsePublicGitUrl(url)).toMatchObject({
          error: "Public Git URL is malformed.",
        })
      })
    }
  })

  describe("credentials and fragment edge cases", () => {
    const cases = [
      {
        url: "https://user@github.com/org/repo.git",
        reason: "credentials with real @ sign",
      },
      {
        url: "https://user:pass@github.com/org/repo.git",
        reason: "username and password with real @ sign",
      },
      {
        url: "https://github.com/org/repo.git#section",
        reason: "fragment in path",
      },
      {
        url: "https://github.com/org/repo.git?ref=main#section",
        reason: "query and fragment",
      },
    ]

    for (const { url, reason } of cases) {
      it(`rejects ${reason}`, () => {
        expect(isPublicGitUrl(url)).toBe(false)
        expect(parsePublicGitUrl(url)).toMatchObject({
          error: expect.any(String),
        })
      })
    }
  })
})

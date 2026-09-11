import { describe, expect, it } from "bun:test"
import {
  verifyDnsTarget,
  type DnsVerificationDependencies,
} from "./dns-verification.service"

const input = {
  hostname: "App.Example.COM.",
  expectedCnameTarget: "Origin.Example.NET.",
  expectedIpv4Addresses: ["203.0.113.10"],
  expectedIpv6Addresses: ["2001:DB8::10"],
}

function providers(
  google: (hostname: string, type: "CNAME" | "A" | "AAAA") => unknown,
  cloudflare = google,
  node?: DnsVerificationDependencies["node"]
): DnsVerificationDependencies {
  return {
    google: async (hostname, type) => google(hostname, type),
    cloudflare: async (hostname, type) => cloudflare(hostname, type),
    node,
  }
}

const cname = (_hostname: string, type: "CNAME" | "A" | "AAAA") =>
  type === "CNAME" ? ["ORIGIN.EXAMPLE.NET."] : []
const addresses = (_hostname: string, type: "CNAME" | "A" | "AAAA") =>
  type === "A" ? ["203.0.113.10"] : type === "AAAA" ? ["2001:db8::10"] : []

describe("verifyDnsTarget", () => {
  it("verifies a matching CNAME using two independent providers", async () => {
    const result = await verifyDnsTarget(input, providers(cname))
    expect(result.status).toBe("VERIFIED")
    expect(result.positiveSources).toEqual(["google", "cloudflare"])
    expect(
      result.evidence.some(
        (item) => item.recordType === "CNAME" && item.outcome === "positive"
      )
    ).toBe(true)
  })

  it("verifies through A/AAAA fallback when CNAME is absent", async () => {
    const result = await verifyDnsTarget(input, providers(addresses))
    expect(result.status).toBe("VERIFIED")
    expect(result.positiveSources).toEqual(["google", "cloudflare"])
  })

  it("keeps NXDOMAIN and NODATA pending", async () => {
    const missing = await verifyDnsTarget(
      input,
      providers(() => [])
    )
    expect(missing.status).toBe("PENDING")
    expect(missing.reason).toContain("not published")
  })

  it("fails when both providers return records that do not match", async () => {
    const result = await verifyDnsTarget(
      input,
      providers(() => ["198.51.100.7"])
    )
    expect(result.status).toBe("FAILED")
    expect(result.reason).toContain("did not match")
  })

  it("is inconclusive when public providers positively disagree", async () => {
    const result = await verifyDnsTarget(
      input,
      providers(cname, () => ["198.51.100.8"])
    )
    expect(result.status).toBe("INCONCLUSIVE")
    expect(result.reason).toContain("disagree")
  })

  it("uses Node DNS when both public resolvers fail", async () => {
    const node = {
      resolveCname: async () => ["origin.example.net."],
      resolve4: async () => [],
      resolve6: async () => [],
    }
    const result = await verifyDnsTarget(input, {
      google: async () => {
        throw new Error("timeout")
      },
      cloudflare: async () => {
        throw new Error("unavailable")
      },
      node,
    })
    expect(result.status).toBe("PENDING")
    expect(result.positiveSources).toEqual(["node"])
    expect(
      result.evidence.some(
        (item) => item.source === "node" && item.outcome === "positive"
      )
    ).toBe(true)
  })

  it("normalizes hostname, target, and answer case and trailing dots", async () => {
    let seen = ""
    const result = await verifyDnsTarget(
      input,
      providers((hostname, type) => {
        seen = hostname
        return type === "CNAME" ? ["Origin.Example.Net..."] : []
      })
    )
    expect(seen).toBe("app.example.com")
    expect(result.status).toBe("VERIFIED")
    expect(
      result.evidence.find((item) => item.recordType === "CNAME")?.values
    ).toEqual(["origin.example.net"])
  })
})

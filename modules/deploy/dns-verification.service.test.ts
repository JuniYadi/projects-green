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

  it("verifies matching records from injected Google and Cloudflare DoH", async () => {
    const requests: string[] = []
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const requestUrl = new URL(url.toString())
      requests.push(requestUrl.toString())
      const type = requestUrl.searchParams.get("type")
      const answer =
        type === "CNAME" ? [{ type: 5, data: "origin.example.net." }] : []
      return new Response(JSON.stringify({ Answer: answer }), {
        status: 200,
        headers: { "content-type": "application/dns-json" },
      })
    }) as unknown as typeof fetch

    const result = await verifyDnsTarget(input, { fetch: fetchImpl })

    expect(result.status).toBe("VERIFIED")
    expect(result.positiveSources).toEqual(["google", "cloudflare"])
    expect(requests.sort()).toEqual([
      "https://cloudflare-dns.com/dns-query?name=app.example.com&type=A",
      "https://cloudflare-dns.com/dns-query?name=app.example.com&type=AAAA",
      "https://cloudflare-dns.com/dns-query?name=app.example.com&type=CNAME",
      "https://dns.google/resolve?name=app.example.com&type=A",
      "https://dns.google/resolve?name=app.example.com&type=AAAA",
      "https://dns.google/resolve?name=app.example.com&type=CNAME",
    ])
  })

  it("keeps DoH HTTP failures pending with resolver error evidence", async () => {
    const result = await verifyDnsTarget(input, {
      fetch: (async () =>
        new Response("unavailable", {
          status: 503,
        })) as unknown as typeof fetch,
      node: {
        resolveCname: async () => [],
        resolve4: async () => [],
        resolve6: async () => [],
      },
    })
    expect(result.reason).toContain("failed")
    expect(
      result.evidence.filter((item) => item.outcome === "error")
    ).toHaveLength(6)
    expect(
      new Set(
        result.evidence
          .filter((item) => item.outcome === "error")
          .map((item) => item.source)
      )
    ).toEqual(new Set(["google", "cloudflare"]))
  })

  it("treats malformed DoH answer payloads as pending missing records", async () => {
    const result = await verifyDnsTarget(input, {
      fetch: (async () =>
        new Response(JSON.stringify({ Answer: "not-an-array" }), {
          status: 200,
        })) as unknown as typeof fetch,
    })

    expect(result.status).toBe("PENDING")
    expect(result.reason).toContain("not published")
    expect(result.evidence.every((item) => item.outcome === "missing")).toBe(
      true
    )
    expect(result.evidence).toHaveLength(6)
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

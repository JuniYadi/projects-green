import { describe, it, expect, mock } from "bun:test"
import { lookupIpGeo, enrichTopIpsWithGeo } from "./geoip-lookup.service"

describe("geoip-lookup.service", () => {
  it("resolves private and invalid IPs as LOCAL immediately without network call", async () => {
    const mockFetch = mock()
    const testIps = [
      "",
      "-",
      "unknown",
      "127.0.0.1",
      "::1",
      "localhost",
      "10.42.0.1",
      "192.168.1.100",
      "172.18.0.5",
      "fe80::1",
      "fc00::1",
    ]

    for (const ip of testIps) {
      const res = await lookupIpGeo(ip, mockFetch as unknown as typeof fetch)
      expect(res.countryCode).toBe("LOCAL")
      expect(res.countryName).toBe("Jaringan Internal")
    }
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("resolves public IP using primary findy API and caches result", async () => {
    const mockFetch = mock(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        ip: "149.22.90.218",
        geo: { country: "SG", city: "Singapore" },
      }),
    }))

    const res1 = await lookupIpGeo(
      "149.22.90.218",
      mockFetch as unknown as typeof fetch
    )
    expect(res1.countryCode).toBe("SG")
    expect(res1.city).toBe("Singapore")
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Second call should hit in-memory cache
    const res2 = await lookupIpGeo(
      "149.22.90.218",
      mockFetch as unknown as typeof fetch
    )
    expect(res2.countryCode).toBe("SG")
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("falls back to ip-api when primary API returns error status", async () => {
    let fallbackCalledUrl = ""
    const mockFetch = mock(async (url: string | URL | Request) => {
      const urlStr = String(url)
      if (urlStr.includes("api.findy.juniyadi.id")) {
        return { ok: false, status: 502 }
      }
      fallbackCalledUrl = urlStr
      return {
        ok: true,
        json: async () => ({
          status: "success",
          country: "Belgium",
          countryCode: "BE",
          city: "Brussels",
        }),
      }
    })

    const res = await lookupIpGeo(
      "195.10.10.10",
      mockFetch as unknown as typeof fetch
    )
    expect(fallbackCalledUrl.startsWith("http://ip-api.com/json/")).toBe(true)
    expect(res.countryCode).toBe("BE")
    expect(res.countryName).toBe("Belgium")
    expect(res.city).toBe("Brussels")
  })

  it("falls back to ip-api when primary API throws network error", async () => {
    const mockFetch = mock(async (url: string | URL | Request) => {
      const urlStr = String(url)
      if (urlStr.includes("api.findy.juniyadi.id")) {
        throw new Error("Network timeout")
      }
      return {
        ok: true,
        json: async () => ({
          status: "success",
          country: "Japan",
          countryCode: "JP",
          city: "Tokyo",
        }),
      }
    })

    const res = await lookupIpGeo(
      "133.1.2.3",
      mockFetch as unknown as typeof fetch
    )
    expect(res.countryCode).toBe("JP")
    expect(res.countryName).toBe("Japan")
    expect(res.city).toBe("Tokyo")
  })

  it("handles failure of both primary and fallback APIs gracefully", async () => {
    const mockFetch = mock(async () => {
      throw new Error("All endpoints down")
    })

    const res = await lookupIpGeo(
      "198.51.100.1",
      mockFetch as unknown as typeof fetch
    )
    expect(res.countryCode).toBe("UNKNOWN")
    expect(res.countryName).toBe("Tidak Diketahui")
  })

  it("enriches array of top IPs with Geo data", async () => {
    const mockFetch = mock(async (url: string | URL | Request) => {
      const urlStr = String(url)
      if (urlStr.includes("8.8.8.8")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            geo: { country: "US", city: "Mountain View" },
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          geo: { country: "ID", city: "Jakarta" },
        }),
      }
    })

    const items = [
      { ip: "8.8.8.8", count: 120 },
      { ip: "103.10.10.10", count: 50 },
    ]

    const enriched = await enrichTopIpsWithGeo(
      items,
      mockFetch as unknown as typeof fetch
    )
    expect(enriched.length).toBe(2)
    expect(enriched[0].countryCode).toBe("US")
    expect(enriched[0].requestsCount).toBe(120)
    expect(enriched[1].countryCode).toBe("ID")
    expect(enriched[1].requestsCount).toBe(50)
  })
})

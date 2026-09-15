import { describe, it, expect, mock } from "bun:test"
import { lookupIpGeo, enrichTopIpsWithGeo } from "./geoip-lookup.service"

describe("geoip-lookup.service", () => {
  it("resolves private IP as LOCAL immediately without network call", async () => {
    const mockFetch = mock()
    const res = await lookupIpGeo(
      "10.42.0.1",
      mockFetch as unknown as typeof fetch
    )
    expect(res.countryCode).toBe("LOCAL")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("resolves public IP using primary findy API", async () => {
    const mockFetch = mock(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        ip: "149.22.90.218",
        geo: { country: "SG", city: "Singapore" },
      }),
    }))

    const res = await lookupIpGeo(
      "149.22.90.218",
      mockFetch as unknown as typeof fetch
    )
    expect(res.countryCode).toBe("SG")
    expect(res.city).toBe("Singapore")
  })

  it("falls back to ip-api when primary API fails", async () => {
    const mockFetch = mock(async (url: string | URL | Request) => {
      const urlStr = String(url)
      if (urlStr.includes("api.findy.juniyadi.id")) {
        return { ok: false, status: 500 }
      }
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
      "1.1.1.1",
      mockFetch as unknown as typeof fetch
    )
    expect(res.countryCode).toBe("BE")
    expect(res.countryName).toBe("Belgium")
    expect(res.city).toBe("Brussels")
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

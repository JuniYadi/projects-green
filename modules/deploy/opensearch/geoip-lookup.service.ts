import { logger } from "@/lib/logger"

export interface IpGeoInfo {
  ip: string
  countryCode: string
  countryName: string
  city?: string
  requestsCount: number
  status2xx: number
  status3xx: number
  status4xx: number
  status5xx: number
  /** 2xx share of requestsCount, 0-100, one decimal. */
  successRatio: number
}

/** 2xx share of total requests, 0-100 rounded to one decimal. Empty totals read as 100% (no evidence of failure). */
export function computeSuccessRatio(status2xx: number, total: number): number {
  if (total <= 0) return 100
  return Math.round((status2xx / total) * 1000) / 10
}

const MAX_GEO_CACHE_SIZE = 5000
const geoCache = new Map<
  string,
  { countryCode: string; countryName: string; city?: string }
>()

function setCachedGeo(
  ip: string,
  value: { countryCode: string; countryName: string; city?: string }
): void {
  if (geoCache.size >= MAX_GEO_CACHE_SIZE) {
    const oldestKey = geoCache.keys().next().value
    if (oldestKey) {
      geoCache.delete(oldestKey)
    }
  }
  geoCache.set(ip, value)
}

const isPrivateOrInvalidIp = (ip: string): boolean => {
  if (!ip || ip === "-" || ip === "unknown") return true
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true
  if (/^fc00:|^fe80:/.test(ip)) return true
  return false
}

const resolveCountryName = (code: string, fallbackName?: string): string => {
  if (fallbackName && fallbackName !== code) return fallbackName
  if (!code || code === "UNKNOWN") return "Unknown"
  try {
    const regionNames = new Intl.DisplayNames(["id", "en"], { type: "region" })
    return regionNames.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/**
 * Resolves GeoIP data for a single IP address with primary findy API and fallback to ip-api.
 */
export async function lookupIpGeo(
  ip: string,
  fetchFn: typeof fetch = fetch
): Promise<{ countryCode: string; countryName: string; city?: string }> {
  if (isPrivateOrInvalidIp(ip)) {
    return {
      countryCode: "LOCAL",
      countryName: "Jaringan Internal",
      city: "Local",
    }
  }

  const cached = geoCache.get(ip)
  if (cached) {
    // Refresh LRU order
    geoCache.delete(ip)
    geoCache.set(ip, cached)
    return cached
  }

  // 1. Primary: findy.juniyadi.id
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2500)
    const res = await fetchFn(
      `https://api.findy.juniyadi.id/ip?ip=${encodeURIComponent(ip)}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }
    )
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = (await res.json()) as {
        success?: boolean
        geo?: { country?: string; city?: string }
      }
      if (data?.geo?.country) {
        const countryCode = data.geo.country.toUpperCase()
        const countryName = resolveCountryName(countryCode)
        const city = data.geo.city || undefined
        const result = { countryCode, countryName, city }
        setCachedGeo(ip, result)
        return result
      }
    }
  } catch (err) {
    logger.debug(
      { ip, error: err instanceof Error ? err.message : String(err) },
      "Primary GeoIP lookup failed, trying fallback"
    )
  }

  // 2. Fallback: ip-api.com over HTTP (free tier endpoints do not support HTTPS)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2500)
    const res = await fetchFn(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,city`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }
    )
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = (await res.json()) as {
        status?: string
        country?: string
        countryCode?: string
        city?: string
      }
      if (data.status === "success" && data.countryCode) {
        const countryCode = data.countryCode.toUpperCase()
        const countryName = data.country || resolveCountryName(countryCode)
        const city = data.city || undefined
        const result = { countryCode, countryName, city }
        setCachedGeo(ip, result)
        return result
      }
    }
  } catch (err) {
    logger.debug(
      { ip, error: err instanceof Error ? err.message : String(err) },
      "Fallback GeoIP lookup failed"
    )
  }

  const unknownResult = {
    countryCode: "UNKNOWN",
    countryName: "Tidak Diketahui",
  }
  setCachedGeo(ip, unknownResult)
  return unknownResult
}

/**
 * Enriches a list of { ip, count } into IpGeoInfo with parallel requests.
 */
export async function enrichTopIpsWithGeo(
  rawIps: Array<{
    ip: string
    count: number
    status2xx: number
    status3xx: number
    status4xx: number
    status5xx: number
  }>,
  fetchFn: typeof fetch = fetch
): Promise<IpGeoInfo[]> {
  const settled = await Promise.allSettled(
    rawIps.map(async (item) => {
      const geo = await lookupIpGeo(item.ip, fetchFn)
      return {
        ip: item.ip,
        requestsCount: item.count,
        countryCode: geo.countryCode,
        countryName: geo.countryName,
        city: geo.city,
        status2xx: item.status2xx,
        status3xx: item.status3xx,
        status4xx: item.status4xx,
        status5xx: item.status5xx,
        successRatio: computeSuccessRatio(item.status2xx, item.count),
      }
    })
  )

  return settled.map((res, idx) => {
    if (res.status === "fulfilled") return res.value
    const raw = rawIps[idx]
    return {
      ip: raw.ip,
      requestsCount: raw.count,
      countryCode: "UNKNOWN",
      countryName: "Tidak Diketahui",
      status2xx: raw.status2xx,
      status3xx: raw.status3xx,
      status4xx: raw.status4xx,
      status5xx: raw.status5xx,
      successRatio: computeSuccessRatio(raw.status2xx, raw.count),
    }
  })
}

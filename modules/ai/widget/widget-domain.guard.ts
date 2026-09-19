/**
 * Helper to validate incoming request Origin or Referer against agent's
 * allowedDomains list.
 *
 * Supported formats in allowedDomains:
 * - Empty array `[]`: Allow all origins
 * - Exact domains: `example.com`, `app.example.com`
 * - Wildcard subdomains: `*.example.com` (matches `sub.example.com`)
 * - Localhost with or without port: `localhost`, `localhost:*`, `127.0.0.1:*`
 * - Full URLs: `https://example.com:3000` (scheme and port normalized)
 */

function extractHostnameAndPort(
  rawOriginOrReferer: string
): { hostname: string; port: string; host: string } | null {
  const trimmed = rawOriginOrReferer.trim()
  if (!trimmed) {
    return null
  }

  try {
    const url = trimmed.includes("://")
      ? new URL(trimmed)
      : new URL(`http://${trimmed}`)

    const hostname = url.hostname.toLowerCase()
    const port = url.port || (url.protocol === "https:" ? "443" : "80")
    const host = url.port ? `${hostname}:${url.port}` : hostname

    return { hostname, port, host }
  } catch {
    // If URL parsing fails, perform simple string-based cleanup
    const withoutProto = trimmed.replace(/^[a-zA-Z]+:\/\//, "")
    const hostPart = withoutProto.split("/")[0]?.split("?")[0] || ""
    const [hostnameRaw, portRaw] = hostPart.split(":")
    const hostname = (hostnameRaw || "").toLowerCase()
    const port = portRaw || "80"
    const host = portRaw ? `${hostname}:${portRaw}` : hostname

    return hostname ? { hostname, port, host } : null
  }
}

function matchDomainPattern(
  originInfo: { hostname: string; port: string; host: string },
  pattern: string
): boolean {
  const trimmedPattern = pattern.trim().toLowerCase()
  if (!trimmedPattern) {
    return false
  }

  // Exact wildcard match
  if (trimmedPattern === "*") {
    return true
  }

  const cleanPattern =
    trimmedPattern.replace(/^[a-zA-Z]+:\/\//, "").split("/")[0] || ""

  // Localhost wildcard port match: e.g. localhost:* or 127.0.0.1:*
  if (cleanPattern.endsWith(":*")) {
    const patternHost = cleanPattern.slice(0, -2)
    return originInfo.hostname === patternHost
  }

  // Exact host match (including port if pattern specifies port)
  if (cleanPattern.includes(":")) {
    return (
      originInfo.host === cleanPattern ||
      `${originInfo.hostname}:${originInfo.port}` === cleanPattern
    )
  }

  // Wildcard subdomain matching: e.g. *.example.com
  if (cleanPattern.startsWith("*.")) {
    const baseDomain = cleanPattern.slice(2)
    return (
      originInfo.hostname === baseDomain ||
      originInfo.hostname.endsWith(`.${baseDomain}`)
    )
  }

  // Exact hostname match (ignores port if pattern has no port)
  return originInfo.hostname === cleanPattern
}

export function isAllowedOrigin(
  originOrReferer: string | null | undefined,
  allowedDomains: string[]
): boolean {
  // If allowedDomains is empty or contains "*", allow all
  if (!allowedDomains || allowedDomains.length === 0) {
    return true
  }

  if (allowedDomains.some((d) => d.trim() === "*")) {
    return true
  }

  if (!originOrReferer) {
    return false
  }

  const originInfo = extractHostnameAndPort(originOrReferer)
  if (!originInfo) {
    return false
  }

  return allowedDomains.some((pattern) =>
    matchDomainPattern(originInfo, pattern)
  )
}

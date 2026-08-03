import { isIP } from "node:net"

export type PublicGitUrl = { url: string; host: string } | { error: string }

const HOST_LABEL = /^(?=.{1,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i

function parseIPv4(value: string): number | null {
  const octets = value.split(".")
  if (octets.length !== 4 || octets.some((octet) => !/^\d+$/.test(octet))) {
    return null
  }

  const numbers = octets.map(Number)
  if (numbers.some((octet) => octet > 255)) {
    return null
  }

  return (
    ((numbers[0] << 24) |
      (numbers[1] << 16) |
      (numbers[2] << 8) |
      numbers[3]) >>>
    0
  )
}

function parseIPv6(value: string): number[] | null {
  const halves = value.split("::")
  if (halves.length > 2) {
    return null
  }

  const parseGroups = (part: string): number[] | null => {
    if (!part) {
      return []
    }

    const groups = part.split(":")
    const parsed: number[] = []
    for (const [index, group] of groups.entries()) {
      if (group.includes(".")) {
        const ipv4 = parseIPv4(group)
        if (ipv4 === null || index !== groups.length - 1) {
          return null
        }
        parsed.push(ipv4 >>> 16, ipv4 & 0xffff)
        continue
      }

      if (!/^[0-9a-f]{1,4}$/i.test(group)) {
        return null
      }
      parsed.push(Number.parseInt(group, 16))
    }
    return parsed
  }

  const left = parseGroups(halves[0])
  const right = parseGroups(halves[1] ?? "")
  if (!left || !right) {
    return null
  }

  const missing = 8 - left.length - right.length
  if (halves.length === 1 ? missing !== 0 : missing <= 0) {
    return null
  }

  return halves.length === 1
    ? left
    : [...left, ...Array(missing).fill(0), ...right]
}

function isBlockedIPv4(value: number): boolean {
  const first = value >>> 24
  const second = (value >>> 16) & 0xff
  const third = (value >>> 8) & 0xff

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first === 224 ||
    first >= 240 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 0 && third === 9) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113)
  )
}
function isBlockedIPv6(groups: number[]): boolean {
  if (
    groups.slice(0, 5).every((group) => group === 0) &&
    groups[5] === 0xffff
  ) {
    return isBlockedIPv4((groups[6] << 16) | groups[7])
  }

  return (
    groups.slice(0, 6).every((group) => group === 0) ||
    (groups[0] & 0xfe00) === 0xfc00 ||
    (groups[0] & 0xffc0) === 0xfe80 ||
    (groups[0] & 0xffc0) === 0xfec0 ||
    groups[0] >> 8 === 0xff ||
    (groups[0] === 0x2001 && groups[1] === 0x0db8) ||
    (groups[0] === 0x2001 && (groups[1] & 0xfff0) === 0x0010) ||
    (groups[0] === 0x2001 && groups[1] === 0x0002 && groups[2] === 0)
  )
}

function isValidDnsHost(host: string): boolean {
  const normalized = host.endsWith(".") ? host.slice(0, -1) : host
  if (normalized.length === 0 || normalized.length > 253) {
    return false
  }

  const labels = normalized.split(".")
  return labels.length >= 2 && labels.every((label) => HOST_LABEL.test(label))
}

function hasAuthorityCredentials(value: string): boolean {
  const authorityStart = value.indexOf("://") + 3
  const remainder = value.slice(authorityStart)
  const authorityEnd = remainder.search(/[/?#]/)
  const authority = remainder.slice(
    0,
    authorityEnd === -1 ? remainder.length : authorityEnd
  )
  return authority.includes("@")
}

export function parsePublicGitUrl(value: string): PublicGitUrl {
  const trimmed = value.trim()
  if (!/^https:\/\//i.test(trimmed)) {
    return { error: "Public Git URL must use HTTPS." }
  }
  if (/^https:\/\/[\/?#]/i.test(trimmed)) {
    return { error: "Public Git URL is malformed." }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { error: "Public Git URL is malformed." }
  }

  if (parsed.protocol !== "https:") {
    return { error: "Public Git URL must use HTTPS." }
  }
  if (hasAuthorityCredentials(trimmed)) {
    return { error: "Public Git URL must not include credentials." }
  }
  if (trimmed.includes("#")) {
    return { error: "Public Git URL must not include a fragment." }
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (!host || host === "localhost" || host.endsWith(".localhost")) {
    return { error: "Public Git URL has an invalid host." }
  }

  const ipVersion = isIP(host)
  if (ipVersion === 4) {
    const ip = parseIPv4(host)
    if (ip === null || isBlockedIPv4(ip)) {
      return { error: "Public Git URL host is not publicly routable." }
    }
  } else if (ipVersion === 6) {
    const ip = parseIPv6(host)
    if (ip === null || isBlockedIPv6(ip)) {
      return { error: "Public Git URL host is not publicly routable." }
    }
  } else if (!isValidDnsHost(host)) {
    return { error: "Public Git URL has an invalid host." }
  }

  return { url: parsed.href, host }
}

export function isPublicGitUrl(value: string): boolean {
  return !("error" in parsePublicGitUrl(value))
}

import { lookup } from "node:dns/promises"
import { BlockList, isIP } from "node:net"

type Resolve = (host: string) => Promise<{ address: string; family: number }[]>

// Loopback, private, link-local (cloud metadata), CGNAT, and other ranges a
// customer-supplied outbound URL must never reach. IPv4-mapped IPv6 addresses
// are matched against the IPv4 rules by BlockList itself.
const internal = new BlockList()
const IPV4_RANGES: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
]
const IPV6_RANGES: [string, number][] = [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
]
for (const [network, prefix] of IPV4_RANGES) {
  internal.addSubnet(network, prefix, "ipv4")
}
for (const [network, prefix] of IPV6_RANGES) {
  internal.addSubnet(network, prefix, "ipv6")
}

const resolveAll: Resolve = (host) => lookup(host, { all: true })

/**
 * Throws unless `rawUrl` is an http(s) URL whose host resolves only to public
 * addresses.
 *
 * ponytail: resolving before fetch leaves a DNS-rebinding window; pin the
 * resolved address in a custom fetch dispatcher if that attack matters.
 */
export async function assertPublicHttpUrl(
  rawUrl: string,
  resolve: Resolve = resolveAll
): Promise<void> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error("Outbound URL is not a valid URL.")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Outbound URL must use http or https.")
  }

  const host = url.hostname.replace(/^\[|\]$/g, "")
  const family = isIP(host)
  const addresses = family ? [{ address: host, family }] : await resolve(host)

  for (const { address, family: addressFamily } of addresses) {
    if (internal.check(address, addressFamily === 6 ? "ipv6" : "ipv4")) {
      throw new Error("Outbound URL resolves to a non-public address.")
    }
  }
}

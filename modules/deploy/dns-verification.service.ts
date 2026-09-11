import { promises as nodeDns } from "node:dns"

export type DnsProviderName = "google" | "cloudflare" | "node"
export type DnsRecordType = "CNAME" | "A" | "AAAA"
export type DnsVerificationStatus =
  "VERIFIED" | "PENDING" | "FAILED" | "INCONCLUSIVE"

export type DnsEvidence = {
  source: DnsProviderName
  recordType: DnsRecordType
  values: string[]
  outcome: "positive" | "missing" | "mismatch" | "error"
  ttl: number | null
  latencyMs: number | null
}

export type DnsVerificationResult = {
  status: DnsVerificationStatus
  reason: string
  checkedAt: Date
  evidence: DnsEvidence[]
  positiveSources: DnsProviderName[]
}

export type DnsVerificationInput = {
  hostname: string
  expectedCnameTarget?: string | null
  expectedIpv4Addresses?: string[]
  expectedIpv6Addresses?: string[]
}

type Lookup = (hostname: string, type: DnsRecordType) => Promise<unknown>
type NodeLookup = {
  resolveCname?: (hostname: string) => Promise<string[]>
  resolve4?: (hostname: string) => Promise<string[]>
  resolve6?: (hostname: string) => Promise<string[]>
}

export type DnsVerificationDependencies = {
  google?: Lookup
  cloudflare?: Lookup
  googleLookup?: Lookup
  cloudflareLookup?: Lookup
  node?: NodeLookup
  nodeDns?: NodeLookup
  fetch?: typeof fetch
  timeoutMs?: number
}

type SourceResult = {
  source: DnsProviderName
  records: Record<DnsRecordType, string[]>
  latencyMs: number | null
  error?: boolean
}

const DEFAULT_TIMEOUT_MS = 2500
const DOH_ENDPOINTS: Record<Exclude<DnsProviderName, "node">, string> = {
  google: "https://dns.google/resolve",
  cloudflare: "https://cloudflare-dns.com/dns-query",
}

function normalizeName(value: string): string {
  return value.trim().replace(/\.+$/, "").toLowerCase()
}

function normalizeAddress(value: string): string {
  return value.trim().replace(/\.+$/, "").toLowerCase()
}

function safeValues(value: unknown, type: DnsRecordType): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : []
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) =>
      type === "CNAME" ? normalizeName(item) : normalizeAddress(item)
    )
    .filter(Boolean)
    .slice(0, 32)
}

function parseDoH(payload: unknown, type: DnsRecordType): string[] {
  if (!payload || typeof payload !== "object") return []
  const answer = (payload as { Answer?: unknown }).Answer
  if (!Array.isArray(answer)) return []
  return safeValues(
    answer
      .filter(
        (item) =>
          item &&
          typeof item === "object" &&
          (item as { type?: number }).type ===
            { A: 1, CNAME: 5, AAAA: 28 }[type]
      )
      .map((item) => (item as { data?: unknown }).data),
    type
  )
}

async function dohLookup(
  provider: Exclude<DnsProviderName, "node">,
  hostname: string,
  type: DnsRecordType,
  deps: DnsVerificationDependencies
): Promise<string[]> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    deps.timeoutMs ?? DEFAULT_TIMEOUT_MS
  )
  try {
    const requestFetch = deps.fetch ?? fetch
    const url = `${DOH_ENDPOINTS[provider]}?name=${encodeURIComponent(hostname)}&type=${type}`
    const response = await requestFetch(url, {
      headers: { accept: "application/dns-json" },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP_${response.status}`)
    return parseDoH(await response.json(), type)
  } finally {
    clearTimeout(timeout)
  }
}

async function lookupSource(
  source: DnsProviderName,
  input: DnsVerificationInput,
  deps: DnsVerificationDependencies
): Promise<SourceResult> {
  const records = { CNAME: [], A: [], AAAA: [] } as Record<
    DnsRecordType,
    string[]
  >
  const startedAt = Date.now()
  try {
    const lookup =
      source === "google"
        ? (deps.google ??
          deps.googleLookup ??
          ((h, t) => dohLookup("google", h, t, deps)))
        : source === "cloudflare"
          ? (deps.cloudflare ??
            deps.cloudflareLookup ??
            ((h, t) => dohLookup("cloudflare", h, t, deps)))
          : null
    if (lookup) {
      for (const type of ["CNAME", "A", "AAAA"] as const) {
        records[type] = safeValues(await lookup(input.hostname, type), type)
      }
    } else {
      const dns = deps.node ?? deps.nodeDns ?? nodeDns
      records.CNAME = safeValues(
        await (dns.resolveCname?.(input.hostname) ?? Promise.resolve([])),
        "CNAME"
      )
      records.A = safeValues(
        await (dns.resolve4?.(input.hostname) ?? Promise.resolve([])),
        "A"
      )
      records.AAAA = safeValues(
        await (dns.resolve6?.(input.hostname) ?? Promise.resolve([])),
        "AAAA"
      )
    }
    return { source, records, latencyMs: Date.now() - startedAt }
  } catch {
    return { source, records, latencyMs: Date.now() - startedAt, error: true }
  }
}

export async function verifyDnsTarget(
  input: DnsVerificationInput,
  dependencies: DnsVerificationDependencies = {}
): Promise<DnsVerificationResult> {
  const checkedAt = new Date()
  const hostname = normalizeName(input.hostname)
  const expectedCname = input.expectedCnameTarget
    ? normalizeName(input.expectedCnameTarget)
    : null
  const expected4 = new Set(
    (input.expectedIpv4Addresses ?? []).map(normalizeAddress)
  )
  const expected6 = new Set(
    (input.expectedIpv6Addresses ?? []).map(normalizeAddress)
  )
  const publicResults = await Promise.all([
    lookupSource("google", { ...input, hostname }, dependencies),
    lookupSource("cloudflare", { ...input, hostname }, dependencies),
  ])
  const publicFailed = publicResults.some((result) => result.error)
  const results = publicFailed
    ? [
        ...publicResults,
        await lookupSource("node", { ...input, hostname }, dependencies),
      ]
    : publicResults
  const evidence: DnsEvidence[] = []
  const positive = new Set<DnsProviderName>()
  let hasMismatch = false
  let hasMissing = false
  let hasError = false

  for (const result of results) {
    if (result.error) {
      hasError = true
      for (const type of ["CNAME", "A", "AAAA"] as const) {
        evidence.push({
          source: result.source,
          recordType: type,
          values: [],
          outcome: "error",
          ttl: null,
          latencyMs: result.latencyMs,
        })
      }
      continue
    }
    const cnameMatch =
      expectedCname !== null && result.records.CNAME.includes(expectedCname)
    const addressMatch =
      [...result.records.A].some((v) => expected4.has(v)) ||
      [...result.records.AAAA].some((v) => expected6.has(v))
    const sourcePositive =
      expectedCname !== null ? cnameMatch || addressMatch : addressMatch
    for (const type of ["CNAME", "A", "AAAA"] as const) {
      const values = result.records[type]
      const matches =
        type === "CNAME"
          ? expectedCname !== null && values.includes(expectedCname)
          : type === "A"
            ? values.some((value) => expected4.has(value))
            : values.some((value) => expected6.has(value))
      evidence.push({
        source: result.source,
        recordType: type,
        values,
        outcome: matches ? "positive" : values.length ? "mismatch" : "missing",
        ttl: null,
        latencyMs: result.latencyMs,
      })
      if (values.length === 0) hasMissing = true
      else if (!matches) hasMismatch = true
    }
    if (sourcePositive) positive.add(result.source)
  }
  const positiveSources = [...positive]
  const hasPositiveQuorum = positiveSources.length >= 2
  let status: DnsVerificationStatus
  let reason: string
  if (hasPositiveQuorum) {
    status = "VERIFIED"
    reason = "Two independent DNS sources matched the target."
  } else if (
    positiveSources.length === 1 &&
    hasError &&
    positiveSources[0] === "node"
  ) {
    status = "PENDING"
    reason = "Node DNS matched, but public DNS sources were unavailable."
  } else if (positiveSources.length === 1 && hasError) {
    status = "PENDING"
    reason = "One DNS source matched; another source failed."
  } else if (
    positiveSources.length > 0 &&
    hasMismatch &&
    positiveSources.length < 2
  ) {
    status = "INCONCLUSIVE"
    reason = "DNS sources disagree about the target."
  } else if (hasError && positiveSources.length === 0) {
    status = "PENDING"
    reason = "DNS providers failed without a conclusive answer."
  } else if (hasMismatch) {
    status = "FAILED"
    reason = "DNS records were found but did not match the target."
  } else if (hasMissing) {
    status = "PENDING"
    reason = "DNS records are not published yet (NXDOMAIN/NODATA)."
  } else {
    status = "PENDING"
    reason = "DNS verification is inconclusive."
  }
  return { status, reason, checkedAt, evidence, positiveSources }
}

import type { EnvVarType } from "@/modules/deploy/deploy.types"

export type K8sEnvironmentId = "dev" | "staging" | "prod"

export type K8sEnvironment = {
  id: K8sEnvironmentId
  label: string
  description: string
  color: string
}

export type AppStatusType =
  "healthy" | "degraded" | "inaccessible" | "deploying"

export type CustomDomain = {
  id: string
  domain: string
  isPrimary: boolean
  tlsStatus: "active" | "expired" | "pending"
  dnsStatus: "verified" | "unverified"
  expiresAt: string
}

export type DomainKind = "MANAGED" | "CUSTOM"

export type DomainCertificateDTO = {
  source: string | null
  status: string | null
  expiresAt: string | null
  fingerprint: string | null
  validationError: string | null
}

export type DomainEndpointDTO = {
  managedBaseDomain: string | null
  cnameTarget: string | null
  ipv4Addresses: string[]
  ipv6Addresses: string[]
}

export type DomainClusterDTO = {
  id: string
  code: string
  name: string
  region: string
}

export type DomainAllowlistMode = "OPEN" | "ALLOWLIST_ONLY"

export type DomainAllowlistEntryDTO = {
  id: string
  cidr: string
  label?: string | null
  description?: string | null
  enabled?: boolean
  position?: number
}

export type DnsResolverEvidence = {
  provider: "google" | "cloudflare" | "node"
  recordType: "CNAME" | "A" | "AAAA"
  outcome: "MATCH" | "MISMATCH" | "MISSING" | "ERROR"
  answers: string[]
  ttl?: number | null
  latencyMs?: number | null
  errorCode?: string
}

export type TenantDomainDTO = {
  id: string
  hostname: string
  kind: DomainKind
  isPrimary: boolean
  cluster: DomainClusterDTO | null
  dnsStatus: string
  expectedCnameTarget: string | null
  verifiedAt?: string | Date | null
  dnsLastCheckedAt?: string | Date | null
  dnsVerificationReason?: string | null
  dnsResolverEvidence?: DnsResolverEvidence[]
  endpoint: DomainEndpointDTO | null
  certificate: DomainCertificateDTO | null
  allowlistMode: DomainAllowlistMode
  allowlistEntries: DomainAllowlistEntryDTO[]
}
export type EnvVar = {
  id: string
  key: string
  value: string
  isSecret: boolean
  updatedAt: string
  type?: EnvVarType
  scope?: "all" | "build" | "runtime"
  masked?: boolean
  isStoredSecret?: boolean
  source?: "vault" | "managed_service"
  serviceCredentialId?: string
  vaultPath?: string
  vaultKey?: string
  version?: number
  referenceLabel?: string
}

export type VolumeMount = {
  id: string
  name: string
  mountPath: string
  sourceType: "secret" | "configmap" | "pvc" | "emptyDir"
  fileMode: string
  readOnly: boolean
  contentSummary: string
  content?: string
}

export type LogMessage = {
  timestamp: string
  level: "INFO" | "WARN" | "ERROR"
  source: string
  message: string
}

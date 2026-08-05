import type {
  ApplicationDomainAllowlistMode,
  ApplicationDomainCertificateSource,
  ApplicationDomainCertificateStatus,
  ApplicationDomainDnsStatus,
  ApplicationDomainKind,
} from "@prisma/client"

export type {
  ApplicationDomainAllowlistMode,
  ApplicationDomainCertificateSource,
  ApplicationDomainCertificateStatus,
  ApplicationDomainDnsStatus,
  ApplicationDomainKind,
} from "@prisma/client"

export type AppHostingClusterSummaryDTO = {
  id: string
  code: string
  name: string
  region: string
}

export type AppHostingClusterEndpointDTO = {
  id: string
  clusterId: string
  managedBaseDomain: string
  cnameTarget: string
  ipv4Addresses: string[]
  ipv6Addresses: string[]
  isActive: boolean
}

export type ApplicationDomainCertificateDTO = {
  id: string
  domainId: string
  source: ApplicationDomainCertificateSource
  status: ApplicationDomainCertificateStatus
  expiresAt: Date | null
  fingerprint: string | null
  validationError: string | null
  createdAt: Date
  updatedAt: Date
}

export type ApplicationDomainAllowlistEntryDTO = {
  id: string
  domainId: string
  cidr: string
  description: string | null
  enabled: boolean
  position: number
  createdAt: Date
  updatedAt: Date
}

export type ApplicationDomainDTO = {
  id: string
  stackId: string
  clusterId: string
  hostname: string
  kind: ApplicationDomainKind
  isPrimary: boolean
  cluster: AppHostingClusterSummaryDTO | null
  dnsStatus: ApplicationDomainDnsStatus
  expectedCnameTarget: string
  verifiedAt: Date | null
  allowlistMode: ApplicationDomainAllowlistMode
  endpoint: AppHostingClusterEndpointDTO
  certificate: ApplicationDomainCertificateDTO | null
  allowlistEntries: ApplicationDomainAllowlistEntryDTO[]
  createdAt: Date
  updatedAt: Date
}

export type DomainDnsInstructions = {
  hostname: string
  cnameTarget: string
  ipv4Addresses: string[]
  ipv6Addresses: string[]
}

export type ApplicationDomainAllowlistDTO = {
  domainId: string
  mode: ApplicationDomainAllowlistMode
  entries: ApplicationDomainAllowlistEntryDTO[]
}

export type ListDomainsForStackInput = {
  organizationId: string
  slug: string
}

export type CreateDomainForStackInput = {
  organizationId: string
  slug: string
  hostname?: string
  kind: ApplicationDomainKind
  isPrimary?: boolean
}

export type DomainForStackInput = {
  organizationId: string
  slug: string
  domainId: string
}

export type UploadDomainCertificateInput = DomainForStackInput & {
  certificate: string
  privateKey: string
  chain?: string
}

export type UpdateAllowlistInput = DomainForStackInput & {
  mode: ApplicationDomainAllowlistMode
}

export type AddAllowlistEntryInput = DomainForStackInput & {
  cidr: string
  description?: string
  enabled?: boolean
  position?: number
}

export type DeleteAllowlistEntryInput = DomainForStackInput & {
  entryId: string
}

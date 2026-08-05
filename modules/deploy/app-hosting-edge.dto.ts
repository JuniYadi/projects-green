import type {
  AppHostingCluster,
  AppHostingClusterEndpoint,
  ApplicationDomain,
  ApplicationDomainAllowlistEntry,
  ApplicationDomainCertificate,
} from "@prisma/client"
import type {
  ApplicationDomainAllowlistEntryDTO,
  ApplicationDomainCertificateDTO,
  ApplicationDomainDTO,
  AppHostingClusterEndpointDTO,
  AppHostingClusterSummaryDTO,
} from "./app-hosting-edge.types"

export const toAppHostingClusterEndpointDTO = (
  endpoint: Pick<
    AppHostingClusterEndpoint,
    | "id"
    | "clusterId"
    | "managedBaseDomain"
    | "cnameTarget"
    | "ipv4Addresses"
    | "ipv6Addresses"
    | "isActive"
  >
): AppHostingClusterEndpointDTO => ({
  id: endpoint.id,
  clusterId: endpoint.clusterId,
  managedBaseDomain: endpoint.managedBaseDomain,
  cnameTarget: endpoint.cnameTarget,
  ipv4Addresses: [...endpoint.ipv4Addresses],
  ipv6Addresses: [...endpoint.ipv6Addresses],
  isActive: endpoint.isActive,
})

export const toApplicationDomainCertificateDTO = (
  certificate: Pick<
    ApplicationDomainCertificate,
    | "id"
    | "domainId"
    | "source"
    | "status"
    | "expiresAt"
    | "fingerprint"
    | "validationError"
    | "createdAt"
    | "updatedAt"
  > | null
): ApplicationDomainCertificateDTO | null =>
  certificate
    ? {
        id: certificate.id,
        domainId: certificate.domainId,
        source: certificate.source,
        status: certificate.status,
        expiresAt: certificate.expiresAt,
        fingerprint: certificate.fingerprint,
        validationError: certificate.validationError,
        createdAt: certificate.createdAt,
        updatedAt: certificate.updatedAt,
      }
    : null

export const toApplicationDomainAllowlistEntryDTO = (
  entry: Pick<
    ApplicationDomainAllowlistEntry,
    | "id"
    | "domainId"
    | "cidr"
    | "description"
    | "enabled"
    | "position"
    | "createdAt"
    | "updatedAt"
  >
): ApplicationDomainAllowlistEntryDTO => ({
  id: entry.id,
  domainId: entry.domainId,
  cidr: entry.cidr,
  description: entry.description,
  enabled: entry.enabled,
  position: entry.position,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
})

type DomainWithRelations = Pick<
  ApplicationDomain,
  | "id"
  | "stackId"
  | "clusterId"
  | "hostname"
  | "kind"
  | "isPrimary"
  | "dnsStatus"
  | "expectedCnameTarget"
  | "verifiedAt"
  | "allowlistMode"
  | "createdAt"
  | "updatedAt"
> & {
  certificate?: ApplicationDomainCertificate | null
  allowlistEntries?: ApplicationDomainAllowlistEntry[]
  cluster?: Pick<AppHostingCluster, "id" | "code" | "name" | "region"> | null
}

export const toApplicationDomainDTO = (
  domain: DomainWithRelations,
  endpoint: AppHostingClusterEndpoint
): ApplicationDomainDTO => ({
  id: domain.id,
  stackId: domain.stackId,
  clusterId: domain.clusterId,
  hostname: domain.hostname,
  kind: domain.kind,
  isPrimary: domain.isPrimary,
  cluster: domain.cluster
    ? {
        id: domain.cluster.id,
        code: domain.cluster.code,
        name: domain.cluster.name,
        region: domain.cluster.region,
      }
    : null,
  dnsStatus: domain.dnsStatus,
  expectedCnameTarget: domain.expectedCnameTarget,
  verifiedAt: domain.verifiedAt,
  allowlistMode: domain.allowlistMode,
  endpoint: toAppHostingClusterEndpointDTO(endpoint),
  certificate: toApplicationDomainCertificateDTO(domain.certificate ?? null),
  allowlistEntries: (domain.allowlistEntries ?? [])
    .map(toApplicationDomainAllowlistEntryDTO)
    .sort((a, b) => a.position - b.position || a.cidr.localeCompare(b.cidr)),
  createdAt: domain.createdAt,
  updatedAt: domain.updatedAt,
})

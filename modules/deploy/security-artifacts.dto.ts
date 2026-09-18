import type {
  ApplicationContainerImage,
  ApplicationSecurityScan,
  SecurityScanFinding,
  SecurityVulnerability,
  ContainerImageStatus,
  SecurityScanStatus,
  VulnerabilitySeverity,
} from "@prisma/client"

export type SecurityScanSummaryDTO = {
  id: string
  imageId: string
  imageTag: string
  status: SecurityScanStatus
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  unfixedCount: number
  scannerEngine: string
  scannerVersion: string
  scannedAt: string
}

export type ContainerImageDTO = {
  id: string
  stackId: string
  deploymentId: string | null
  buildNumber: number
  imageTag: string
  digest: string | null
  sizeBytes: string | null
  status: ContainerImageStatus
  pushedAt: string
  rotatedAt: string | null
  purgedAt: string | null
  securityScan: SecurityScanSummaryDTO | null
}

export type SecurityVulnerabilityDTO = {
  cveId: string
  title: string
  description: string | null
  severity: VulnerabilitySeverity
  cvssScore: number | null
  primaryUrl: string | null
}

export type SecurityScanFindingDTO = {
  id: string
  scanId: string
  cveId: string
  severity: VulnerabilitySeverity
  packageName: string
  installedVersion: string
  fixedVersion: string | null
  sourceTarget: string
  class: string
  introducedBy: string | null
  createdAt: string
  vulnerability?: SecurityVulnerabilityDTO
}

export function toSecurityScanSummaryDTO(
  scan: ApplicationSecurityScan
): SecurityScanSummaryDTO {
  return {
    id: scan.id,
    imageId: scan.imageId,
    imageTag: scan.imageTag,
    status: scan.status,
    criticalCount: scan.criticalCount,
    highCount: scan.highCount,
    mediumCount: scan.mediumCount,
    lowCount: scan.lowCount,
    unfixedCount: scan.unfixedCount,
    scannerEngine: scan.scannerEngine,
    scannerVersion: scan.scannerVersion,
    scannedAt: scan.scannedAt.toISOString(),
  }
}

export function toContainerImageDTO(
  image: ApplicationContainerImage & {
    securityScan?: ApplicationSecurityScan | null
  }
): ContainerImageDTO {
  return {
    id: image.id,
    stackId: image.stackId,
    deploymentId: image.deploymentId,
    buildNumber: image.buildNumber,
    imageTag: image.imageTag,
    digest: image.digest,
    sizeBytes: image.sizeBytes !== null ? image.sizeBytes.toString() : null,
    status: image.status,
    pushedAt: image.pushedAt.toISOString(),
    rotatedAt: image.rotatedAt ? image.rotatedAt.toISOString() : null,
    purgedAt: image.purgedAt ? image.purgedAt.toISOString() : null,
    securityScan: image.securityScan
      ? toSecurityScanSummaryDTO(image.securityScan)
      : null,
  }
}

export function toSecurityScanFindingDTO(
  finding: SecurityScanFinding & {
    vulnerability?: SecurityVulnerability | null
  }
): SecurityScanFindingDTO {
  return {
    id: finding.id,
    scanId: finding.scanId,
    cveId: finding.cveId,
    severity: finding.severity,
    packageName: finding.packageName,
    installedVersion: finding.installedVersion,
    fixedVersion: finding.fixedVersion,
    sourceTarget: finding.sourceTarget,
    class: finding.class,
    introducedBy: finding.introducedBy,
    createdAt: finding.createdAt.toISOString(),
    vulnerability: finding.vulnerability
      ? {
          cveId: finding.vulnerability.cveId,
          title: finding.vulnerability.title,
          description: finding.vulnerability.description,
          severity: finding.vulnerability.severity,
          cvssScore: finding.vulnerability.cvssScore,
          primaryUrl: finding.vulnerability.primaryUrl,
        }
      : undefined,
  }
}

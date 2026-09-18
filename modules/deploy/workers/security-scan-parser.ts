import type { VulnerabilitySeverity } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getS3Client } from "@/lib/storage/s3-storage"
import { logger } from "@/lib/logger"

export type ParsedVulnerabilityRecord = {
  cveId: string
  packageName: string
  installedVersion: string
  fixedVersion: string | null
  sourceTarget: string
  class: string
  introducedBy: string | null
  severity: VulnerabilitySeverity
  title: string
  description: string | null
  primaryUrl: string | null
  cvssScore: number | null
}

export function mapTrivySeverity(rawSeverity?: string): VulnerabilitySeverity {
  const normalized = (rawSeverity || "").toUpperCase().trim()
  switch (normalized) {
    case "CRITICAL":
      return "CRITICAL"
    case "HIGH":
      return "HIGH"
    case "MEDIUM":
      return "MEDIUM"
    case "LOW":
      return "LOW"
    default:
      return "UNKNOWN"
  }
}

export function parseTrivyJsonReport(
  rawJsonText: string
): ParsedVulnerabilityRecord[] {
  let json: Record<string, unknown>
  try {
    json = JSON.parse(rawJsonText)
  } catch (error) {
    logger.warn({ err: error }, "[security-scan-parser] Invalid JSON report")
    return []
  }

  const results = Array.isArray(json.Results) ? json.Results : []
  const records: ParsedVulnerabilityRecord[] = []

  for (const res of results) {
    if (typeof res !== "object" || res === null) continue
    const resultObj = res as Record<string, unknown>
    const target =
      typeof resultObj.Target === "string" ? resultObj.Target : "Unknown Target"
    const pkgClass =
      typeof resultObj.Class === "string" ? resultObj.Class : "unknown"

    const vulnerabilities = Array.isArray(resultObj.Vulnerabilities)
      ? resultObj.Vulnerabilities
      : []

    for (const vuln of vulnerabilities) {
      if (typeof vuln !== "object" || vuln === null) continue
      const v = vuln as Record<string, unknown>

      const cveId =
        typeof v.VulnerabilityID === "string" ? v.VulnerabilityID : null
      const packageName = typeof v.PkgName === "string" ? v.PkgName : null

      if (!cveId || !packageName) continue

      const installedVersion =
        typeof v.InstalledVersion === "string" ? v.InstalledVersion : "unknown"
      const fixedVersion =
        typeof v.FixedVersion === "string" ? v.FixedVersion : null
      const severity = mapTrivySeverity(
        typeof v.Severity === "string" ? v.Severity : undefined
      )
      const title =
        typeof v.Title === "string" && v.Title.trim() ? v.Title : cveId
      const description =
        typeof v.Description === "string" ? v.Description : null
      const primaryUrl =
        typeof v.PrimaryURL === "string" ? v.PrimaryURL : null

      let cvssScore: number | null = null
      if (typeof v.CVSS === "object" && v.CVSS !== null) {
        const cvssObj = v.CVSS as Record<string, Record<string, unknown>>
        const nvd = cvssObj.nvd || cvssObj.redhat || cvssObj.ghsa
        if (nvd && typeof nvd.V3Score === "number") {
          cvssScore = nvd.V3Score
        }
      }

      // Origin & Ancestry
      let introducedBy: string | null = null
      if (pkgClass === "lang-pkgs") {
        if (typeof v.PkgPath === "string" && v.PkgPath) {
          introducedBy = v.PkgPath
        } else {
          introducedBy = `App Dependency (${target})`
        }
      }

      records.push({
        cveId,
        packageName,
        installedVersion,
        fixedVersion,
        sourceTarget: target,
        class: pkgClass,
        introducedBy,
        severity,
        title,
        description,
        primaryUrl,
        cvssScore,
      })
    }
  }

  return records
}

export async function processSecurityScanReport(
  scanId: string,
  storageKey: string
): Promise<{ processedCount: number }> {
  const scan = await prisma.applicationSecurityScan.findUnique({
    where: { id: scanId },
  })

  if (!scan) {
    logger.warn(
      { scanId, storageKey },
      "[security-scan-parser] Scan record not found"
    )
    return { processedCount: 0 }
  }

  let rawJsonText: string
  try {
    const s3Client = getS3Client()
    const s3File = s3Client.file(storageKey)
    rawJsonText = await s3File.text()
  } catch (error) {
    logger.error(
      { err: error, scanId, storageKey },
      "[security-scan-parser] Failed to read report from storage"
    )
    return { processedCount: 0 }
  }

  const findings = parseTrivyJsonReport(rawJsonText)
  if (findings.length === 0) {
    return { processedCount: 0 }
  }

  // Batch insert vulnerabilities & findings
  for (const finding of findings) {
    try {
      // 1. Global CVE catalog
      await prisma.securityVulnerability.upsert({
        where: { cveId: finding.cveId },
        update: {
          title: finding.title,
          description: finding.description,
          severity: finding.severity,
          cvssScore: finding.cvssScore,
          primaryUrl: finding.primaryUrl,
        },
        create: {
          cveId: finding.cveId,
          title: finding.title,
          description: finding.description,
          severity: finding.severity,
          cvssScore: finding.cvssScore,
          primaryUrl: finding.primaryUrl,
        },
      })

      // 2. Scan finding join record
      await prisma.securityScanFinding.upsert({
        where: {
          scanId_cveId_packageName: {
            scanId,
            cveId: finding.cveId,
            packageName: finding.packageName,
          },
        },
        update: {
          installedVersion: finding.installedVersion,
          fixedVersion: finding.fixedVersion,
          sourceTarget: finding.sourceTarget,
          class: finding.class,
          introducedBy: finding.introducedBy,
          severity: finding.severity,
        },
        create: {
          scanId,
          cveId: finding.cveId,
          packageName: finding.packageName,
          installedVersion: finding.installedVersion,
          fixedVersion: finding.fixedVersion,
          sourceTarget: finding.sourceTarget,
          class: finding.class,
          introducedBy: finding.introducedBy,
          severity: finding.severity,
        },
      })
    } catch (upsertError) {
      logger.error(
        { err: upsertError, scanId, cveId: finding.cveId },
        "[security-scan-parser] Failed to upsert vulnerability finding"
      )
    }
  }

  logger.info(
    { scanId, count: findings.length },
    "[security-scan-parser] Successfully parsed and stored scan findings"
  )

  return { processedCount: findings.length }
}

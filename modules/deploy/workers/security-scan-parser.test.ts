import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockPrisma = {
  applicationSecurityScan: {
    findUnique: mock(),
  },
  securityVulnerability: {
    upsert: mock(),
  },
  securityScanFinding: {
    upsert: mock(),
  },
}

const mockS3File = {
  text: mock(),
}

const mockS3Client = {
  file: mock(() => mockS3File),
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/lib/storage/s3-storage", () => ({
  getS3Client: () => mockS3Client,
}))

const {
  mapTrivySeverity,
  parseTrivyJsonReport,
  processSecurityScanReport,
} = await import("./security-scan-parser")

describe("security-scan-parser", () => {
  beforeEach(() => {
    mockPrisma.applicationSecurityScan.findUnique.mockClear()
    mockPrisma.securityVulnerability.upsert.mockClear()
    mockPrisma.securityScanFinding.upsert.mockClear()
    mockS3File.text.mockClear()
  })

  it("correctly maps raw severity strings to VulnerabilitySeverity enums", () => {
    expect(mapTrivySeverity("CRITICAL")).toBe("CRITICAL")
    expect(mapTrivySeverity("high")).toBe("HIGH")
    expect(mapTrivySeverity("Medium")).toBe("MEDIUM")
    expect(mapTrivySeverity("LOW")).toBe("LOW")
    expect(mapTrivySeverity("invalid")).toBe("UNKNOWN")
    expect(mapTrivySeverity(undefined)).toBe("UNKNOWN")
  })

  it("parses Trivy JSON output distinguishing OS packages from App dependencies", () => {
    const trivyOutput = JSON.stringify({
      Results: [
        {
          Target: "composer.lock",
          Class: "lang-pkgs",
          Type: "composer",
          Vulnerabilities: [
            {
              VulnerabilityID: "CVE-2026-1542",
              PkgName: "guzzlehttp/psr7",
              InstalledVersion: "7.14.0",
              FixedVersion: "7.15.1",
              Severity: "HIGH",
              Title: "Header injection in guzzlehttp/psr7",
              PrimaryURL: "https://github.com/advisories/GHSA-1542",
              CVSS: { nvd: { V3Score: 7.5 } },
            },
          ],
        },
        {
          Target: "alpine 3.20",
          Class: "os-pkgs",
          Type: "alpine",
          Vulnerabilities: [
            {
              VulnerabilityID: "CVE-2026-0812",
              PkgName: "openssl",
              InstalledVersion: "3.1.2-r0",
              FixedVersion: "3.1.2-r1",
              Severity: "MEDIUM",
              Title: "OpenSSL timing vulnerability",
            },
          ],
        },
      ],
    })

    const records = parseTrivyJsonReport(trivyOutput)
    expect(records).toHaveLength(2)

    // Check App Dependency
    const appDep = records.find((r) => r.cveId === "CVE-2026-1542")
    expect(appDep).toBeDefined()
    expect(appDep?.packageName).toBe("guzzlehttp/psr7")
    expect(appDep?.severity).toBe("HIGH")
    expect(appDep?.class).toBe("lang-pkgs")
    expect(appDep?.introducedBy).toContain("composer.lock")
    expect(appDep?.cvssScore).toBe(7.5)

    // Check OS Package (introducedBy is null for OS packages)
    const osPkg = records.find((r) => r.cveId === "CVE-2026-0812")
    expect(osPkg).toBeDefined()
    expect(osPkg?.packageName).toBe("openssl")
    expect(osPkg?.severity).toBe("MEDIUM")
    expect(osPkg?.class).toBe("os-pkgs")
    expect(osPkg?.introducedBy).toBeNull()
  })

  it("reads report from storage and upserts records into Prisma", async () => {
    mockPrisma.applicationSecurityScan.findUnique.mockResolvedValue({
      id: "scan-123",
      organizationId: "org-1",
      storageKey: "tenants/org-1/scan-123.json",
    })

    mockS3File.text.mockResolvedValue(
      JSON.stringify({
        Results: [
          {
            Target: "package.json",
            Class: "lang-pkgs",
            Vulnerabilities: [
              {
                VulnerabilityID: "CVE-2026-9999",
                PkgName: "next",
                InstalledVersion: "15.0.0",
                Severity: "LOW",
              },
            ],
          },
        ],
      })
    )

    mockPrisma.securityVulnerability.upsert.mockResolvedValue({})
    mockPrisma.securityScanFinding.upsert.mockResolvedValue({})

    const result = await processSecurityScanReport(
      "scan-123",
      "tenants/org-1/scan-123.json"
    )

    expect(result.processedCount).toBe(1)
    expect(mockPrisma.securityVulnerability.upsert).toHaveBeenCalledWith({
      where: { cveId: "CVE-2026-9999" },
      update: expect.any(Object),
      create: expect.any(Object),
    })
    expect(mockPrisma.securityScanFinding.upsert).toHaveBeenCalledWith({
      where: {
        scanId_cveId_packageName: {
          scanId: "scan-123",
          cveId: "CVE-2026-9999",
          packageName: "next",
        },
      },
      update: expect.any(Object),
      create: expect.any(Object),
    })
  })
})

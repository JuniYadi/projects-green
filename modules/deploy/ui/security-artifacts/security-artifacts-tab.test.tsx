import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, fireEvent } from "@testing-library/react"
import { SecurityArtifactsTab } from "./security-artifacts-tab"
import type {
  ContainerImageDTO,
  SecurityScanFindingDTO,
} from "@/modules/deploy/security-artifacts.dto"

afterEach(cleanup)

const sampleImages: ContainerImageDTO[] = [
  {
    id: "img-2",
    stackId: "stack-1",
    deploymentId: "dep-2",
    buildNumber: 2,
    imageTag: "2",
    digest: "sha256:4f866c933a111",
    sizeBytes: "142000000",
    status: "ACTIVE",
    pushedAt: new Date("2026-09-19T10:00:00Z").toISOString(),
    rotatedAt: null,
    purgedAt: null,
    securityScan: {
      id: "scan-2",
      imageId: "img-2",
      imageTag: "2",
      status: "WARNING",
      criticalCount: 0,
      highCount: 2,
      mediumCount: 5,
      lowCount: 12,
      unfixedCount: 2,
      scannerEngine: "trivy",
      scannerVersion: "0.73.0",
      scannedAt: new Date("2026-09-19T10:02:00Z").toISOString(),
    },
  },
  {
    id: "img-1",
    stackId: "stack-1",
    deploymentId: "dep-1",
    buildNumber: 1,
    imageTag: "1",
    digest: "sha256:9202be111222",
    sizeBytes: "138000000",
    status: "READY",
    pushedAt: new Date("2026-09-19T08:00:00Z").toISOString(),
    rotatedAt: null,
    purgedAt: null,
    securityScan: null,
  },
  {
    id: "img-0",
    stackId: "stack-1",
    deploymentId: null,
    buildNumber: 0,
    imageTag: "0",
    digest: "sha256:06677b333444",
    sizeBytes: "135000000",
    status: "EXPIRED",
    pushedAt: new Date("2026-09-16T08:00:00Z").toISOString(),
    rotatedAt: new Date("2026-09-19T10:00:00Z").toISOString(),
    purgedAt: null,
    securityScan: null,
  },
]

const sampleFindings: SecurityScanFindingDTO[] = [
  {
    id: "f-1",
    scanId: "scan-2",
    cveId: "CVE-2026-1542",
    severity: "HIGH",
    packageName: "guzzlehttp/psr7",
    installedVersion: "7.14.0",
    fixedVersion: "7.15.1",
    sourceTarget: "composer.lock",
    class: "lang-pkgs",
    introducedBy: "laravel/framework:11.56.0",
    createdAt: new Date().toISOString(),
  },
  {
    id: "f-2",
    scanId: "scan-2",
    cveId: "CVE-2026-0812",
    severity: "HIGH",
    packageName: "openssl",
    installedVersion: "3.1.2-r0",
    fixedVersion: "3.1.2-r1",
    sourceTarget: "alpine 3.20",
    class: "os-pkgs",
    introducedBy: null,
    createdAt: new Date().toISOString(),
  },
]

describe("SecurityArtifactsTab", () => {
  it("renders repository metadata, retained images table, and free tier notice", () => {
    const view = render(
      <SecurityArtifactsTab
        stackSlug="my-laravel-app"
        images={sampleImages}
        activeScan={sampleImages[0].securityScan}
        findings={sampleFindings}
        totalFindings={2}
        locale="en"
      />
    )

    // Free tier notice
    expect(
      view.getByText(/Free Tier Retention Policy \(Max 3 Images\)/i)
    ).toBeDefined()

    // Table rows
    expect(view.getByText("ACTIVE (Live)")).toBeDefined()
    expect(view.getByText("READY (Stored)")).toBeDefined()
    expect(view.getByText("EXPIRED (Rotated)")).toBeDefined()

    // Locked action on expired image
    expect(view.getByText("Locked")).toBeDefined()
    // Rollback action on ready image
    expect(view.getByText("Rollback")).toBeDefined()
  })

  it("renders dynamic plan retention policy for paid plans", () => {
    const view = render(
      <SecurityArtifactsTab
        stackSlug="my-laravel-app"
        images={sampleImages}
        activeScan={sampleImages[0].securityScan}
        findings={sampleFindings}
        totalFindings={2}
        planTier="medium"
        locale="en"
      />
    )

    expect(
      view.getByText(/Release Snapshot Retention Policy \(MEDIUM Plan\)/i)
    ).toBeDefined()
    expect(
      view.getByText(/MEDIUM plan retains up to 5 release snapshot images/i)
    ).toBeDefined()
  })

  it("switches to Vulnerability Explorer view and displays severity counters and findings", () => {
    const view = render(
      <SecurityArtifactsTab
        stackSlug="my-laravel-app"
        images={sampleImages}
        activeScan={sampleImages[0].securityScan}
        findings={sampleFindings}
        totalFindings={2}
        locale="en"
      />
    )

    // Switch to Vulnerability Explorer
    const vulnTabBtn = view.getByText(/Vulnerability Explorer/i)
    fireEvent.click(vulnTabBtn)

    // Posture status
    expect(
      view.getByText(/WARNING \(Actionable Fixes Available\)/i)
    ).toBeDefined()

    // Severity counter
    expect(view.getByText("CRITICAL")).toBeDefined()
    expect(view.getAllByText("HIGH").length).toBeGreaterThan(0)

    // Table findings
    expect(view.getByText("CVE-2026-1542")).toBeDefined()
    expect(view.getByText("guzzlehttp/psr7")).toBeDefined()
    expect(view.getByText("openssl")).toBeDefined()
    expect(view.getByText("Platform Managed Runtime")).toBeDefined()
  })

  it("opens rollback inspector and confirms rollback callback", async () => {
    const onRollback = mock().mockResolvedValue(undefined)

    const view = render(
      <SecurityArtifactsTab
        stackSlug="my-laravel-app"
        images={sampleImages}
        activeScan={sampleImages[0].securityScan}
        findings={sampleFindings}
        totalFindings={2}
        onRollback={onRollback}
        locale="en"
      />
    )

    // Click Rollback on Tag 1
    const rollbackBtn = view.getByText("Rollback")
    fireEvent.click(rollbackBtn)

    // Inspector card appears
    expect(view.getByText(/Confirm Safe Rollback: Tag 1/i)).toBeDefined()

    // Click Execute 1-Click Rollback
    const confirmBtn = view.getByText(/Execute 1-Click Rollback/i)
    fireEvent.click(confirmBtn)

    expect(onRollback).toHaveBeenCalledWith("img-1")
  })
})

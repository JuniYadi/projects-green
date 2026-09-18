"use client"

import { useState } from "react"
import {
  ShieldCheck,
  ShieldWarning,
  WarningOctagon,
  ArrowCounterClockwise,
  DownloadSimple,
  Lock,
  Cube,
  FileCode,
  MagnifyingGlass,
  CheckCircle,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  ContainerImageDTO,
  SecurityScanSummaryDTO,
  SecurityScanFindingDTO,
} from "@/modules/deploy/security-artifacts.dto"

export type SecurityArtifactsTabProps = {
  stackSlug: string
  images: ContainerImageDTO[]
  activeScan: SecurityScanSummaryDTO | null
  findings: SecurityScanFindingDTO[]
  totalFindings: number
  onRollback?: (imageId: string) => Promise<void>
  onDownloadReport?: () => Promise<void>
  isRollingBack?: boolean
}

export function SecurityArtifactsTab({
  stackSlug,
  images,
  activeScan,
  findings,
  totalFindings,
  onRollback,
  onDownloadReport,
  isRollingBack = false,
}: SecurityArtifactsTabProps) {
  const [subView, setSubView] = useState<"registry" | "vulnerabilities">("registry")
  const [sourceFilter, setSourceFilter] = useState<"all" | "lang-pkgs" | "os-pkgs">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRollbackImage, setSelectedRollbackImage] = useState<ContainerImageDTO | null>(null)

  const activeImage = images.find((img) => img.status === "ACTIVE") ?? images[0]

  // Filter findings based on selected source & search
  const filteredFindings = findings.filter((f) => {
    if (sourceFilter !== "all" && f.class !== sourceFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchPkg = f.packageName.toLowerCase().includes(q)
      const matchCve = f.cveId.toLowerCase().includes(q)
      if (!matchPkg && !matchCve) return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Sub-view Navigation Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={subView === "registry" ? "default" : "outline"}
            size="sm"
            onClick={() => setSubView("registry")}
            className="h-8 text-xs font-medium"
          >
            <Cube size={14} className="mr-1.5" />
            <span>Image Registry & Rollback</span>
          </Button>
          <Button
            type="button"
            variant={subView === "vulnerabilities" ? "default" : "outline"}
            size="sm"
            onClick={() => setSubView("vulnerabilities")}
            className="h-8 text-xs font-medium"
          >
            <ShieldCheck size={14} className="mr-1.5" />
            <span>Vulnerability Explorer ({totalFindings})</span>
          </Button>
        </div>

        {onDownloadReport && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDownloadReport}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <DownloadSimple size={14} />
            <span>Download Full Report</span>
          </Button>
        )}
      </div>

      {/* Free Tier Retention Notice */}
      <div className="rounded-xl border border-border bg-card p-4 text-xs">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CheckCircle size={14} />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-foreground">
              Free Tier Retention Policy (Max 3 Images)
            </h4>
            <p className="text-muted-foreground">
              The free version automatically retains up to 3 images (1 Active live pod + 2 Ready for rollback).
              Older images are gracefully rotated to EXPIRED status to save space. Expired images are safely locked
              and require a re-build before deployment to protect against container crashes.
            </p>
          </div>
        </div>
      </div>

      {subView === "registry" ? (
        /* ─── View 1: Image Registry & Rollback ────────────────────────── */
        <div className="space-y-6">
          {/* Metadata Banner */}
          <div className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
            <div>
              <span className="text-xs text-muted-foreground">Registry Repository</span>
              <p className="mt-1 font-mono text-xs font-semibold text-foreground truncate">
                registry-apac.pfnapp.com/{stackSlug}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Active Live Image</span>
              <p className="mt-1 text-xs font-semibold text-foreground">
                {activeImage ? `tag: ${activeImage.imageTag}` : "None"}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Retained Images</span>
              <p className="mt-1 text-xs font-semibold text-foreground">
                {images.length} tracked ({images.filter((i) => i.status === "READY").length} rollback ready)
              </p>
            </div>
          </div>

          {/* Retained Image History Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Retained Image History & Safe Rollback Center
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Tag</th>
                    <th className="px-4 py-3 font-medium">Digest</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Security Status</th>
                    <th className="px-4 py-3 font-medium">Pushed</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {images.map((img) => {
                    const isLive = img.status === "ACTIVE"
                    const isReady = img.status === "READY"
                    const isExpired = img.status === "EXPIRED" || img.status === "PURGED"

                    return (
                      <tr key={img.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-foreground">
                          {img.imageTag}
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground text-[11px]">
                          {img.digest ? `${img.digest.slice(0, 16)}...` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {isLive && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <span className="size-1.5 rounded-full bg-current" />
                              ACTIVE (Live)
                            </span>
                          )}
                          {isReady && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                              READY (Stored)
                            </span>
                          )}
                          {isExpired && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              <Lock size={10} />
                              EXPIRED (Rotated)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {img.securityScan ? (
                            img.securityScan.status === "PASSED" ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                0 Vulnerabilities
                              </span>
                            ) : img.securityScan.status === "WARNING" ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                {img.securityScan.highCount} High CVEs
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 font-medium">
                                {img.securityScan.criticalCount} Critical CVEs
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(img.pushedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isLive ? (
                            <span className="text-muted-foreground text-xs font-medium">Current</span>
                          ) : isReady ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isRollingBack}
                              onClick={() => setSelectedRollbackImage(img)}
                              className="h-7 px-2.5 text-xs gap-1"
                            >
                              <ArrowCounterClockwise size={12} />
                              <span>Rollback</span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled
                              className="h-7 px-2.5 text-xs gap-1 text-muted-foreground"
                              title="Image auto-rotated. Re-build commit to deploy again."
                            >
                              <Lock size={12} />
                              <span>Locked</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {images.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No container images built yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rollback Inspector Dialog / Card */}
          {selectedRollbackImage && (
            <div className="rounded-xl border border-primary/40 bg-card p-5 space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ArrowCounterClockwise size={16} className="text-primary" />
                <span>Confirm Safe Rollback: Tag {selectedRollbackImage.imageTag}</span>
              </h4>
              <p className="text-xs text-muted-foreground">
                This image is intact and confirmed in storage. Executing this rollback will instantly point the live Kubernetes pod
                to tag <strong className="text-foreground">{selectedRollbackImage.imageTag}</strong> without triggering a rebuild.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isRollingBack}
                  onClick={async () => {
                    if (onRollback) {
                      await onRollback(selectedRollbackImage.id)
                      setSelectedRollbackImage(null)
                    }
                  }}
                  className="h-8 gap-1.5 text-xs"
                >
                  <ArrowCounterClockwise size={13} className={isRollingBack ? "animate-spin" : ""} />
                  <span>{isRollingBack ? "Rolling back..." : "Execute 1-Click Rollback"}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRollbackImage(null)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ─── View 2: Vulnerability Explorer ───────────────────────────── */
        <div className="space-y-6">
          {/* Security Posture Overview Card */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs text-muted-foreground">Security Posture Status</span>
                <div className="mt-1 flex items-center gap-2">
                  {activeScan?.status === "PASSED" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck size={14} />
                      PASSED (Zero High/Critical Vulnerabilities)
                    </span>
                  ) : activeScan?.status === "WARNING" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <ShieldWarning size={14} />
                      WARNING (Actionable Fixes Available)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      <WarningOctagon size={14} />
                      FAILED (Critical Vulnerabilities Detected)
                    </span>
                  )}
                </div>
              </div>

              {activeScan && (
                <div className="text-xs text-muted-foreground sm:text-right">
                  <span>Engine: {activeScan.scannerEngine} {activeScan.scannerVersion}</span>
                  <p>Scanned: {new Date(activeScan.scannedAt).toLocaleTimeString()}</p>
                </div>
              )}
            </div>

            {/* Severity Counter Tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">CRITICAL</span>
                <p className="mt-1 text-xl font-bold text-foreground">{activeScan?.criticalCount ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">HIGH</span>
                <p className="mt-1 text-xl font-bold text-foreground">{activeScan?.highCount ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">MEDIUM</span>
                <p className="mt-1 text-xl font-bold text-foreground">{activeScan?.mediumCount ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <span className="text-[11px] font-medium text-muted-foreground">LOW</span>
                <p className="mt-1 text-xl font-bold text-foreground">{activeScan?.lowCount ?? 0}</p>
              </div>
            </div>
          </div>

          {/* Interactive Vulnerabilities Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden space-y-4 p-4">
            {/* Filter Tabs & Search */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant={sourceFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSourceFilter("all")}
                  className="h-7 text-xs"
                >
                  All Sources ({findings.length})
                </Button>
                <Button
                  type="button"
                  variant={sourceFilter === "lang-pkgs" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSourceFilter("lang-pkgs")}
                  className="h-7 text-xs"
                >
                  <FileCode size={13} className="mr-1" />
                  App Dependencies ({findings.filter((f) => f.class === "lang-pkgs").length})
                </Button>
                <Button
                  type="button"
                  variant={sourceFilter === "os-pkgs" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSourceFilter("os-pkgs")}
                  className="h-7 text-xs"
                >
                  <Cube size={13} className="mr-1" />
                  Base System ({findings.filter((f) => f.class === "os-pkgs").length})
                </Button>
              </div>

              <div className="relative w-full sm:w-64">
                <MagnifyingGlass size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search CVE or package..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            {/* Findings Table */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">CVE ID</th>
                    <th className="px-4 py-2.5 font-medium">Severity</th>
                    <th className="px-4 py-2.5 font-medium">Package</th>
                    <th className="px-4 py-2.5 font-medium">Origin / Layer</th>
                    <th className="px-4 py-2.5 font-medium">Installed</th>
                    <th className="px-4 py-2.5 font-medium">Fixed In</th>
                    <th className="px-4 py-2.5 font-medium">Provenance / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredFindings.map((finding) => (
                    <tr key={finding.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-medium text-foreground">
                        {finding.vulnerability?.primaryUrl ? (
                          <a
                            href={finding.vulnerability.primaryUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {finding.cveId}
                          </a>
                        ) : (
                          finding.cveId
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            finding.severity === "CRITICAL"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              : finding.severity === "HIGH"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : finding.severity === "MEDIUM"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                  : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {finding.severity}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-foreground font-medium">
                        {finding.packageName}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {finding.class === "lang-pkgs" ? "App Dependency" : "Base System (OS)"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        {finding.installedVersion}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-emerald-600 dark:text-emerald-400">
                        {finding.fixedVersion ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">
                        {finding.class === "lang-pkgs"
                          ? finding.introducedBy || "Direct Dependency"
                          : "Platform Managed Runtime"}
                      </td>
                    </tr>
                  ))}
                  {filteredFindings.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No vulnerabilities found matching current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

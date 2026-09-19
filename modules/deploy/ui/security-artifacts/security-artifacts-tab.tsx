"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
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
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { AppLocale } from "@/lib/i18n/config"
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
  registryRepository?: string
  locale?: AppLocale
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
  registryRepository,
  locale: propLocale,
}: SecurityArtifactsTabProps) {
  const params = useParams<{ lang?: string }>()
  const resolvedLocale = resolveLocaleOrDefault(propLocale ?? params?.lang)
  const messages = getMessages(resolvedLocale).pSecurityArtifactsTab

  const [subView, setSubView] = useState<"registry" | "vulnerabilities">("registry")
  const [sourceFilter, setSourceFilter] = useState<"all" | "lang-pkgs" | "os-pkgs">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRollbackImage, setSelectedRollbackImage] = useState<ContainerImageDTO | null>(null)

  const activeImage = images.find((img) => img.status === "ACTIVE") ?? images[0]
  const defaultRegistryHost =
    process.env.NEXT_PUBLIC_CONTAINER_REGISTRY_HOST ||
    process.env.NEXT_PUBLIC_REGISTRY_HOST ||
    ""
  const displayRepository =
    registryRepository ||
    (defaultRegistryHost ? `${defaultRegistryHost}/${stackSlug}` : stackSlug)

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
            <span>{messages.tabRegistry}</span>
          </Button>
          <Button
            type="button"
            variant={subView === "vulnerabilities" ? "default" : "outline"}
            size="sm"
            onClick={() => setSubView("vulnerabilities")}
            className="h-8 text-xs font-medium"
          >
            <ShieldCheck size={14} className="mr-1.5" />
            <span>{messages.tabVulnerabilities.replace("{count}", String(totalFindings))}</span>
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
            <span>{messages.downloadReport}</span>
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
              {messages.retentionTitle}
            </h4>
            <p className="text-muted-foreground">
              {messages.retentionDesc}
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
              <span className="text-xs text-muted-foreground">{messages.registryRepo}</span>
              <p className="mt-1 font-mono text-xs font-semibold text-foreground truncate">
                {displayRepository}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">{messages.activeLiveImage}</span>
              <p className="mt-1 text-xs font-semibold text-foreground">
                {activeImage ? `tag: ${activeImage.imageTag}` : "None"}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">{messages.retainedImages}</span>
              <p className="mt-1 text-xs font-semibold text-foreground">
                {images.length} {messages.tracked} ({images.filter((i) => i.status === "READY").length} {messages.rollbackReady})
              </p>
            </div>
          </div>

          {/* Retained Image History Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">
                {messages.tableHeading}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">{messages.colTag}</th>
                    <th className="px-4 py-3 font-medium">{messages.colDigest}</th>
                    <th className="px-4 py-3 font-medium">{messages.colStatus}</th>
                    <th className="px-4 py-3 font-medium">{messages.colSecurityStatus}</th>
                    <th className="px-4 py-3 font-medium">{messages.colPushed}</th>
                    <th className="px-4 py-3 font-medium text-right">{messages.colAction}</th>
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
                              {messages.statusActive}
                            </span>
                          )}
                          {isReady && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                              {messages.statusReady}
                            </span>
                          )}
                          {isExpired && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              <Lock size={10} />
                              {messages.statusExpired}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {img.securityScan ? (
                            img.securityScan.status === "PASSED" ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                {messages.zeroVulnerabilities}
                              </span>
                            ) : img.securityScan.status === "WARNING" ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                {messages.highCves.replace("{count}", String(img.securityScan.highCount))}
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 font-medium">
                                {messages.criticalCves.replace("{count}", String(img.securityScan.criticalCount))}
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground">{messages.pending}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(img.pushedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isLive ? (
                            <span className="text-muted-foreground text-xs font-medium">{messages.current}</span>
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
                              <span>{messages.rollback}</span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled
                              className="h-7 px-2.5 text-xs gap-1 text-muted-foreground"
                              title={messages.lockedTooltip}
                            >
                              <Lock size={12} />
                              <span>{messages.locked}</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {images.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        {messages.noImages}
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
                <span>{messages.rollbackModalTitle.replace("{tag}", selectedRollbackImage.imageTag)}</span>
              </h4>
              <p className="text-xs text-muted-foreground">
                {messages.rollbackModalDesc.replace("{tag}", selectedRollbackImage.imageTag)}
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
                  <span>{isRollingBack ? messages.rollingBack : messages.confirmRollback}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRollbackImage(null)}
                  className="h-8 text-xs"
                >
                  {messages.cancel}
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
                <span className="text-xs text-muted-foreground">{messages.securityPosture}</span>
                <div className="mt-1 flex items-center gap-2">
                  {activeScan?.status === "PASSED" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck size={14} />
                      {messages.passedStatus}
                    </span>
                  ) : activeScan?.status === "WARNING" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <ShieldWarning size={14} />
                      {messages.warningStatus}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      <WarningOctagon size={14} />
                      {messages.failedStatus}
                    </span>
                  )}
                </div>
              </div>

              {activeScan && (
                <div className="text-xs text-muted-foreground sm:text-right">
                  <span>{messages.engine} {activeScan.scannerEngine} {activeScan.scannerVersion}</span>
                  <p>{messages.scanned} {new Date(activeScan.scannedAt).toLocaleTimeString()}</p>
                </div>
              )}
            </div>

            {/* Severity Counter Tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{messages.sevCritical}</span>
                <p className="mt-1 text-xl font-bold text-foreground">{activeScan?.criticalCount ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">{messages.sevHigh}</span>
                <p className="mt-1 text-xl font-bold text-foreground">{activeScan?.highCount ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">{messages.sevMedium}</span>
                <p className="mt-1 text-xl font-bold text-foreground">{activeScan?.mediumCount ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <span className="text-[11px] font-medium text-muted-foreground">{messages.sevLow}</span>
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
                  {messages.filterAll.replace("{count}", String(findings.length))}
                </Button>
                <Button
                  type="button"
                  variant={sourceFilter === "lang-pkgs" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSourceFilter("lang-pkgs")}
                  className="h-7 text-xs"
                >
                  <FileCode size={13} className="mr-1" />
                  {messages.filterLangPkgs.replace("{count}", String(findings.filter((f) => f.class === "lang-pkgs").length))}
                </Button>
                <Button
                  type="button"
                  variant={sourceFilter === "os-pkgs" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSourceFilter("os-pkgs")}
                  className="h-7 text-xs"
                >
                  <Cube size={13} className="mr-1" />
                  {messages.filterOsPkgs.replace("{count}", String(findings.filter((f) => f.class === "os-pkgs").length))}
                </Button>
              </div>

              <div className="relative w-full sm:w-64">
                <MagnifyingGlass size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={messages.searchPlaceholder}
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
                    <th className="px-4 py-2.5 font-medium">{messages.colCveId}</th>
                    <th className="px-4 py-2.5 font-medium">{messages.colSeverity}</th>
                    <th className="px-4 py-2.5 font-medium">{messages.colPackage}</th>
                    <th className="px-4 py-2.5 font-medium">{messages.colOriginLayer}</th>
                    <th className="px-4 py-2.5 font-medium">{messages.colInstalled}</th>
                    <th className="px-4 py-2.5 font-medium">{messages.colFixedIn}</th>
                    <th className="px-4 py-2.5 font-medium">{messages.colProvenanceAction}</th>
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
                        {messages.noFindings}
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

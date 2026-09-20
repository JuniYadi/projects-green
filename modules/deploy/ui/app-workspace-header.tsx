"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  RocketLaunch,
  ArrowSquareOut,
  CaretUpDown,
  CheckCircle,
  Gauge,
  ChartLine,
  ChartBar,
  GearSix,
  ArrowsClockwise,
  TerminalWindow,
  GitBranch,
  Cube,
  GlobeHemisphereWest,
  ShieldCheck,
  Scroll,
  Copy,
  Check,
} from "@phosphor-icons/react"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import { Button } from "@/components/ui/button"
import { CountryFlag } from "@/components/ui/country-flag"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  DEPLOY_STATUS_LABELS,
  DEPLOY_STATUS_TONE as STATUS_TONE,
} from "@/modules/deploy/deploy.constants"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"
import { ReinstallTemplateDialog } from "./reinstall-template-dialog"

export type WorkspaceTabKey =
  | "overview"
  | "deployments"
  | "security-artifacts"
  | "logs"
  | "terminal"
  | "metrics"
  | "traffic"
  | "settings"
export type AppWorkspaceHeaderProps = {
  apps?: StackSummaryDTO[]
  selectedApp: StackSummaryDTO
  activeTab: WorkspaceTabKey
  locale?: string
  onSync?: () => void
  isSyncing?: boolean
  onDeploy?: () => void
  isDeploying?: boolean
  isTerminalActive?: boolean
  onReinstallSuccess?: () => void
}

export function AppWorkspaceHeader({
  apps = [],
  selectedApp,
  activeTab,
  locale: localeProp,
  onSync,
  isSyncing = false,
  onDeploy,
  isDeploying = false,
  isTerminalActive = false,
  onReinstallSuccess,
}: AppWorkspaceHeaderProps) {
  const [reinstallOpen, setReinstallOpen] = useState(false)
  const [copiedDomain, setCopiedDomain] = useState(false)
  const params = useParams<{ lang?: string }>()
  const router = useRouter()
  const locale = resolveLocaleOrDefault(localeProp ?? params?.lang)
  const isTemplate =
    selectedApp.sourceType === "TEMPLATE" || Boolean(selectedApp.templateId)

  const targetDomain = selectedApp.customDomain || selectedApp.subdomain
  const tone = STATUS_TONE[selectedApp.status] ?? STATUS_TONE.idle
  const statusLabel =
    DEPLOY_STATUS_LABELS[selectedApp.status] ?? selectedApp.status
  const messages = getMessages(locale).pAppWorkspaceHeader

  const effectiveTone = isDeploying
    ? "border-sky-500/20 bg-sky-500/10 text-sky-400"
    : tone
  const effectiveStatusLabel = isDeploying
    ? locale.startsWith("id")
      ? "Sedang Deploy"
      : "Deploying"
    : statusLabel

  const handleCopyDomain = async () => {
    if (!targetDomain) return
    try {
      await navigator.clipboard.writeText(`https://${targetDomain}`)
      setCopiedDomain(true)
      setTimeout(() => setCopiedDomain(false), 2000)
    } catch {
      // Ignore clipboard error
    }
  }

  const getTabUrl = (tab: WorkspaceTabKey, slug = selectedApp.slug) => {
    return `/${locale}/console/app/platform/${slug}?tab=${tab}`
  }

  const tabs: Array<{
    key: WorkspaceTabKey
    label: string
    icon: React.ReactNode
  }> = [
    { key: "overview", label: "Overview", icon: <Gauge size={15} /> },
    {
      key: "deployments",
      label: "Deployments",
      icon: <RocketLaunch size={15} />,
    },
    {
      key: "security-artifacts",
      label: "Security & Artifacts",
      icon: <ShieldCheck size={15} />,
    },
    { key: "logs", label: "Logs", icon: <Scroll size={15} /> },
    {
      key: "terminal",
      label: "Terminal",
      icon: <TerminalWindow size={15} />,
    },
    { key: "metrics", label: "Metrics", icon: <ChartLine size={15} /> },
    { key: "traffic", label: "Traffic", icon: <ChartBar size={15} /> },
    { key: "settings", label: "Settings", icon: <GearSix size={15} /> },
  ]

  const handleSwitchApp = (slug: string) => {
    router.push(getTabUrl(activeTab, slug))
  }

  return (
    <div className="space-y-4">
      {/* Top Application Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          {/* Logo */}
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/40 text-primary">
            <RocketLaunch size={24} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              {apps.length > 1 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="group inline-flex items-center gap-1.5 text-lg font-bold tracking-tight text-foreground transition-colors hover:text-primary"
                    >
                      <span>{selectedApp.name}</span>
                      <CaretUpDown
                        size={16}
                        className="text-muted-foreground group-hover:text-foreground"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {messages.switchApplication}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {apps.map((app) => (
                      <DropdownMenuItem
                        key={app.id}
                        onClick={() => handleSwitchApp(app.slug)}
                        className="flex items-center justify-between"
                      >
                        <span className="truncate font-medium">{app.name}</span>
                        {app.slug === selectedApp.slug && (
                          <CheckCircle size={14} className="text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <h1 className="text-lg font-bold tracking-tight text-foreground">
                  {selectedApp.name}
                </h1>
              )}

              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${effectiveTone}`}
              >
                <span
                  className={`size-1.5 rounded-full bg-current ${
                    isDeploying ? "animate-pulse" : ""
                  }`}
                />
                <span>{effectiveStatusLabel}</span>
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {selectedApp.templateName
                  ? `${selectedApp.templateName} (Template)`
                  : (selectedApp.framework ?? "Custom Workload")}
              </span>
              <span>&bull;</span>
              <span className="inline-flex items-center gap-1">
                {selectedApp.sourceType === "TEMPLATE" ? (
                  <>
                    <Cube
                      size={13}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span>{messages.source}</span>
                    <strong className="font-mono text-foreground">
                      {selectedApp.dockerVersion
                        ? `v${selectedApp.dockerVersion.replace(/^v/, "")}`
                        : "latest"}
                    </strong>
                  </>
                ) : (
                  <>
                    <GitBranch
                      size={13}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span>{messages.source}</span>
                    <strong className="font-mono text-foreground">
                      {selectedApp.branchName}
                    </strong>
                  </>
                )}
              </span>
              {selectedApp.resourcePlanId ? (
                <>
                  <span>&bull;</span>
                  <span>
                    {messages.plan}{" "}
                    <strong className="text-foreground">
                      {selectedApp.resourcePlanId}
                    </strong>
                  </span>
                </>
              ) : null}
              {selectedApp.cluster ? (
                <>
                  <span>&bull;</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span>{messages.cluster}</span>
                    <CountryFlag
                      country={selectedApp.cluster.countryCode}
                      className="rounded-2xs h-3 w-4.5 shrink-0 object-cover shadow-2xs"
                      fallback={
                        <GlobeHemisphereWest
                          size={13}
                          className="shrink-0 text-muted-foreground"
                        />
                      }
                    />
                    <strong className="text-foreground">
                      {selectedApp.cluster.regionName ||
                        selectedApp.cluster.name}
                    </strong>
                    {selectedApp.cluster.code ? (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        ({selectedApp.cluster.code})
                      </span>
                    ) : null}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Action Controls (Right-aligned CTA) */}
        <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
          {isTemplate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReinstallOpen(true)}
              className="h-8 gap-1.5 px-3 text-xs"
              title={
                locale.startsWith("id")
                  ? "Ganti atau install ulang template aplikasi"
                  : "Reinstall or change application template"
              }
            >
              <ArrowsClockwise size={14} />
              <span>
                {locale.startsWith("id")
                  ? "Ganti Template"
                  : "Reinstall Template"}
              </span>
            </Button>
          ) : onDeploy ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => onDeploy?.()}
              disabled={isDeploying}
              className="h-8 gap-1.5 px-3 text-xs font-medium"
              title={
                locale.startsWith("id")
                  ? "Deploy pembaruan terbaru dari codebase Git"
                  : "Deploy latest updates from Git codebase"
              }
            >
              <RocketLaunch
                size={14}
                className={isDeploying ? "animate-pulse" : ""}
              />
              <span>
                {isDeploying
                  ? locale.startsWith("id")
                    ? "Sedang Deploy..."
                    : "Deploying..."
                  : locale.startsWith("id")
                    ? "Deploy Update"
                    : "Deploy Update"}
              </span>
            </Button>
          ) : null}
          {onSync && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={isSyncing}
              className="h-8 gap-1.5 px-3 text-xs"
              title={messages.syncTooltip}
            >
              <ArrowsClockwise
                size={14}
                className={isSyncing ? "animate-spin" : ""}
              />
              <span>{isSyncing ? messages.syncing : messages.syncConfig}</span>
            </Button>
          )}
          {targetDomain ? (
            <div className="inline-flex items-center rounded-md border border-border bg-background shadow-xs">
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 rounded-r-none px-3 text-xs font-medium hover:bg-muted/50"
              >
                <a
                  href={`https://${targetDomain}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{targetDomain}</span>
                  <ArrowSquareOut size={13} />
                </a>
              </Button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center border-l border-border/80 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                onClick={handleCopyDomain}
                title={
                  locale.startsWith("id")
                    ? "Salin alamat URL"
                    : "Copy public URL"
                }
              >
                {copiedDomain ? (
                  <Check size={13} className="text-emerald-500" />
                ) : (
                  <Copy size={13} />
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Unified Workspace Tabs */}
      <div className="flex border-b border-border">
        <nav
          className="-mb-px flex space-x-6 overflow-x-auto"
          aria-label={messages.workspaceTabsAria}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <Link
                key={tab.key}
                href={getTabUrl(tab.key)}
                className={`inline-flex items-center gap-2 border-b-2 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.key === "terminal" && isTerminalActive && (
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
                    title={messages.liveTerminalSession}
                  />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {isTemplate && (
        <ReinstallTemplateDialog
          stack={selectedApp}
          open={reinstallOpen}
          onOpenChange={setReinstallOpen}
          onSuccess={() => {
            setReinstallOpen(false)
            onReinstallSuccess?.()
          }}
        />
      )}
    </div>
  )
}

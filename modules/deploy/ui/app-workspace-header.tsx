"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  RocketLaunch,
  ArrowSquareOut,
  CaretUpDown,
  CheckCircle,
  Gauge,
  ListMagnifyingGlass,
  ChartLine,
  ChartBar,
  GearSix,
  ArrowsClockwise,
  TerminalWindow,
} from "@phosphor-icons/react"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Button } from "@/components/ui/button"
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

export type WorkspaceTabKey =
  | "overview"
  | "deployments"
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
}

export function AppWorkspaceHeader({
  apps = [],
  selectedApp,
  activeTab,
  locale: localeProp,
  onSync,
  isSyncing = false,
}: AppWorkspaceHeaderProps) {
  const params = useParams<{ lang?: string }>()
  const router = useRouter()
  const locale = resolveLocaleOrDefault(localeProp ?? params?.lang)

  const targetDomain = selectedApp.customDomain || selectedApp.subdomain
  const tone = STATUS_TONE[selectedApp.status] ?? STATUS_TONE.idle
  const statusLabel =
    DEPLOY_STATUS_LABELS[selectedApp.status] ?? selectedApp.status

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
      icon: <ListMagnifyingGlass size={15} />,
    },
    { key: "logs", label: "Logs", icon: <ListMagnifyingGlass size={15} /> },
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
                      Switch Application
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
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}
              >
                <span className="size-1.5 rounded-full bg-current" />
                <span>{statusLabel}</span>
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {selectedApp.templateName
                  ? `${selectedApp.templateName} (Template)`
                  : (selectedApp.framework ?? "Custom Workload")}
              </span>
              <span>&bull;</span>
              <span>
                branch{" "}
                <strong className="font-mono text-foreground">
                  {selectedApp.branchName}
                </strong>
              </span>
              {selectedApp.resourcePlanId ? (
                <>
                  <span>&bull;</span>
                  <span>
                    plan{" "}
                    <strong className="text-foreground">
                      {selectedApp.resourcePlanId}
                    </strong>
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Action Controls (Right-aligned CTA) */}
        <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
          {onSync && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={isSyncing}
              className="h-8 gap-1.5 px-3 text-xs"
            >
              <ArrowsClockwise
                size={14}
                className={isSyncing ? "animate-spin" : ""}
              />
              <span>{isSyncing ? "Syncing..." : "Sync Config"}</span>
            </Button>
          )}
          {targetDomain ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 px-3 text-xs"
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
          ) : null}

          <Button asChild size="sm" className="h-8 gap-1.5 px-3 text-xs">
            <Link
              href={`/${locale}/console/app/platform/${selectedApp.slug}?tab=env`}
            >
              <GearSix size={14} />
              <span>Settings</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Unified Workspace Tabs */}
      <div className="flex border-b border-border">
        <nav
          className="-mb-px flex space-x-6 overflow-x-auto"
          aria-label="App Workspace Tabs"
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
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

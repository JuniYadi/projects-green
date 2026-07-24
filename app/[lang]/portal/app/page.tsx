"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  RocketLaunch,
  ListMagnifyingGlass,
  ChartLine,
  ArrowSquareOut,
} from "@phosphor-icons/react"

import { eden } from "@/lib/eden"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DEPLOY_STATUS_LABELS } from "@/modules/deploy/deploy.constants"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"

const STATUS_TONE: Record<string, string> = {
  running: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
  failed: "border-rose-500/20 bg-rose-500/5 text-rose-400",
  building: "border-sky-500/20 bg-sky-500/5 text-sky-400",
  deploying: "border-sky-500/20 bg-sky-500/5 text-sky-400",
  queued: "border-amber-500/20 bg-amber-500/5 text-amber-400",
  idle: "border-border bg-muted/30 text-muted-foreground",
}

export default function PortalApplicationsPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)

  const [apps, setApps] = useState<StackSummaryDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: payload } = await eden.api.deploy.apps.get()
        if (!payload || !payload.ok || !Array.isArray(payload.data)) {
          throw new Error(payload?.message ?? "Unable to load applications.")
        }

        if (cancelled) return
        setApps(payload.data)
      } catch (cause) {
        if (cancelled) return
        setApps([])
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load applications."
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [retry])

  const handleRetry = () => setRetry((v) => v + 1)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">App Hosting Admin</h1>
        <p className="text-sm text-muted-foreground">
          Support and configuration surfaces for the App Hosting MVP. Customer
          deploy and runtime management live in the console.
        </p>
      </header>

      {loading ? (
        <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          Loading applications...
        </div>
      ) : error ? (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          role="alert"
        >
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRetry}
          >
            Retry
          </Button>
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/10 p-12 text-center">
          <RocketLaunch size={40} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No applications deployed yet.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Framework</th>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">Last Deployed</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => {
                  const logsHref =
                    localizePathname({
                      pathname: "/portal/app/logs",
                      locale,
                    }) + `?app=${app.slug}`
                  const metricsHref =
                    localizePathname({
                      pathname: "/portal/app/metrics",
                      locale,
                    }) + `?app=${app.slug}`
                  const eventsHref =
                    localizePathname({
                      pathname: "/portal/app/events",
                      locale,
                    }) + `?app=${app.slug}`
                  const settingsHref =
                    localizePathname({
                      pathname: "/portal/app/settings",
                      locale,
                    }) + `?app=${app.slug}`

                  return (
                    <tr
                      key={app.id}
                      className="border-b border-border transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          {app.name}
                          {app.subdomain || app.customDomain ? (
                            <a
                              href={`https://${app.customDomain || app.subdomain}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                              title="Open app"
                            >
                              <ArrowSquareOut size={14} />
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            STATUS_TONE[app.status] ?? STATUS_TONE.idle
                          }`}
                        >
                          {DEPLOY_STATUS_LABELS[app.status] ?? app.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {app.framework ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {app.branchName}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {app.lastDeployedAt
                          ? new Date(app.lastDeployedAt).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button asChild variant="outline" size="xs">
                            <Link href={logsHref}>
                              <ListMagnifyingGlass size={14} className="mr-1" />
                              Logs
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="xs">
                            <Link href={eventsHref}>
                              <ListMagnifyingGlass size={14} className="mr-1" />
                              Events
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="xs">
                            <Link href={metricsHref}>
                              <ChartLine size={14} className="mr-1" />
                              Metrics
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="xs">
                            <Link href={settingsHref}>
                              <RocketLaunch size={14} className="mr-1" />
                              Settings
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}

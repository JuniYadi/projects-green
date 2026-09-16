"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { ArrowClockwise, GithubLogo, GitBranch } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import type { CustomDomain } from "@/modules/deploy/operate.types"
import { TrafficFlowCanvas } from "./traffic-flow-canvas"

type TabOverviewProps = {
  diagnosticMode: string
  replicas: number
  cloudflareEnabled: boolean
  dbConnected: boolean
  setCloudflareEnabled: (val: boolean) => void
  setDbConnected: (val: boolean) => void
  domains: CustomDomain[]
}

export function TabOverview({
  diagnosticMode,
  replicas,
  cloudflareEnabled,
  dbConnected,
  setCloudflareEnabled,
  setDbConnected,
  domains,
}: TabOverviewProps) {
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"
  const messages =
    getMessagesForMaybeLocale(lang).console.deploy.operateOverview
  const [rebuildState, setRebuildState] = useState<
    "idle" | "fetching" | "building" | "restarting" | "success"
  >("idle")
  const [buildLogs, setBuildLogs] = useState<string[]>([])
  const rebuildTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])

  const clearRebuildTimers = () => {
    for (const timerId of rebuildTimersRef.current) {
      clearTimeout(timerId)
    }
    rebuildTimersRef.current = []
  }

  useEffect(() => {
    return () => {
      clearRebuildTimers()
    }
  }, [])

  const handleRebuild = () => {
    clearRebuildTimers()
    setRebuildState("fetching")
    setBuildLogs([
      "[17:55:00] Pulling latest updates from git repository acme/laravel-shop:main...",
    ])

    const buildingTimerId = setTimeout(() => {
      setRebuildState("building")
      setBuildLogs((prev) => [
        ...prev,
        "[17:55:02] Found updated commit: d4a7d0e (feat: optimize product loading speed)",
        "[17:55:03] Building container image via Dockerfile...",
        "[17:55:05] Running: composer install --no-dev --optimize-autoloader",
        "[17:55:07] Running: bun install && bun run build",
        "[17:55:09] Injecting environment configurations...",
        "[17:55:10] Container build successful. Image tagged: ghcr.io/acme/laravel-shop:sha-d4a7d0e",
        "[17:55:11] Pushing container to registry... Done",
      ])
    }, 2000)
    rebuildTimersRef.current.push(buildingTimerId)

    const restartingTimerId = setTimeout(() => {
      setRebuildState("restarting")
      setBuildLogs((prev) => [
        ...prev,
        "[17:55:13] Scheduling rollout restart for namespace app-prod...",
        "[17:55:14] Deploying 2 replica pods using RollingUpdate strategy...",
        "[17:55:16] Pod app-prod-api-d4a7d0e-x9z10: Starting initialization...",
        "[17:55:17] Pod app-prod-api-d4a7d0e-x9z10: Health checks passed. Pod Ready.",
        "[17:55:18] Terminating old pod replicas...",
      ])
    }, 5000)
    rebuildTimersRef.current.push(restartingTimerId)

    const successTimerId = setTimeout(() => {
      setRebuildState("success")
      setBuildLogs((prev) => [
        ...prev,
        "[17:55:20] Deployment completed. Site is healthy and active.",
      ])
      const resetTimerId = setTimeout(() => setRebuildState("idle"), 3000)
      rebuildTimersRef.current.push(resetTimerId)
    }, 8000)
    rebuildTimersRef.current.push(successTimerId)
  }

  return (
    <div className="space-y-6">
      <TrafficFlowCanvas
        diagnosticMode={diagnosticMode}
        replicas={replicas}
        cloudflareEnabled={cloudflareEnabled}
        dbConnected={dbConnected}
        setCloudflareEnabled={setCloudflareEnabled}
        setDbConnected={setDbConnected}
        domains={domains}
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Git Integration Details */}
        <Card
          size="sm"
          className="col-span-2 border-border bg-card/50 shadow-xl backdrop-blur-md dark:bg-[#0A0A0C]/50"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="space-y-1">
              <CardTitle className="text-base font-bold text-foreground">
                {messages.repoDeployStatus}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {messages.repoDeployStatusDesc}
              </CardDescription>
            </div>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Vercel-style deployment details */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    {messages.sourceProvider}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <GithubLogo size={16} className="text-muted-foreground" />
                    GitHub
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    {messages.repository}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    acme/laravel-shop
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    {messages.activeBranch}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                    <GitBranch size={14} />
                    main
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-1 border-t border-border/60 pt-4">
                <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  {messages.lastSyncedCommit}
                </span>
                <div className="flex items-center gap-2">
                  <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    d4a7d0e
                  </span>
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    feat: optimize product loading speed
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {messages.manualBuildPrompt}
                </span>
                <Button
                  type="button"
                  onClick={handleRebuild}
                  disabled={rebuildState !== "idle"}
                  className="h-8 gap-2 rounded-xl text-xs font-semibold transition-all"
                  size="sm"
                >
                  <ArrowClockwise
                    className={rebuildState !== "idle" ? "animate-spin" : ""}
                    size={14}
                  />
                  {rebuildState === "idle"
                    ? messages.rebuildButton
                    : messages.rebuildingButton}
                </Button>
              </div>

              {/* Premium Mac-like terminal logs */}
              {rebuildState !== "idle" && (
                <div className="animate-in overflow-hidden rounded-xl border border-border bg-zinc-950 shadow-2xl duration-200 fade-in dark:bg-black/95">
                  {/* Header bar */}
                  <div className="flex items-center justify-between border-b border-border/40 bg-muted/60 px-4 py-2 dark:bg-neutral-900/60">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {messages.buildLogsTitle}
                    </span>
                    <div className="w-10" /> {/* Spacer */}
                  </div>

                  {/* Terminal content */}
                  <div className="max-h-[160px] scrollbar-none space-y-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed text-emerald-500 select-text dark:text-green-400">
                    {buildLogs.map((log, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-muted-foreground/40 select-none">
                          {(idx + 1).toString().padStart(2, "0")}
                        </span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Accessibility Diagnostics */}
        <Card
          size="sm"
          className="border-border bg-card/50 shadow-xl backdrop-blur-md dark:bg-[#0A0A0C]/50"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              {messages.diagnosticsTitle}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {messages.diagnosticsDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`space-y-3 rounded-xl border p-4 text-xs transition-all duration-300 ${
                diagnosticMode === "healthy"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 shadow-[0_0_15px_rgba(16,185,129,0.02)] dark:bg-emerald-500/5 dark:text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-800 shadow-[0_0_15px_rgba(244,63,94,0.02)] dark:bg-rose-500/5 dark:text-rose-300"
              }`}
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  {messages.healthCheckTitle}
                </span>
                <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-foreground">
                  {diagnosticMode === "healthy"
                    ? "HTTP 200 OK"
                    : diagnosticMode === "error_502"
                      ? "HTTP 502 Bad Gateway"
                      : diagnosticMode === "ssl_expired"
                        ? "SSL Certificate Expired"
                        : "HTTP 301 Redirection Loop"}
                </span>
              </div>

              {diagnosticMode === "healthy" && (
                <p className="leading-relaxed text-muted-foreground">
                  {messages.healthNormalDesc}
                </p>
              )}

              {diagnosticMode === "error_502" && (
                <div className="space-y-2 leading-relaxed">
                  <p className="font-semibold text-rose-600 dark:text-rose-400">
                    {messages.badGatewayTitle}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    <strong>{messages.rootCause}</strong>{" "}
                    {messages.badGatewayCause}
                  </p>
                  <p className="rounded-lg border border-border/40 bg-muted/30 p-2.5 font-mono text-[10px] leading-normal text-foreground dark:bg-black/40 dark:text-white">
                    {messages.badGatewaySolution}
                  </p>
                </div>
              )}

              {diagnosticMode === "ssl_expired" && (
                <div className="space-y-2 leading-relaxed">
                  <p className="font-semibold text-rose-600 dark:text-rose-400">
                    {messages.sslFailTitle}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    <strong>{messages.rootCause}</strong>{" "}
                    {messages.sslFailCause}
                  </p>
                  <p className="rounded-lg border border-border/40 bg-muted/30 p-2.5 font-mono text-[10px] leading-normal text-foreground dark:bg-black/40 dark:text-white">
                    {messages.sslFailSolution}
                  </p>
                </div>
              )}

              {diagnosticMode === "redirect_loop" && (
                <div className="space-y-2 leading-relaxed">
                  <p className="font-semibold text-amber-600 dark:text-amber-400">
                    {messages.redirectLoopTitle}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    <strong>{messages.rootCause}</strong>{" "}
                    {messages.redirectLoopCause}
                  </p>
                  <p className="rounded-lg border border-border/40 bg-muted/30 p-2.5 font-mono text-[10px] leading-normal text-foreground dark:bg-black/40 dark:text-white">
                    {messages.redirectLoopSolution}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3.5 text-xs">
              <span className="block text-xs font-semibold text-foreground">
                {messages.endpointDetailsTitle}
              </span>
              <div className="flex items-center justify-between pt-1 font-mono text-[11px] text-muted-foreground">
                <span>{messages.clusterHost}</span>
                <span className="text-foreground">k8s-ingress-prod.local</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>{messages.targetPort}</span>
                <span className="text-foreground">80 / 8080 (TCP)</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>{messages.replicas}</span>
                <span className="text-foreground">
                  {replicas} {messages.active}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

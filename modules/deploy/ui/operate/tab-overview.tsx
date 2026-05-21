"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowClockwise,
  CheckCircle,
  Warning,
  ShieldWarning,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import type { AppStatusType } from "@/modules/deploy/operate.types"

type TabOverviewProps = {
  diagnosticMode: string
  replicas: number
}

export function TabOverview({ diagnosticMode, replicas }: TabOverviewProps) {
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

  const healthStatus: AppStatusType =
    diagnosticMode === "healthy"
      ? "healthy"
      : diagnosticMode === "error_502"
        ? "degraded"
        : diagnosticMode === "ssl_expired"
          ? "inaccessible"
          : "degraded"

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
    <div className="grid gap-6 md:grid-cols-3">
      {/* Git Integration Details */}
      <Card className="col-span-2 border-white/[0.06] bg-black/25">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold text-white">
              Repository Deploy Status
            </CardTitle>
            <CardDescription>
              Git repository synchronization and pipeline builds
            </CardDescription>
          </div>
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-white/[0.06] bg-black/40 p-4 text-sm">
            <div className="space-y-1">
              <span className="block text-xs text-muted-foreground">
                Source Provider
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-white">
                GitHub
              </span>
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-muted-foreground">
                Repository
              </span>
              <span className="font-semibold text-white">
                acme/laravel-shop
              </span>
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-muted-foreground">
                Active Branch
              </span>
              <span className="font-mono font-bold text-primary">main</span>
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-muted-foreground">
                Last Synced Commit
              </span>
              <span className="font-mono font-semibold text-white">
                d4a7d0e (feat: optimize product...)
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Trigger build manually when updates are pushed:
              </span>
              <Button
                type="button"
                onClick={handleRebuild}
                disabled={rebuildState !== "idle"}
                className="gap-2 text-xs"
              >
                <ArrowClockwise
                  className={rebuildState !== "idle" ? "animate-spin" : ""}
                  size={14}
                />
                {rebuildState === "idle"
                  ? "Rebuild & Deploy"
                  : "Processing Build..."}
              </Button>
            </div>

            {rebuildState !== "idle" && (
              <div className="max-h-[160px] overflow-y-auto rounded-lg border border-green-500/20 bg-black/90 p-4 font-mono text-xs text-green-400">
                {buildLogs.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Inaccessible / Health Port Diagnostics (Q6 Answer) */}
      <Card className="border-white/[0.06] bg-black/25">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white">
            Accessibility Diagnostics
          </CardTitle>
          <CardDescription>App endpoint availability auditing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`space-y-3 rounded-lg border p-4 text-xs ${
              diagnosticMode === "healthy"
                ? "border-green-500/20 bg-green-500/5 text-green-300"
                : "border-red-500/20 bg-red-500/5 text-red-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold tracking-wider uppercase">
                Health Status Check
              </span>
              <span className="rounded border border-white/[0.06] bg-black/50 px-2 py-0.5 font-mono text-[10px] text-white">
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
              <p className="leading-relaxed">
                Your app endpoints are responding normally. Cluster routing, SSL
                verification, and target pods are fully resolved.
              </p>
            )}

            {diagnosticMode === "error_502" && (
              <div className="space-y-2 leading-relaxed">
                <p className="font-semibold text-red-400">
                  Diagnostics failed: 502 Bad Gateway detected.
                </p>
                <p>
                  <strong>Root Cause:</strong> The origin server inside the
                  Kubernetes pod is not listening on the expected port
                  (targetPort: 8080) or crashed on boot.
                </p>
                <p className="rounded border border-white/5 bg-black/30 p-2 font-mono text-[10px] text-white">
                  Solution: Go to your Dockerfile/code configuration and ensure
                  the app starts up on port 8080. Check &apos;Opensearch
                  Logs&apos; to verify PHP-FPM / Node boot errors.
                </p>
              </div>
            )}

            {diagnosticMode === "ssl_expired" && (
              <div className="space-y-2 leading-relaxed">
                <p className="font-semibold text-red-400">
                  SSL Connection Handshake Failure
                </p>
                <p>
                  <strong>Root Cause:</strong> The custom domain certificate
                  expired on 2026-05-18. Kubernetes cert-manager failed
                  validation because DNS is misconfigured.
                </p>
                <p className="rounded border border-white/5 bg-black/30 p-2 font-mono text-[10px] text-white">
                  Solution: Visit the &apos;Domains &amp; SSL&apos; tab, check
                  that your DNS records target the cluster IP exactly, and click
                  &apos;Force SSL Renewal&apos;.
                </p>
              </div>
            )}

            {diagnosticMode === "redirect_loop" && (
              <div className="space-y-2 leading-relaxed">
                <p className="font-semibold text-yellow-400">
                  Redirect Loop Detected (301 Infinite Redirections)
                </p>
                <p>
                  <strong>Root Cause:</strong> Cloudflare Flexible SSL is
                  active. Cloudflare hits our ingress controller on HTTP, which
                  redirects to HTTPS, and sends it back to Cloudflare.
                </p>
                <p className="rounded border border-white/5 bg-black/30 p-2 font-mono text-[10px] text-white">
                  Solution: Change your Cloudflare SSL/TLS setting from
                  &apos;Flexible&apos; to &apos;Full&apos; or &apos;Full
                  (strict)&apos; to encrypt traffic to the origin.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-white/[0.06] bg-black/40 p-3 text-xs">
            <span className="block font-medium text-white">
              Cluster Endpoint Details
            </span>
            <div className="flex items-center justify-between font-mono text-muted-foreground">
              <span>Cluster Host:</span>
              <span className="text-white">k8s-ingress-prod.local</span>
            </div>
            <div className="flex items-center justify-between font-mono text-muted-foreground">
              <span>Target Port:</span>
              <span className="text-white">80 / 8080 (TCP)</span>
            </div>
            <div className="flex items-center justify-between font-mono text-muted-foreground">
              <span>Replicas:</span>
              <span className="text-white">{replicas} active</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

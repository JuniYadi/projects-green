"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ShieldCheck,
  WarningOctagon,
  Lightning,
  Sparkle,
  ChatCircleText,
  ArrowRight,
  Prohibit,
} from "@phosphor-icons/react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { eden } from "@/lib/eden"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export type AdminAiStatsData = {
  totalQueries24h: number
  totalQueries30d: number
  tokens: {
    promptTokens: number
    responseTokens: number
    totalTokens: number
    estimatedCostUsd: number
    estimatedCostIdr: number
  }
  activeStrikes: number
  activeBans: number
  recentFlaggedFeed: Array<{
    id: string
    sessionId: string
    flagReason: string
    content: string
    channel: string
    userEmail: string | null
    organizationId: string | null
    ipAddress: string | null
    createdAt: string
  }>
}

export default function PortalAiGovernancePage() {
  const params = useParams()
  const lang = typeof params?.lang === "string" ? params.lang : "en"
  const locale = resolveLocaleOrDefault(lang)

  const [stats, setStats] = useState<AdminAiStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function loadStats() {
      try {
        const { data: resData } = await eden.api.admin.ai.stats.get()
        if (isMounted && resData && "ok" in resData && resData.ok) {
          setStats((resData as { ok: true; data: AdminAiStatsData }).data)
        }
      } catch (err) {
        console.error("Failed to load AI stats:", err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadStats()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-primary" />
            AI Governance & Forensic Audit
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time multi-vector guardrails telemetry, forensic transcript
            inspection, and ban management.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={localizePathname({ pathname: "/portal/ai/sessions", locale })}
          >
            <Button variant="outline" size="sm" className="gap-1.5">
              <ChatCircleText className="h-4 w-4" />
              Sessions Explorer
            </Button>
          </Link>
          <Link
            href={localizePathname({ pathname: "/portal/ai/bans", locale })}
          >
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:bg-destructive/10"
            >
              <Prohibit className="h-4 w-4" />
              Active Bans ({stats?.activeBans ?? 0})
            </Button>
          </Link>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Queries (24h / 30d)
            </CardTitle>
            <Sparkle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats?.totalQueries24h.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              30d total:{" "}
              {loading ? "..." : stats?.totalQueries30d.toLocaleString()}{" "}
              prompts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Estimated Token Burn
            </CardTitle>
            <Lightning className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading
                ? "..."
                : `${((stats?.tokens.totalTokens || 0) / 1000).toFixed(1)}k tokens`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Est. ${stats?.tokens.estimatedCostUsd || 0} (~Rp{" "}
              {stats?.tokens.estimatedCostIdr?.toLocaleString() || 0})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Strikes (24h)
            </CardTitle>
            <WarningOctagon className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {loading ? "..." : stats?.activeStrikes}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Violations caught by 4-Tier Guardrails
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Blacklists & Bans
            </CardTitle>
            <Prohibit className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {loading ? "..." : stats?.activeBans}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              IP, Org, or User permanent/temporary bans
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 24-Hour Live Flagged Security Feed */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
              </span>
              Recent Flagged Security Feed (24h Live Stream)
            </h2>
            <p className="text-xs text-muted-foreground">
              Prompts intercepted at edge with 0 token burn or strike recorded.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Loading feed...
              </div>
            ) : !stats?.recentFlaggedFeed ||
              stats.recentFlaggedFeed.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No security violations flagged in the last 24 hours.
              </div>
            ) : (
              <div className="divide-y">
                {stats.recentFlaggedFeed.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="destructive"
                          className="font-mono text-[10px]"
                        >
                          {item.flagReason}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {item.channel}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.userEmail ||
                            item.ipAddress ||
                            item.organizationId ||
                            "Anonymous"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          • {new Date(item.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="line-clamp-1 rounded bg-muted/60 px-2 py-1 font-mono text-xs text-foreground/80">
                        &ldquo;{item.content}&rdquo;
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={localizePathname({
                          pathname: `/portal/ai/sessions/${item.sessionId}`,
                          locale,
                        })}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs"
                        >
                          Inspect
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

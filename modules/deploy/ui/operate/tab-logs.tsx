"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MagnifyingGlass } from "@phosphor-icons/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

import type { LogMessage } from "@/modules/deploy/operate.types"

type TabLogsProps = {
  logs: LogMessage[]
  setLogs: React.Dispatch<React.SetStateAction<LogMessage[]>>
  diagnosticMode: string
}

export function TabLogs({ logs, setLogs, diagnosticMode }: TabLogsProps) {
  const [logFilterQuery, setLogFilterQuery] = useState("")
  const [logFilterLevel, setLogFilterLevel] = useState<
    "ALL" | "INFO" | "WARN" | "ERROR"
  >("ALL")
  const [isLiveTailing, setIsLiveTailing] = useState(true)

  const logConsoleEndRef = useRef<HTMLDivElement>(null)

  // Simulate logs tick
  useEffect(() => {
    if (!isLiveTailing) return

    const interval = setInterval(() => {
      const now = new Date()
      const timestamp = now.toTimeString().split(" ")[0]

      const randomLogs: LogMessage[] = [
        {
          timestamp,
          level: "INFO",
          source: "nginx",
          message: `172.19.0.4 - "GET /api/v1/health HTTP/1.1" 200 42 "-"`,
        },
        {
          timestamp,
          level: "INFO",
          source: "app",
          message: "Resolved route: Api\\HealthController@check",
        },
        {
          timestamp,
          level: "INFO",
          source: "database",
          message: "SQL query completed (0.4ms): SELECT 1",
        },
      ]

      if (diagnosticMode === "error_502") {
        randomLogs.push({
          timestamp,
          level: "ERROR",
          source: "nginx",
          message:
            '[error] 14#14: *1534 connect() failed (111: Connection refused) while connecting to upstream, client: 162.158.12.98, server: laravelshop.com, request: "GET / HTTP/1.1", upstream: "http://127.0.0.1:9000/"',
        })
      } else if (diagnosticMode === "ssl_expired") {
        randomLogs.push({
          timestamp,
          level: "ERROR",
          source: "nginx",
          message:
            "[crit] 14#14: *1539 SSL_do_handshake() failed (SSL: error:0A0000C4:SSL routines::ssl handshake failure:expired certificate) while SSL handshaking, client: 172.69.7.35",
        })
      } else if (diagnosticMode === "redirect_loop") {
        randomLogs.push({
          timestamp,
          level: "WARN",
          source: "nginx",
          message:
            '162.158.14.88 - "GET / HTTP/1.1" 301 162 "-" (Internal redirection loop detected)',
        })
      }

      const randomSelection =
        randomLogs[Math.floor(Math.random() * randomLogs.length)]
      setLogs((prev) => [...prev.slice(-30), randomSelection])
    }, 4000)

    return () => clearInterval(interval)
  }, [isLiveTailing, diagnosticMode, setLogs])

  // Scroll to bottom of logs
  useEffect(() => {
    if (logConsoleEndRef.current && isLiveTailing) {
      logConsoleEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs, isLiveTailing])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchQuery =
        log.message.toLowerCase().includes(logFilterQuery.toLowerCase()) ||
        log.source.toLowerCase().includes(logFilterQuery.toLowerCase())
      const matchLevel =
        logFilterLevel === "ALL" || log.level === logFilterLevel
      return matchQuery && matchLevel
    })
  }, [logs, logFilterQuery, logFilterLevel])

  return (
    <Card
      size="sm"
      className="border-border bg-card/50 shadow-xl backdrop-blur-md dark:bg-[#0A0A0C]/50"
    >
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base font-bold text-foreground">
            Opensearch Log Viewer
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Live streaming log aggregates index from this workspace cluster
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="cursor-pointer text-xs text-muted-foreground select-none"
            onClick={() => setIsLiveTailing(!isLiveTailing)}
          >
            Live Tail
          </span>
          <Switch
            checked={isLiveTailing}
            onCheckedChange={setIsLiveTailing}
            aria-label="Live Tail"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search & Level Filter bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-2.5 text-xs dark:bg-black/40">
          <div className="relative min-w-[240px] flex-1">
            <MagnifyingGlass
              size={15}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder="Search logs (e.g. nginx, connect, database)..."
              value={logFilterQuery}
              onChange={(e) => setLogFilterQuery(e.target.value)}
              className="h-8 rounded-lg pl-9 text-xs"
            />
          </div>

          <div className="flex gap-1.5">
            {(["ALL", "INFO", "WARN", "ERROR"] as const).map((lvl) => {
              const isActive = logFilterLevel === lvl
              const dotColor =
                lvl === "INFO"
                  ? "bg-blue-400"
                  : lvl === "WARN"
                    ? "bg-amber-400"
                    : lvl === "ERROR"
                      ? "bg-red-400"
                      : "bg-foreground"
              return (
                <Button
                  key={lvl}
                  type="button"
                  onClick={() => setLogFilterLevel(lvl)}
                  variant={isActive ? "default" : "outline"}
                  size="xs"
                  className="flex h-8 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                  {lvl}
                </Button>
              )
            })}
          </div>
        </div>

        {/* Logs display shell */}
        <div className="max-h-[350px] min-h-[220px] space-y-1 overflow-auto rounded-xl border border-border bg-zinc-950 px-4 py-3.5 font-mono text-[11px] leading-relaxed text-zinc-100 shadow-inner dark:bg-[#050507]">
          {filteredLogs.map((log, idx) => {
            const levelBadgeStyle =
              log.level === "ERROR"
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : log.level === "WARN"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/20"

            const sourceBadgeStyle =
              log.source === "nginx"
                ? "text-purple-400"
                : log.source === "app"
                  ? "text-cyan-400"
                  : "text-amber-300"

            return (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-lg border border-transparent px-2 py-1 transition-colors select-text hover:border-white/[0.03] hover:bg-white/[0.03]"
              >
                <span className="shrink-0 font-semibold text-muted-foreground/60 select-none">
                  {log.timestamp}
                </span>
                <span
                  className={`py-0.2 shrink-0 rounded border px-1.5 text-[9px] font-bold tracking-wider uppercase ${levelBadgeStyle}`}
                >
                  {log.level}
                </span>
                <span
                  className={`shrink-0 text-[10px] font-semibold ${sourceBadgeStyle}`}
                >
                  [{log.source}]
                </span>
                <span className="leading-relaxed font-medium break-all text-white/90">
                  {log.message}
                </span>
              </div>
            )
          })}

          {filteredLogs.length === 0 && (
            <div className="p-10 text-center font-sans text-xs font-medium text-muted-foreground/80">
              No log outputs correspond to the search queries.
            </div>
          )}
          <div ref={logConsoleEndRef} />
        </div>
      </CardContent>
    </Card>
  )
}

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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

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
    <Card className="border-white/[0.06] bg-black/25">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-bold text-white">
            Opensearch Log Viewer
          </CardTitle>
          <CardDescription>
            Live streaming log aggregates index from this workspace cluster
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none">
            <Checkbox
              checked={isLiveTailing}
              onCheckedChange={(checked) => setIsLiveTailing(checked === true)}
              className="border-white/20 bg-black/50 data-[state=checked]:bg-primary"
            />
            Live Tail
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search & Level Filter bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-black/40 p-3 text-xs">
          <div className="relative min-w-[200px] flex-1">
            <MagnifyingGlass
              size={16}
              className="absolute top-2.5 left-3 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder="Search logs (e.g. nginx, connect, database)..."
              value={logFilterQuery}
              onChange={(e) => setLogFilterQuery(e.target.value)}
              className="h-8 bg-black/50 pl-9 text-xs"
            />
          </div>

          <div className="flex gap-1.5">
            {(["ALL", "INFO", "WARN", "ERROR"] as const).map((lvl) => (
              <Button
                key={lvl}
                type="button"
                onClick={() => setLogFilterLevel(lvl)}
                variant={logFilterLevel === lvl ? "default" : "outline"}
                size="xs"
                className={`rounded px-2.5 py-1.5 font-bold transition-all ${
                  logFilterLevel === lvl
                    ? "text-white"
                    : "bg-black/40 text-muted-foreground hover:text-white"
                }`}
              >
                {lvl}
              </Button>
            ))}
          </div>
        </div>

        {/* Logs display shell */}
        <div className="max-h-[380px] min-h-[250px] space-y-1 overflow-y-auto rounded-xl border border-white/[0.08] bg-black p-5 font-mono text-[11px] leading-relaxed">
          {filteredLogs.map((log, idx) => (
            <div
              key={idx}
              className="flex gap-2.5 rounded p-0.5 select-text hover:bg-white/[0.02]"
            >
              <span className="shrink-0 text-muted-foreground">
                [{log.timestamp}]
              </span>
              <span
                className={`shrink-0 font-bold ${
                  log.level === "ERROR"
                    ? "text-red-500"
                    : log.level === "WARN"
                      ? "text-yellow-500"
                      : "text-blue-400"
                }`}
              >
                {log.level}
              </span>
              <span className="shrink-0 text-purple-400">[{log.source}]</span>
              <span className="break-all text-white">{log.message}</span>
            </div>
          ))}

          {filteredLogs.length === 0 && (
            <div className="p-8 text-center font-sans text-muted-foreground">
              No log outputs correspond to the search queries.
            </div>
          )}
          <div ref={logConsoleEndRef} />
        </div>
      </CardContent>
    </Card>
  )
}

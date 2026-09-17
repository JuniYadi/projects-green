import { useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Play,
  Pause,
  ArrowClockwise,
  TerminalWindow,
} from "@phosphor-icons/react"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { AppTrafficLogItemDTO } from "../../opensearch/opensearch-traffic.types"

export interface TrafficLiveStreamTableProps {
  appSlug: string
  locale?: string
}

export function TrafficLiveStreamTable({
  appSlug,
  locale: localeProp,
}: TrafficLiveStreamTableProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(localeProp ?? params?.lang)
  const messages = getMessages(locale)
  const t = messages.pDeployOperateTrafficLiveStreamTable
  const numLocale = locale === "en" ? "en-US" : "id-ID"
  const [isLive, setIsLive] = useState(true)
  const [statusFilter, setStatusFilter] = useState<
    "all" | "2xx" | "4xx" | "5xx"
  >("all")
  const [logsBuffer, setLogsBuffer] = useState<AppTrafficLogItemDTO[]>([])

  const fetchLogs = useCallback(async () => {
    if (!appSlug) return []
    const queryParams = new URLSearchParams()
    queryParams.set("limit", "25")
    if (statusFilter !== "all") {
      queryParams.set("status", statusFilter)
    }

    const res = await fetch(
      `/api/deploy/apps/${encodeURIComponent(appSlug)}/traffic/logs?${queryParams.toString()}`
    )
    if (!res.ok) throw new Error(t.fetchError)
    const json = await res.json()
    return (json.data ?? []) as AppTrafficLogItemDTO[]
  }, [appSlug, statusFilter])
  const { isFetching, refetch } = useQuery({
    queryKey: ["traffic-live-logs", appSlug, statusFilter],
    queryFn: async () => {
      const newItems = await fetchLogs()
      setLogsBuffer((prev) => {
        // Merge and deduplicate by id, keeping at most 100 latest items
        const existingIds = new Set(prev.map((l) => l.id))
        const filteredNew = newItems.filter((item) => !existingIds.has(item.id))
        const combined = [...filteredNew, ...prev]
        return combined.slice(0, 100)
      })
      return newItems
    },
    enabled: isLive,
    refetchInterval: isLive ? 3000 : false,
    refetchOnWindowFocus: true,
  })

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <TerminalWindow size={18} className="text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                {t.title}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t.description}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center rounded-lg border border-border bg-muted/10 p-0.5 text-xs">
              {(["all", "2xx", "4xx", "5xx"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === filter
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {filter.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Play/Pause Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!isLive) {
                  refetch()
                }
                setIsLive(!isLive)
              }}
              className="gap-1.5 text-xs"
            >
              {isLive ? (
                <>
                  <Pause size={14} weight="fill" className="text-amber-500" />
                  <span>{t.pauseStream}</span>
                </>
              ) : (
                <>
                  <Play size={14} weight="fill" className="text-primary" />
                  <span>{t.resumeStream}</span>
                </>
              )}
            </Button>

            {/* Manual Refresh */}
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => refetch()}
              className="px-2"
              title={t.refreshTooltip}
            >
              <ArrowClockwise
                size={14}
                className={isFetching ? "animate-spin" : ""}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {logsBuffer.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/5 text-center text-xs text-muted-foreground">
            {isLive ? (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span>{t.listeningLive}</span>
              </div>
            ) : (
              <p>{t.streamPaused}</p>
            )}
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border bg-muted/5 font-mono text-xs">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 border-b border-border bg-muted/30 text-[11px] text-muted-foreground">
                <tr>
                  <th className="p-2.5 font-medium">{t.tableHeaderTime}</th>
                  <th className="p-2.5 font-medium">{t.tableHeaderStatus}</th>
                  <th className="p-2.5 font-medium">{t.tableHeaderMethod}</th>
                  <th className="p-2.5 font-medium">{t.tableHeaderPath}</th>
                  <th className="p-2.5 font-medium">{t.tableHeaderDuration}</th>
                  <th className="p-2.5 font-medium">{t.tableHeaderSize}</th>
                  <th className="p-2.5 font-medium">{t.tableHeaderClientIp}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logsBuffer.map((log) => {
                  const isErr = log.statusCode >= 400
                  return (
                    <tr key={log.id} className="hover:bg-muted/10">
                      <td className="p-2.5 text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString(numLocale)}
                      </td>
                      <td className="p-2.5">
                        <Badge
                          variant="outline"
                          className={
                            isErr
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                          }
                        >
                          {log.statusCode}
                        </Badge>
                      </td>
                      <td className="p-2.5 font-semibold text-foreground">
                        {log.method}
                      </td>
                      <td className="max-w-[200px] truncate p-2.5 text-foreground sm:max-w-[320px]">
                        {log.path}
                      </td>
                      <td className="p-2.5 text-muted-foreground">
                        {log.latencyMs} ms
                      </td>
                      <td className="p-2.5 text-muted-foreground">
                        {log.bytes > 1024
                          ? `${(log.bytes / 1024).toFixed(1)} KB`
                          : `${log.bytes} B`}
                      </td>
                      <td className="p-2.5 text-muted-foreground">
                        {log.clientIp}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

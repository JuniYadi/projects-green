"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  Copy,
  Check,
  MagnifyingGlass,
  Funnel,
  Columns,
  Code,
  ListDashes,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { LogMessage } from "@/modules/deploy/operate.types"
import type { NormalizedLogEntry } from "@/modules/deploy/opensearch/opensearch-log-normalizer"
import { flattenObject, formatAttributeValue } from "./log-table-utils"

type LogInspectorDrawerProps = {
  log: (NormalizedLogEntry | LogMessage) | null
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedColumns?: string[]
  onAddColumn?: (field: string) => void
  onApplyFilter?: (text: string) => void
  locale?: string
}

export function LogInspectorDrawer({
  log,
  open,
  onOpenChange,
  selectedColumns = [],
  onAddColumn,
  onApplyFilter,
  locale: localeProp,
}: LogInspectorDrawerProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(localeProp ?? params?.lang)
  const messages = getMessages(locale)
  const t = messages.pDeployOperateLogInspectorDrawer
  const [attributeSearch, setAttributeSearch] = useState("")
  const [activeTab, setActiveTab] = useState("attributes")
  const [categoryFilter, setCategoryFilter] = useState<"all" | "app" | "infra">(
    "all"
  )
  const [copiedRaw, setCopiedRaw] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const normalizedLog = log as NormalizedLogEntry | null
  const rawData = normalizedLog?.raw ?? (log as Record<string, unknown> | null)

  const flattenedAttributes = useMemo(() => {
    if (!rawData) return []
    const flat = flattenObject(rawData)
    return Object.entries(flat).map(([key, value]) => ({
      key,
      value: formatAttributeValue(value),
      rawValue: value,
    }))
  }, [rawData])

  // Extract key quick insights (HTTP, latency, IP)
  const quickInsights = useMemo(() => {
    if (!flattenedAttributes.length) return null
    const findVal = (prefixes: string[]) => {
      for (const prefix of prefixes) {
        const match = flattenedAttributes.find(
          (a) => a.key.toLowerCase() === prefix.toLowerCase()
        )
        if (match) return match.value
      }
      return null
    }

    const method = findVal(["req.method", "http.method", "method"])
    const status = findVal([
      "res.statusCode",
      "http.status_code",
      "statusCode",
      "status",
    ])
    const url = findVal(["req.url", "http.url", "url", "path"])
    const clientIp = findVal([
      "req.ip",
      "http.client_ip",
      "client_ip",
      "clientip",
      "ip",
    ])
    const responseTime = findVal([
      "responseTime",
      "latency",
      "duration",
      "elapsed",
    ])

    if (!method && !status && !url && !clientIp && !responseTime) return null
    return { method, status, url, clientIp, responseTime }
  }, [flattenedAttributes])

  const filteredAttributes = useMemo(() => {
    return flattenedAttributes.filter((attr) => {
      // Category filter
      if (categoryFilter === "app" && attr.key.startsWith("kubernetes.")) {
        return false
      }
      if (categoryFilter === "infra" && !attr.key.startsWith("kubernetes.")) {
        return false
      }

      // Search query
      if (!attributeSearch.trim()) return true
      const q = attributeSearch.toLowerCase().trim()
      return (
        attr.key.toLowerCase().includes(q) ||
        attr.value.toLowerCase().includes(q)
      )
    })
  }, [flattenedAttributes, attributeSearch, categoryFilter])

  const rawJsonString = useMemo(() => {
    if (!log) return ""
    return JSON.stringify(rawData ?? log, null, 2)
  }, [log, rawData])

  const handleCopyRawJson = () => {
    if (!rawJsonString) return
    void navigator.clipboard.writeText(rawJsonString)
    setCopiedRaw(true)
    toast.success(t.copiedJsonSuccess)
    setTimeout(() => setCopiedRaw(false), 2000)
  }

  const handleCopyValue = (key: string, val: string) => {
    void navigator.clipboard.writeText(val)
    setCopiedKey(key)
    toast.success(t.copiedValueSuccess.replace("{key}", key))
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const levelBadgeClass =
    log?.level === "ERROR"
      ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
      : log?.level === "WARN"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
        : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"

  if (!log) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-border bg-card p-0 sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-border p-4 pb-3">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <span
                className={`rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${levelBadgeClass}`}
              >
                {log.level}
              </span>
              <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-foreground">
                {log.source}
              </span>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {normalizedLog?.isoTimestamp ?? log.timestamp}
            </span>
          </div>

          <SheetTitle className="pt-2 text-left text-sm font-semibold text-foreground">
            {t.logEventDetails}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t.drawerDescription}
          </SheetDescription>

          {/* Quick actions toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleCopyRawJson}
              className="flex h-7 items-center gap-1.5 rounded-lg text-xs"
            >
              {copiedRaw ? (
                <Check size={13} className="text-emerald-500" />
              ) : (
                <Copy size={13} />
              )}
              <span>{copiedRaw ? t.copied : t.copyJson}</span>
            </Button>

            {onApplyFilter && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  onApplyFilter(log.message)
                  onOpenChange(false)
                }}
                className="flex h-7 items-center gap-1.5 rounded-lg text-xs"
              >
                <Funnel size={13} />
                <span>{t.filterThisMessage}</span>
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Full message section & quick insights */}
        <div className="space-y-2.5 border-b border-border bg-muted/10 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>{t.fullMessageLabel}</span>
          </div>
          <div className="max-h-36 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground select-text">
            {log.message || "-"}
          </div>

          {quickInsights && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
              {quickInsights.method && (
                <span className="rounded bg-muted px-2 py-0.5 font-mono font-semibold text-foreground">
                  {quickInsights.method}
                </span>
              )}
              {quickInsights.status && (
                <span
                  className={`rounded px-2 py-0.5 font-mono font-semibold ${
                    Number(quickInsights.status) >= 500
                      ? "bg-red-500/15 text-red-700 dark:text-red-400"
                      : Number(quickInsights.status) >= 400
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {quickInsights.status}
                </span>
              )}
              {quickInsights.url && (
                <span className="max-w-[200px] truncate rounded bg-muted/60 px-2 py-0.5 font-mono text-muted-foreground">
                  {quickInsights.url}
                </span>
              )}
              {quickInsights.responseTime && (
                <span className="rounded bg-muted/60 px-2 py-0.5 font-mono text-muted-foreground">
                  {quickInsights.responseTime}
                </span>
              )}
              {quickInsights.clientIp && (
                <span className="rounded bg-muted/60 px-2 py-0.5 font-mono text-muted-foreground">
                  {quickInsights.clientIp}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden p-4">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-1 flex-col"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
              <TabsList className="h-8">
                <TabsTrigger
                  value="attributes"
                  className="flex items-center gap-1.5 text-xs"
                >
                  <ListDashes size={13} />
                  <span>
                    {t.attributesTab.replace(
                      "{count}",
                      String(filteredAttributes.length)
                    )}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="raw"
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Code size={13} />
                  <span>{t.rawJsonTab}</span>
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                {activeTab === "attributes" && (
                  <div className="flex rounded-md border border-border bg-muted/30 p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("all")}
                      className={`rounded px-2 py-1 font-medium transition-colors ${
                        categoryFilter === "all"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.allAttributesChip}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("app")}
                      className={`rounded px-2 py-1 font-medium transition-colors ${
                        categoryFilter === "app"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.appAttributesChip}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("infra")}
                      className={`rounded px-2 py-1 font-medium transition-colors ${
                        categoryFilter === "infra"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.infraAttributesChip}
                    </button>
                  </div>
                )}

                <div className="relative w-36 sm:w-44">
                  <MagnifyingGlass
                    size={13}
                    className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={attributeSearch}
                    onChange={(e) => setAttributeSearch(e.target.value)}
                    className="h-7 rounded-lg pl-7 text-[11px]"
                  />
                </div>
              </div>
            </div>

            <TabsContent
              value="attributes"
              className="flex-1 overflow-auto rounded-lg border border-border bg-card"
            >
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-1/3 text-xs font-semibold text-foreground">
                      {t.tableHeaderField}
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      {t.tableHeaderValue}
                    </TableHead>
                    <TableHead className="w-24 text-right text-xs font-semibold text-foreground">
                      {t.tableHeaderAction}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttributes.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        {t.noMatchingAttributes}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAttributes.map((attr) => {
                      const isColumnActive = selectedColumns.includes(attr.key)
                      return (
                        <TableRow
                          key={attr.key}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <TableCell className="py-2 align-top font-mono text-[11px] font-medium text-foreground">
                            {attr.key}
                          </TableCell>
                          <TableCell className="max-w-[280px] py-2 align-top font-mono text-[11px] break-all text-muted-foreground">
                            {attr.value}
                          </TableCell>
                          <TableCell className="py-1.5 text-right align-top">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyValue(attr.key, attr.value)
                                }
                                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                title={t.copyValueTooltip}
                              >
                                {copiedKey === attr.key ? (
                                  <Check
                                    size={12}
                                    className="text-emerald-500"
                                  />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>

                              {onApplyFilter && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onApplyFilter(`${attr.key}:"${attr.value}"`)
                                    onOpenChange(false)
                                  }}
                                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  title={t.filterValueTooltip}
                                >
                                  <Funnel size={12} />
                                </button>
                              )}

                              {onAddColumn && (
                                <button
                                  type="button"
                                  onClick={() => onAddColumn(attr.key)}
                                  className={`rounded p-1 transition-colors ${
                                    isColumnActive
                                      ? "bg-primary/10 text-primary"
                                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                  }`}
                                  title={
                                    isColumnActive
                                      ? t.columnAlreadyActive
                                      : t.addToTableColumns
                                  }
                                >
                                  <Columns size={12} />
                                </button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent
              value="raw"
              className="flex-1 overflow-auto rounded-lg border border-border bg-muted/20 p-3"
            >
              <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground select-text">
                {rawJsonString}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}

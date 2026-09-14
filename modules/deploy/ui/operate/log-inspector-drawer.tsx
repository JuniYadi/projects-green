"use client"

import { useMemo, useState } from "react"
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
}

export function LogInspectorDrawer({
  log,
  open,
  onOpenChange,
  selectedColumns = [],
  onAddColumn,
  onApplyFilter,
}: LogInspectorDrawerProps) {
  const [attributeSearch, setAttributeSearch] = useState("")
  const [activeTab, setActiveTab] = useState("attributes")
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

  const filteredAttributes = useMemo(() => {
    if (!attributeSearch.trim()) return flattenedAttributes
    const q = attributeSearch.toLowerCase().trim()
    return flattenedAttributes.filter(
      (attr) =>
        attr.key.toLowerCase().includes(q) ||
        attr.value.toLowerCase().includes(q)
    )
  }, [flattenedAttributes, attributeSearch])

  const rawJsonString = useMemo(() => {
    if (!log) return ""
    return JSON.stringify(rawData ?? log, null, 2)
  }, [log, rawData])

  const handleCopyRawJson = () => {
    if (!rawJsonString) return
    void navigator.clipboard.writeText(rawJsonString)
    setCopiedRaw(true)
    toast.success("JSON log berhasil disalin ke clipboard")
    setTimeout(() => setCopiedRaw(false), 2000)
  }

  const handleCopyValue = (key: string, val: string) => {
    void navigator.clipboard.writeText(val)
    setCopiedKey(key)
    toast.success(`Nilai ${key} disalin`)
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

          <SheetTitle className="line-clamp-2 pt-2 text-left text-sm font-semibold text-foreground">
            {log.message || "Log Event Details"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detail inspeksi log event dan seluruh metadata JSON
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
              <span>{copiedRaw ? "Tersalin" : "Salin JSON"}</span>
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
                <span>Filter Pesan Ini</span>
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-hidden p-4">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-1 flex-col"
          >
            <div className="flex items-center justify-between pb-3">
              <TabsList className="h-8">
                <TabsTrigger
                  value="attributes"
                  className="flex items-center gap-1.5 text-xs"
                >
                  <ListDashes size={13} />
                  <span>Atribut ({flattenedAttributes.length})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="raw"
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Code size={13} />
                  <span>Raw JSON</span>
                </TabsTrigger>
              </TabsList>

              <div className="relative w-48">
                <MagnifyingGlass
                  size={13}
                  className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="text"
                  placeholder="Cari atribut..."
                  value={attributeSearch}
                  onChange={(e) => setAttributeSearch(e.target.value)}
                  className="h-7 rounded-lg pl-7 text-[11px]"
                />
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
                      Field
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">
                      Nilai
                    </TableHead>
                    <TableHead className="w-24 text-right text-xs font-semibold text-foreground">
                      Aksi
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
                        Tidak ada atribut yang cocok.
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
                                title="Salin nilai"
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
                                  title="Filter nilai ini"
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
                                      ? "Kolom sudah aktif"
                                      : "Tambah ke kolom tabel"
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

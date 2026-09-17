"use client"

import * as React from "react"
import { useParams, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AuditLogTable,
  type AuditLogDTO,
} from "@/modules/whatsapp/audit/ui/whatsapp-audit-table"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

const AUDIT_ACTIONS = [
  "TEMPLATE_SYNC_REQUESTED",
  "TEMPLATE_SYNCED",
  "TEMPLATE_SYNC_FAILED",
  "TEMPLATE_CREATED",
  "TEMPLATE_CREATE_FAILED",
  "TEMPLATE_UPDATED",
  "TEMPLATE_UPDATE_FAILED",
  "TEMPLATE_DELETED",
  "DEVICE_INFO_UPDATED",
  "DEVICE_STATUS_CHANGED",
  "DEVICE_QUOTA_RESET",
  "DEVICE_QUOTA_TOPUP",
  "DEVICE_CALLBACK_URL_UPDATED",
  "MESSAGE_SENT",
  "MESSAGE_FAILED",
  "CONTACT_IMPORTED",
  "CONTACT_GROUP_CREATED",
  "CONTACT_GROUP_UPDATED",
]

const AUDIT_STATUSES = ["OK", "FAILED", "STARTED", "PENDING"]

export default function PortalWhatsAppAuditLogsPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const searchParams = useSearchParams()

  const [logs, setLogs] = React.useState<AuditLogDTO[]>([])
  const [page, setPage] = React.useState(Number(searchParams.get("page")) || 1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(0)
  const [pageState, setPageState] = React.useState<
    "loading" | "error" | "loaded"
  >("loading")
  const [errorMessage, setErrorMessage] = React.useState("")

  // Filters
  const [filterAction, setFilterAction] = React.useState(
    searchParams.get("action") ?? ""
  )
  const [filterStatus, setFilterStatus] = React.useState(
    searchParams.get("status") ?? ""
  )
  const [filterDeviceId, setFilterDeviceId] = React.useState(
    searchParams.get("deviceId") ?? ""
  )
  const [filterQ, setFilterQ] = React.useState(searchParams.get("q") ?? "")
  const [filterFrom, setFilterFrom] = React.useState(
    searchParams.get("from") ?? ""
  )
  const [filterTo, setFilterTo] = React.useState(searchParams.get("to") ?? "")

  const loadFailedMessage =
    messages.pPortalWhatsappAuditLogsPageClient.loadFailed

  const buildQuery = React.useCallback(() => {
    const q: Record<string, string> = { page: String(page), limit: "50" }
    if (filterAction) q.action = filterAction
    if (filterStatus) q.status = filterStatus
    if (filterDeviceId) q.deviceId = filterDeviceId
    if (filterQ) q.q = filterQ
    if (filterFrom) q.from = filterFrom
    if (filterTo) q.to = filterTo
    return q
  }, [
    page,
    filterAction,
    filterStatus,
    filterDeviceId,
    filterQ,
    filterFrom,
    filterTo,
  ])

  React.useEffect(() => {
    const fetchData = async () => {
      setPageState("loading")
      setErrorMessage("")
      try {
        const q = buildQuery()
        const params = new URLSearchParams(q)
        // ponytail: audit routes aren't in Eden's type system yet — use raw fetch
        // eslint-disable-next-line no-restricted-globals
        const res = await fetch(`/api/admin/whatsapp/audit?${params}`)
        const result = (await res.json()) as {
          ok: boolean
          data: AuditLogDTO[]
          pagination: { page: number; total: number; totalPages: number }
        }
        if (result.ok) {
          setLogs(result.data)
          setTotal(result.pagination.total)
          setTotalPages(result.pagination.totalPages)
          setPage(result.pagination.page)
          setPageState("loaded")
        } else {
          setErrorMessage(loadFailedMessage)
          setPageState("error")
        }
      } catch (err) {
        setErrorMessage(String(err))
        setPageState("error")
      }
    }

    fetchData()
  }, [
    page,
    filterAction,
    filterStatus,
    filterDeviceId,
    filterQ,
    filterFrom,
    filterTo,
    buildQuery,
    loadFailedMessage,
  ])

  const handleResetFilters = () => {
    setFilterAction("")
    setFilterStatus("")
    setFilterDeviceId("")
    setFilterQ("")
    setFilterFrom("")
    setFilterTo("")
    setPage(1)
  }
  const handleApplyFilters = () => {
    setPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const retry = () => setPage(1)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-semibold">
          {messages.pPortalWhatsappAuditLogsPageClient.pageTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {messages.pPortalWhatsappAuditLogsPageClient.pageDescription}
        </p>
      </header>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {messages.pPortalWhatsappAuditLogsPageClient.actionLabel}
          </label>
          <select
            className="h-9 rounded-md border px-3 text-sm"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="">
              {messages.pPortalWhatsappAuditLogsPageClient.allOption}
            </option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {messages.pPortalWhatsappAuditLogsPageClient.statusLabel}
          </label>
          <select
            className="h-9 rounded-md border px-3 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">
              {messages.pPortalWhatsappAuditLogsPageClient.allOption}
            </option>
            {AUDIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {messages.pPortalWhatsappAuditLogsPageClient.deviceIdLabel}
          </label>
          <Input
            placeholder={
              messages.pPortalWhatsappAuditLogsPageClient.deviceIdLabel
            }
            className="h-9 w-40"
            value={filterDeviceId}
            onChange={(e) => setFilterDeviceId(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {messages.pPortalWhatsappAuditLogsPageClient.searchLabel}
          </label>
          <Input
            placeholder={
              messages.pPortalWhatsappAuditLogsPageClient.searchPlaceholder
            }
            className="h-9 w-48"
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {messages.pPortalWhatsappAuditLogsPageClient.fromLabel}
          </label>
          <Input
            type="date"
            className="h-9 w-36"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {messages.pPortalWhatsappAuditLogsPageClient.toLabel}
          </label>
          <Input
            type="date"
            className="h-9 w-36"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleApplyFilters}>
            {messages.pPortalWhatsappAuditLogsPageClient.apply}
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            {messages.pPortalWhatsappAuditLogsPageClient.reset}
          </Button>
        </div>
      </div>

      {/* Table */}
      <AuditLogTable
        logs={logs}
        isLoading={pageState === "loading"}
        error={pageState === "error" ? errorMessage : undefined}
        onRetry={retry}
        showPayload={true}
        messageJourneyBasePath="/portal/whatsapp/messages"
        pagination={
          totalPages > 1
            ? { page, totalPages, total, onPageChange: handlePageChange }
            : undefined
        }
      />
    </main>
  )
}

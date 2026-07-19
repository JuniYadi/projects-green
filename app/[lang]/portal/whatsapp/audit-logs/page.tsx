"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AuditLogTable,
  type AuditLogDTO,
} from "@/modules/whatsapp/audit/ui/whatsapp-audit-table"

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
  "DEVICE_CALLBACK_URL_UPDATED",
  "MESSAGE_SENT",
  "MESSAGE_FAILED",
  "CONTACT_IMPORTED",
  "CONTACT_GROUP_CREATED",
  "CONTACT_GROUP_UPDATED",
]

const AUDIT_STATUSES = ["OK", "FAILED", "STARTED", "PENDING"]

export default function PortalWhatsAppAuditLogsPage() {
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
        const res = await fetch(`/api/whatsapp/admin/whatsapp/audit?${params}`)
        const result = (await res.json()) as {
          ok: boolean
          data: AuditLogDTO[]
          pagination: { page: number; total: number; totalPages: number }
        }
        if (!result.ok) throw new Error("Failed to load audit logs")
        setLogs(result.data)
        setTotal(result.pagination.total)
        setTotalPages(result.pagination.totalPages)
        setPageState("loaded")
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to load audit logs"
        )
        setPageState("error")
      }
    }
    fetchData()
    // ponytail: only re-fetch when page or filters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    filterAction,
    filterStatus,
    filterDeviceId,
    filterQ,
    filterFrom,
    filterTo,
  ])

  const handleApplyFilters = () => {
    setPage(1)
  }

  const handleResetFilters = () => {
    setFilterAction("")
    setFilterStatus("")
    setFilterDeviceId("")
    setFilterQ("")
    setFilterFrom("")
    setFilterTo("")
    setPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const retry = () => setPage(1)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-semibold">WhatsApp Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Track all admin actions related to WhatsApp.
        </p>
      </header>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Action
          </label>
          <select
            className="h-9 rounded-md border px-3 text-sm"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="">All</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <select
            className="h-9 rounded-md border px-3 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All</option>
            {AUDIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Device ID
          </label>
          <Input
            placeholder="deviceId"
            className="h-9 w-40"
            value={filterDeviceId}
            onChange={(e) => setFilterDeviceId(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input
            placeholder="message, adminId, deviceId"
            className="h-9 w-48"
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            From
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
            To
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
            Apply
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            Reset
          </Button>
        </div>
      </div>

      {/* Table */}
      <AuditLogTable
        logs={logs}
        isLoading={pageState === "loading"}
        error={pageState === "error" ? errorMessage : undefined}
        onRetry={retry}
        pagination={
          totalPages > 1
            ? { page, totalPages, total, onPageChange: handlePageChange }
            : undefined
        }
      />
    </main>
  )
}

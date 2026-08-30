"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AuditLogDTO,
  AuditLogTable,
} from "@/modules/whatsapp/audit/ui/whatsapp-audit-table"
import type { Messages } from "@/lib/i18n/types"
import { eden } from "@/lib/eden"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type AuditQuery = {
  page?: string
  limit?: string
  action?: string
  status?: string
  deviceId?: string
  q?: string
  from?: string
  to?: string
}
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

export function AuditLogsTabContent({
  locale: _locale,
  messages: _messages,
}: {
  locale: string
  messages: Messages
}) {
  const [logs, setLogs] = React.useState<AuditLogDTO[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string>()
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)

  // Filters
  const [selectedAction, setSelectedAction] = React.useState<string>("All")
  const [selectedStatus, setSelectedStatus] = React.useState<string>("All")
  const [deviceId, setDeviceId] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")

  const fetchLogs = React.useCallback(async () => {
    setIsLoading(true)
    setError(undefined)

    try {
      const query: AuditQuery = {
        page: String(page),
        limit: "15",
      }

      if (selectedAction && selectedAction !== "All") {
        query.action = selectedAction
      }
      if (selectedStatus && selectedStatus !== "All") {
        query.status = selectedStatus
      }
      if (deviceId.trim()) {
        query.deviceId = deviceId.trim()
      }
      if (search.trim()) {
        query.q = search.trim()
      }
      if (dateFrom) {
        query.from = new Date(dateFrom).toISOString()
      }
      if (dateTo) {
        query.to = new Date(dateTo).toISOString()
      }

      const res = await eden.api.whatsapp.audit.get({ query })
      if (
        res.status === 200 &&
        res.data &&
        "ok" in res.data &&
        res.data.ok &&
        Array.isArray(res.data.data)
      ) {
        setLogs(res.data.data as unknown as AuditLogDTO[])
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1)
          setTotal(res.data.pagination.total || 0)
        }
      } else {
        const errData = res.data as
          | { message?: string; error?: string }
          | undefined
        throw new Error(
          errData?.message || errData?.error || "Failed to load logs"
        )
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      )
    } finally {
      setIsLoading(false)
    }
  }, [page, selectedAction, selectedStatus, deviceId, search, dateFrom, dateTo])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLogs()
  }, [fetchLogs])
  const handleApplyFilters = () => {
    setPage(1)
    void fetchLogs()
  }

  const handleResetFilters = () => {
    setSelectedAction("All")
    setSelectedStatus("All")
    setDeviceId("")
    setSearch("")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Filter Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Action
              </label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Actions</SelectItem>
                  {AUDIT_ACTIONS.map((act) => (
                    <SelectItem key={act} value={act}>
                      {act}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  {AUDIT_STATUSES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Device ID
              </label>
              <Input
                placeholder="Filter by device ID"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Search
              </label>
              <Input
                placeholder="Message, actor, IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 text-xs"
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleApplyFilters}
              className="h-8 text-xs"
            >
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>
            WhatsApp organization audit entries and operator actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogTable
            logs={logs}
            isLoading={isLoading}
            error={error}
            onRetry={() => void fetchLogs()}
            pagination={{
              page,
              totalPages,
              total,
              onPageChange: (newPage) => setPage(newPage),
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { eden } from "@/lib/eden"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

type EmailLogListItem = {
  id: string
  recipientEmail: string
  type: string
  subject: string
  status: string
  organizationId: string | null
  relatedEntityType: string | null
  relatedEntityId: string | null
  ticketId: string | null
  ticketNumber: string | null
  providerMessageId: string | null
  errorMessage: string | null
  attempts: number
  sentAt: string | null
  createdAt: string
  updatedAt: string
  hasPreview: boolean
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "QUEUED", label: "Queued" },
  { value: "SENT", label: "Sent" },
  { value: "FAILED", label: "Failed" },
  { value: "BOUNCED", label: "Bounced" },
]

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "TICKET_CREATED", label: "Ticket Created" },
  { value: "TICKET_REPLIED", label: "Ticket Replied" },
  { value: "TICKET_CLOSED", label: "Ticket Closed" },
  { value: "TICKET_ADMIN_ALERT", label: "Ticket Admin Alert" },
  { value: "INVOICE_CREATED", label: "Invoice Created" },
  { value: "INVOICE_PAYMENT_REMINDER", label: "Invoice Payment Reminder" },
  { value: "INVOICE_PAID", label: "Invoice Paid" },
  { value: "INVOICE_OVERDUE", label: "Invoice Overdue" },
  { value: "INVOICE_CANCELLED", label: "Invoice Cancelled" },
  { value: "VPN_SUBSCRIPTION_CREATED", label: "VPN Subscription Created" },
  { value: "VPN_PROVISIONING_SUCCESS", label: "VPN Provisioning Success" },
  { value: "VPN_PROVISIONING_FAILED", label: "VPN Provisioning Failed" },
  { value: "VPN_RENEWAL_SUCCESS", label: "VPN Renewal Success" },
  { value: "VPN_RENEWAL_FAILED", label: "VPN Renewal Failed" },
  { value: "VPN_SUBSCRIPTION_SUSPENDED", label: "VPN Subscription Suspended" },
  { value: "VPN_SUBSCRIPTION_EXPIRED", label: "VPN Subscription Expired" },
  { value: "VPN_SUBSCRIPTION_CANCELLED", label: "VPN Subscription Cancelled" },
]

const PAGE_SIZE = 20

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatType(type: string): string {
  return TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type
}

export function DeliveryLogsView() {
  const [logs, setLogs] = useState<EmailLogListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")
  const [type, setType] = useState("")
  const [recipient, setRecipient] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [previewLog, setPreviewLog] = useState<EmailLogListItem | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchLogs() {
      setIsLoading(true)
      const query: {
        page: number
        limit: number
        status?: string
        type?: string
        recipient?: string
        organizationId?: string
      } = {
        page,
        limit: PAGE_SIZE,
      }
      if (status) query.status = status
      if (type) query.type = type
      if (recipient) query.recipient = recipient

      const res = await eden.api["email-logs"].get({ $query: query })
      if (cancelled) return
      if (!res.data?.ok) {
        setLogs([])
        setTotal(0)
      } else {
        setLogs(res.data.data ?? [])
        setTotal(res.data.pagination?.total ?? 0)
      }
      setIsLoading(false)
    }
    void fetchLogs()
    return () => {
      cancelled = true
    }
  }, [page, status, type, recipient])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search recipient..."
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value)
            setPage(1)
          }}
          className="w-48"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Related Entity</TableHead>
              <TableHead>Sent At</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Preview</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  No email delivery logs found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="max-w-32 truncate">
                    {log.recipientEmail}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{formatType(log.type)}</span>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">
                    {log.subject}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        log.status === "SENT"
                          ? "text-green-600 dark:text-green-400"
                          : log.status === "FAILED"
                            ? "text-red-600 dark:text-red-400"
                            : log.status === "BOUNCED"
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-muted-foreground"
                      }
                    >
                      {log.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.relatedEntityType
                      ? `${log.relatedEntityType}${log.relatedEntityId ? ` (${log.relatedEntityId})` : ""}`
                      : log.ticketNumber
                        ? `ticket ${log.ticketNumber}`
                        : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDate(log.sentAt)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDate(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    {log.hasPreview ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewLog(log)}
                      >
                        Preview
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No preview
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={previewLog !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewLog(null)
        }}
      >
        <DialogContent className="flex h-[80vh] max-w-3xl flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          {previewLog && (
            <iframe
              src={`/api/email-logs/${previewLog.id}/preview`}
              className="flex-1 rounded border"
              sandbox="allow-same-origin"
              title="Email preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

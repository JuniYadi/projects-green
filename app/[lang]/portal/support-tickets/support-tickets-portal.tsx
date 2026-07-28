"use client"

import { useEffect, useMemo, useState } from "react"
import type { Column, ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TicketTableSkeleton } from "@/modules/support-tickets/ui/ticket-table-skeleton"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { createSupportTicketsClient } from "@/modules/support-tickets/api/support-tickets.client"
import {
  SUPPORT_TICKET_DEPARTMENT_LABELS,
  SUPPORT_TICKET_DEPARTMENTS,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_SERVICES,
  SUPPORT_TICKET_SERVICE_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
  type SupportTicket,
} from "@/modules/support-tickets/support-ticket.types"

type SupportTicketsPortalProps = {
  lang: string
  organizationId?: string
}

const apiClient = createSupportTicketsClient()

const getSupportTicketColumns = (
  lang: string,
  options?: { hideOrganization?: boolean }
): ColumnDef<SupportTicket>[] => {
  const locale = resolveLocaleOrDefault(lang)
  const hideOrganization = options?.hideOrganization ?? false

  return [
    {
      accessorKey: "ticketNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ticket ID" />
      ),
      cell: ({ row }) => {
        const ticketPath = localizePathname({
          pathname: `/portal/support-tickets/${row.original.id}`,
          locale,
        })

        return (
          <Link
            href={ticketPath}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.original.ticketNumber}
          </Link>
        )
      },
    },
    ...(!hideOrganization
      ? [
          {
            accessorKey: "organizationId",
            header: ({
              column,
            }: {
              column: Column<SupportTicket, unknown>
            }) => (
              <DataTableColumnHeader column={column} title="Organization" />
            ),
            cell: ({ row }: { row: { original: SupportTicket } }) => (
              <span className="text-xs" title={row.original.organizationId}>
                {row.original.organizationName ?? "Unknown organization"}
              </span>
            ),
          },
        ]
      : []),
    {
      accessorKey: "requesterWorkosUserId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Requester" />
      ),
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.requesterName ||
            `User (${row.original.requesterWorkosUserId.slice(-4)})`}
        </span>
      ),
    },
    {
      accessorKey: "subject",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Subject" />
      ),
      cell: ({ row }) => (
        <span
          className="block max-w-[32rem] truncate"
          title={row.original.subject}
        >
          {row.original.subject}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => SUPPORT_TICKET_STATUS_LABELS[row.original.status],
    },
    {
      accessorKey: "department",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Department" />
      ),
      cell: ({ row }) =>
        SUPPORT_TICKET_DEPARTMENT_LABELS[row.original.department],
    },
    {
      accessorKey: "priority",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Priority" />
      ),
      cell: ({ row }) => SUPPORT_TICKET_PRIORITY_LABELS[row.original.priority],
    },
    {
      accessorKey: "service",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Service" />
      ),
      cell: ({ row }) =>
        row.original.service
          ? SUPPORT_TICKET_SERVICE_LABELS[row.original.service]
          : "-",
    },
  ]
}

export function SupportTicketsPortal({
  lang,
  organizationId,
}: SupportTicketsPortalProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isEmbedded = Boolean(organizationId)
  const columns = useMemo(
    () =>
      getSupportTicketColumns(lang, {
        hideOrganization: isEmbedded,
      }),
    [isEmbedded, lang]
  )
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(() => {
    if (isEmbedded) return 1
    const value = Number(searchParams.get("page"))
    return Number.isInteger(value) && value > 0 ? value : 1
  })
  const [pageSize, setPageSize] = useState(() => {
    if (isEmbedded) return 20
    const value = Number(searchParams.get("pageSize"))
    return [20, 50, 100].includes(value) ? value : 20
  })
  const [includeClosed, setIncludeClosed] = useState(
    () => !isEmbedded && searchParams.get("includeClosed") === "1"
  )
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isEmbedded) return

    const params = new URLSearchParams(searchParams.toString())
    if (page === 1) params.delete("page")
    else params.set("page", String(page))
    if (pageSize === 20) params.delete("pageSize")
    else params.set("pageSize", String(pageSize))
    if (includeClosed) params.set("includeClosed", "1")
    else params.delete("includeClosed")

    const nextQuery = params.toString()
    const currentQuery = searchParams.toString()
    if (nextQuery !== currentQuery) {
      router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, {
        scroll: false,
      })
    }
  }, [
    includeClosed,
    isEmbedded,
    page,
    pageSize,
    pathname,
    router,
    searchParams,
  ])

  useEffect(() => {
    let cancelled = false

    const loadTickets = async () => {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const result = await apiClient.listAdminTickets({
          includeClosed,
          organizationId,
          page,
          pageSize,
        })
        if (cancelled) return
        setTickets(result.tickets)
        setTotal(result.total)
      } catch (error) {
        if (cancelled) return
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load support tickets."
        )
      } finally {
        if (cancelled) return
        setIsLoading(false)
      }
    }

    void loadTickets()
    return () => {
      cancelled = true
    }
  }, [includeClosed, organizationId, page, pageSize])

  const locale = resolveLocaleOrDefault(lang)
  const createPath = localizePathname({
    pathname: "/portal/support-tickets/new",
    locale,
  })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
          <CardTitle className="text-base">Support Queue</CardTitle>
          <Button asChild size="sm">
            <Link href={createPath}>Create Ticket (Admin)</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <p className="mb-3 text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {isLoading ? (
            <TicketTableSkeleton />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeClosed}
                    onChange={(event) => {
                      setIncludeClosed(event.target.checked)
                      setPage(1)
                    }}
                  />
                  Show closed
                </label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[120px]" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                    <SelectItem value="100">100 / page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DataTable
                tableId="portal-support-tickets"
                columns={columns}
                data={tickets}
                defaultColumnVisibility={{
                  department: true,
                  priority: false,
                  service: false,
                  organizationId: isEmbedded ? false : true,
                  requesterWorkosUserId: false,
                  status: true,
                }}
                searchPlaceholder="Filter by Ticket ID, Organization, or Subject..."
                searchableColumns={[
                  "ticketNumber",
                  "organizationId",
                  "subject",
                ]}
                facetFilters={[
                  {
                    columnId: "status",
                    label: "Status",
                    allLabel: "All status",
                    options: [
                      { label: "Open", value: "open" },
                      { label: "In Progress", value: "in_progress" },
                      { label: "Resolved", value: "resolved" },
                      { label: "Closed", value: "closed" },
                    ],
                  },
                  {
                    columnId: "department",
                    label: "Department",
                    allLabel: "All departments",
                    options: SUPPORT_TICKET_DEPARTMENTS.map(
                      (departmentValue) => ({
                        label:
                          SUPPORT_TICKET_DEPARTMENT_LABELS[departmentValue],
                        value: departmentValue,
                      })
                    ),
                  },
                  {
                    columnId: "priority",
                    label: "Priority",
                    allLabel: "All priority",
                    options: [
                      { label: "Low", value: "low" },
                      { label: "Medium", value: "medium" },
                      { label: "High", value: "high" },
                    ],
                  },
                  {
                    columnId: "service",
                    label: "Service",
                    allLabel: "All service",
                    options: SUPPORT_TICKET_SERVICES.map((serviceValue) => ({
                      label: SUPPORT_TICKET_SERVICE_LABELS[serviceValue],
                      value: serviceValue,
                    })),
                  },
                ]}
                initialSorting={[{ id: "ticketNumber", desc: true }]}
                emptyMessage="No support tickets match your filters."
              />
              <div className="mt-4 flex items-center justify-between gap-4 text-sm">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

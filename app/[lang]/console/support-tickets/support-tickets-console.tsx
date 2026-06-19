"use client"

import { useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TicketTableSkeleton } from "@/modules/support-tickets/ui/ticket-table-skeleton"
import { getMessages } from "@/lib/i18n/messages"
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

type SupportTicketsConsoleProps = {
  lang: string
}

const apiClient = createSupportTicketsClient()

const getSupportTicketColumns = (lang: string): ColumnDef<SupportTicket>[] => {
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale)

  return [
    {
      accessorKey: "ticketNumber",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={messages.console.supportTickets.ticketId}
        />
      ),
      cell: ({ row }) => {
        const ticketPath = localizePathname({
          pathname: `/console/support-tickets/${row.original.id}`,
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
    {
      accessorKey: "subject",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={messages.console.supportTickets.subject}
        />
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={messages.console.supportTickets.status}
        />
      ),
      cell: ({ row }) => SUPPORT_TICKET_STATUS_LABELS[row.original.status],
    },
    {
      accessorKey: "department",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={messages.console.supportTickets.department}
        />
      ),
      cell: ({ row }) =>
        SUPPORT_TICKET_DEPARTMENT_LABELS[row.original.department],
    },
    {
      accessorKey: "priority",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={messages.console.supportTickets.priority}
        />
      ),
      cell: ({ row }) => SUPPORT_TICKET_PRIORITY_LABELS[row.original.priority],
    },
    {
      accessorKey: "service",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={messages.console.supportTickets.service}
        />
      ),
      cell: ({ row }) =>
        row.original.service
          ? SUPPORT_TICKET_SERVICE_LABELS[row.original.service]
          : "-",
    },
  ]
}

export function SupportTicketsConsole({ lang }: SupportTicketsConsoleProps) {
  const columns = useMemo(() => getSupportTicketColumns(lang), [lang])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadTickets = async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const items = await apiClient.listTickets()
      setTickets(items)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load support tickets."
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTickets()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale)
  const createPath = localizePathname({
    pathname: "/console/support-tickets/new",
    locale,
  })

  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
          <CardTitle className="text-base">Ticket Queue</CardTitle>
          <Button asChild size="sm">
            <Link href={createPath}>Open Ticket</Link>
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
            <DataTable
              columns={columns}
              data={tickets}
              searchPlaceholder="Filter by Ticket ID or Subject..."
              searchableColumns={["ticketNumber", "subject"]}
              facetFilters={[
                {
                  columnId: "status",
                  label: messages.console.supportTickets.status,
                  allLabel: "All status",
                  options: [
                    {
                      label: messages.console.supportTickets.open,
                      value: "open",
                    },
                    {
                      label: messages.console.supportTickets.inProgress,
                      value: "in_progress",
                    },
                    {
                      label: messages.console.supportTickets.resolved,
                      value: "resolved",
                    },
                    {
                      label: messages.console.supportTickets.closed,
                      value: "closed",
                    },
                  ],
                },
                {
                  columnId: "department",
                  label: messages.console.supportTickets.department,
                  allLabel: "All departments",
                  options: SUPPORT_TICKET_DEPARTMENTS.map(
                    (departmentValue) => ({
                      label: SUPPORT_TICKET_DEPARTMENT_LABELS[departmentValue],
                      value: departmentValue,
                    })
                  ),
                },
                {
                  columnId: "priority",
                  label: messages.console.supportTickets.priority,
                  allLabel: "All priority",
                  options: [
                    {
                      label: messages.console.supportTickets.low,
                      value: "low",
                    },
                    {
                      label: messages.console.supportTickets.medium,
                      value: "medium",
                    },
                    {
                      label: messages.console.supportTickets.high,
                      value: "high",
                    },
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
          )}
        </CardContent>
      </Card>
    </section>
  )
}

"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useParams } from "next/navigation"
import {
  SUPPORT_TICKET_DEPARTMENT_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
  type SupportTicketDepartment,
  type SupportTicketStatus,
} from "@/modules/support-tickets/support-ticket.types"

type SupportTicket = {
  department: SupportTicketDepartment
  priority: "Low" | "Medium" | "High" | "Urgent"
  status: SupportTicketStatus
  ticketId: string
  title: string
}

const supportTicketRows: SupportTicket[] = [
  {
    ticketId: "TCK-2018",
    title: "Domain verification pending",
    department: "technical",
    priority: "High",
    status: "in_progress",
  },
  {
    ticketId: "TCK-2012",
    title: "Usage report export request",
    department: "billing",
    priority: "Medium",
    status: "open",
  },
  {
    ticketId: "TCK-2008",
    title: "User invitation resend failed",
    department: "account",
    priority: "Urgent",
    status: "resolved",
  },
  {
    ticketId: "TCK-2007",
    title: "Invoice receipt address update",
    department: "compliance",
    priority: "Low",
    status: "closed",
  },
]

const supportTicketColumns = (messages: ReturnType<typeof getMessages>): ColumnDef<SupportTicket>[] => [
  {
    accessorKey: "ticketId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.console.supportTickets.ticketId} />
    ),
    cell: ({ row }) => (
      <span className="font-medium text-foreground">
        {row.original.ticketId}
      </span>
    ),
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.console.supportTickets.titleColumn} />
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.console.supportTickets.status} />
    ),
    cell: ({ row }) => SUPPORT_TICKET_STATUS_LABELS[row.original.status],
  },
  {
    accessorKey: "department",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.console.supportTickets.department} />
    ),
    cell: ({ row }) =>
      SUPPORT_TICKET_DEPARTMENT_LABELS[row.original.department],
  },
  {
    accessorKey: "priority",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.console.supportTickets.priority} />
    ),
  },
]

export function SupportTicketsTable() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  return (
    <DataTable
      columns={supportTicketColumns(messages)}
      data={supportTicketRows}
      searchPlaceholder={messages.console.supportTickets.searchPlaceholder}
      searchableColumns={["ticketId", "title"]}
      facetFilters={[
        {
          columnId: "status",
          label: messages.console.supportTickets.status,
          allLabel: messages.console.supportTickets.filterAllStatus,
          options: [
            { label: messages.console.supportTickets.open, value: "open" },
            { label: messages.console.supportTickets.inProgress, value: "in_progress" },
            { label: messages.console.supportTickets.resolved, value: "resolved" },
            { label: messages.console.supportTickets.closed, value: "closed" },
          ],
        },
        {
          columnId: "department",
          label: messages.console.supportTickets.department,
          allLabel: messages.console.supportTickets.filterAllDepartments,
          options: [
            { label: messages.console.supportTickets.billing, value: "billing" },
            { label: messages.console.supportTickets.technical, value: "technical" },
            { label: messages.console.supportTickets.account, value: "account" },
            { label: messages.console.supportTickets.compliance, value: "compliance" },
          ],
        },
        {
          columnId: "priority",
          label: messages.console.supportTickets.priority,
          allLabel: messages.console.supportTickets.filterAllPriority,
          options: [
            { label: messages.console.supportTickets.low, value: "Low" },
            { label: messages.console.supportTickets.medium, value: "Medium" },
            { label: messages.console.supportTickets.high, value: "High" },
            { label: messages.console.supportTickets.urgent, value: "Urgent" },
          ],
        },
      ]}
      initialSorting={[{ id: "ticketId", desc: true }]}
      emptyMessage={messages.console.supportTickets.noTicketsMatch}
    />
  )
}

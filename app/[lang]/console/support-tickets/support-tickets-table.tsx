"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
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

const supportTicketColumns: ColumnDef<SupportTicket>[] = [
  {
    accessorKey: "ticketId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ticket ID" />
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
      <DataTableColumnHeader column={column} title="Title" />
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
  },
]

export function SupportTicketsTable() {
  return (
    <DataTable
      columns={supportTicketColumns}
      data={supportTicketRows}
      searchPlaceholder="Filter by Ticket ID or Title..."
      searchableColumns={["ticketId", "title"]}
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
          options: [
            { label: "Billing", value: "billing" },
            { label: "Technical", value: "technical" },
            { label: "Account", value: "account" },
            { label: "Compliance", value: "compliance" },
          ],
        },
        {
          columnId: "priority",
          label: "Priority",
          allLabel: "All priority",
          options: [
            { label: "Low", value: "Low" },
            { label: "Medium", value: "Medium" },
            { label: "High", value: "High" },
            { label: "Urgent", value: "Urgent" },
          ],
        },
      ]}
      initialSorting={[{ id: "ticketId", desc: true }]}
      emptyMessage="No support tickets match your filters."
    />
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"

import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
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
  type SupportTicketDepartment,
  type SupportTicketPriority,
  type SupportTicketService,
} from "@/modules/support-tickets/support-ticket.types"

type SupportTicketsConsoleProps = {
  lang: string
}

const apiClient = createSupportTicketsClient()

const getSupportTicketColumns = (lang: string): ColumnDef<SupportTicket>[] => {
  const locale = resolveLocaleOrDefault(lang)

  return [
    {
      accessorKey: "ticketNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ticket ID" />
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
        <DataTableColumnHeader column={column} title="Subject" />
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

export function SupportTicketsConsole({ lang }: SupportTicketsConsoleProps) {
  const columns = useMemo(() => getSupportTicketColumns(lang), [lang])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [subject, setSubject] = useState("")
  const [department, setDepartment] = useState<SupportTicketDepartment>(
    "technical"
  )
  const [priority, setPriority] = useState<SupportTicketPriority>("medium")
  const [service, setService] = useState<SupportTicketService | "none">("none")
  const [description, setDescription] = useState("")
  const [secureForm, setSecureForm] = useState("")
  const [files, setFiles] = useState<File[]>([])

  const loadTickets = async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const items = await apiClient.listTickets()
      setTickets(items)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load support tickets."
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

  const resetCreateForm = () => {
    setSubject("")
    setDepartment("technical")
    setPriority("medium")
    setService("none")
    setDescription("")
    setSecureForm("")
    setFiles([])
  }

  const uploadFiles = async (target: "create", ticketId?: string) => {
    const uploadSessionIds: string[] = []

    for (const file of files) {
      const presigned = await apiClient.presignAttachment({
        target,
        ticketId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      })

      await apiClient.uploadAttachmentObject({
        file,
        uploadUrl: presigned.uploadUrl,
      })

      await apiClient.registerAttachment({
        target,
        ticketId,
        id: presigned.attachmentId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        storageBucket: presigned.storageBucket,
        storageKey: presigned.storageKey,
      })

      uploadSessionIds.push(presigned.attachmentId)
    }

    return uploadSessionIds
  }

  const onSubmitCreateTicket = async () => {
    if (!subject.trim()) {
      setErrorMessage("Subject is required.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const uploadSessionIds = await uploadFiles("create")
      const ticket = await apiClient.createTicket({
        subject: subject.trim(),
        department,
        priority,
        service: service === "none" ? null : service,
        description: description.trim() ? description.trim() : null,
        secureForm: secureForm.trim() ? secureForm.trim() : null,
        uploadSessionIds,
      })

      setTickets((current) => [ticket, ...current])
      setIsCreateOpen(false)
      resetCreateForm()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create support ticket."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
          <CardTitle className="text-base">Ticket Queue</CardTitle>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            Open Ticket
          </Button>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <p className="mb-3 text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading tickets...</p>
          ) : (
            <DataTable
              columns={columns}
              data={tickets}
              searchPlaceholder="Filter by Ticket ID or Subject..."
              searchableColumns={["ticketNumber", "subject"]}
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
                  options: SUPPORT_TICKET_DEPARTMENTS.map((departmentValue) => ({
                    label: SUPPORT_TICKET_DEPARTMENT_LABELS[departmentValue],
                    value: departmentValue,
                  })),
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
          )}
        </CardContent>
      </Card>

      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Open Support Ticket</SheetTitle>
            <SheetDescription>
              Submit a ticket with optional secure form details and attachments.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input
                id="ticket-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Describe your issue"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ticket-department">Department</Label>
              <Select
                value={department}
                onValueChange={(nextValue) =>
                  setDepartment(nextValue as SupportTicketDepartment)
                }
              >
                <SelectTrigger id="ticket-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_TICKET_DEPARTMENTS.map((departmentValue) => (
                    <SelectItem key={departmentValue} value={departmentValue}>
                      {SUPPORT_TICKET_DEPARTMENT_LABELS[departmentValue]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ticket-service">Service (optional)</Label>
              <Select
                value={service}
                onValueChange={(nextValue) =>
                  setService(nextValue as SupportTicketService | "none")
                }
              >
                <SelectTrigger id="ticket-service">
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {SUPPORT_TICKET_SERVICES.map((serviceValue) => (
                    <SelectItem key={serviceValue} value={serviceValue}>
                      {SUPPORT_TICKET_SERVICE_LABELS[serviceValue]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ticket-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(nextValue) =>
                  setPriority(nextValue as SupportTicketPriority)
                }
              >
                <SelectTrigger id="ticket-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ticket-description">Message (optional)</Label>
              <Textarea
                id="ticket-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Add any non-sensitive details"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ticket-secure-form">Secure Form (encrypted)</Label>
              <Textarea
                id="ticket-secure-form"
                value={secureForm}
                onChange={(event) => setSecureForm(event.target.value)}
                rows={5}
                placeholder="Sensitive details only"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ticket-files">Attachments</Label>
              <Input
                id="ticket-files"
                type="file"
                multiple
                onChange={(event) =>
                  setFiles(Array.from(event.target.files ?? []))
                }
              />
              {files.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {files.length} file{files.length > 1 ? "s" : ""} selected
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={onSubmitCreateTicket}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Ticket"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}

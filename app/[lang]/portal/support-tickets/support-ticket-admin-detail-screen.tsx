"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createSupportTicketsClient } from "@/modules/support-tickets/api/support-tickets.client"
import { SupportTicketDetailSkeleton } from "@/modules/support-tickets/ui/support-ticket-detail-skeleton"
import {
  SUPPORT_TICKET_DEPARTMENT_LABELS,
  SUPPORT_TICKET_DEPARTMENTS,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_SERVICES,
  SUPPORT_TICKET_SERVICE_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
  SUPPORT_TICKET_STATUSES,
  type SupportTicketAttachmentMetadata,
  type SupportTicketThread,
  type SupportTicketDepartment,
  type SupportTicketPriority,
  type SupportTicketService,
  type SupportTicketStatus,
} from "@/modules/support-tickets/support-ticket.types"
import { formatBytes } from "@/lib/utils"
import { MarkdownEditor } from "@/components/ui/markdown-editor"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type SupportTicketAdminDetailScreenProps = {
  ticketId: string
  lang: string
}

type FileWithPreview = {
  file: File
  previewUrl?: string
}

const resolveInitials = (name: string, email?: string) => {
  const normalizedName = name.trim()
  const fallbackName = email?.trim().split("@")[0]?.trim()
  const source = normalizedName || fallbackName || "User"
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return "U"
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

const apiClient = createSupportTicketsClient()

function SecureDetailsViewer({ content, label }: { content: string; label: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/[0.02] p-4 text-sm space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-yellow-500 font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
          <span>{label}</span>
          <span className="text-[10px] bg-yellow-500/10 px-1.5 py-0.5 rounded font-semibold">Encrypted</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 h-7"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? "Hide secure details" : "Show secure details"}
        </Button>
      </div>
      {isOpen && (
        <pre className="mt-2 p-3 bg-background/50 rounded border border-border/50 text-xs font-mono text-foreground whitespace-pre-wrap break-all leading-relaxed">
          {content}
        </pre>
      )}
    </div>
  )
}

function AttachmentItem({
  attachment,
  onPreview,
}: {
  attachment: SupportTicketAttachmentMetadata
  onPreview: (attachment: SupportTicketAttachmentMetadata) => void
}) {
  const isImage = attachment.mimeType.startsWith("image/")
  const downloadUrl = `/api/support-tickets/attachments/${attachment.id}`

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        onPreview(attachment)
      }}
      className="w-full text-left relative group rounded-lg border border-border bg-card/50 p-2 flex items-center gap-3 hover:bg-accent/50 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {isImage ? (
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={downloadUrl}
            alt={attachment.fileName}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded bg-muted text-muted-foreground border border-border">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate group-hover:underline">
          {attachment.fileName}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatBytes(attachment.sizeBytes)}
        </p>
      </div>
    </button>
  )
}

export function SupportTicketAdminDetailScreen({ ticketId, lang }: SupportTicketAdminDetailScreenProps) {
  const router = useRouter()
  const locale = resolveLocaleOrDefault(lang)
  const listPath = localizePathname({ pathname: "/portal/support-tickets", locale })

  const [thread, setThread] = useState<SupportTicketThread | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // Categorization Form States (Admin Editable)
  const [department, setDepartment] = useState<SupportTicketDepartment>("technical")
  const [priority, setPriority] = useState<SupportTicketPriority>("medium")
  const [service, setService] = useState<SupportTicketService | "none">("none")
  const [status, setStatus] = useState<SupportTicketStatus>("open")
  const [isUpdatingMetadata, setIsUpdatingMetadata] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Reply Form States
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [activeTab, setActiveTab] = useState<"message" | "secure">("message")
  const [activePreview, setActivePreview] = useState<SupportTicketAttachmentMetadata | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewContent, setPreviewContent] = useState<{
    type: "image" | "pdf" | "csv" | "unsupported"
    blobUrl?: string
    textContent?: string
    blob: Blob
  } | null>(null)

  const handleAttachmentClick = async (attachment: SupportTicketAttachmentMetadata) => {
    setActivePreview(attachment)
    setIsLoadingPreview(true)
    setPreviewContent(null)

    const downloadUrl = `/api/support-tickets/attachments/${attachment.id}`
    try {
      const response = await fetch(downloadUrl)
      if (!response.ok) throw new Error("Failed to load preview")
      const blob = await response.blob()

      const mimeType = attachment.mimeType.toLowerCase()
      const isImg = mimeType.startsWith("image/")
      const isPdf = mimeType === "application/pdf" || attachment.fileName.toLowerCase().endsWith(".pdf")
      const isCsv = mimeType === "text/csv" || attachment.fileName.toLowerCase().endsWith(".csv")

      if (isImg) {
        setPreviewContent({
          type: "image",
          blobUrl: URL.createObjectURL(blob),
          blob,
        })
      } else if (isPdf) {
        setPreviewContent({
          type: "pdf",
          blobUrl: URL.createObjectURL(blob),
          blob,
        })
      } else if (isCsv) {
        const text = await blob.text()
        setPreviewContent({
          type: "csv",
          textContent: text,
          blob,
        })
      } else {
        setPreviewContent({
          type: "unsupported",
          blob,
        })
      }
    } catch (err) {
      console.error(err)
      setPreviewContent({
        type: "unsupported",
        blob: new Blob(),
      })
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const triggerDownload = () => {
    if (!previewContent?.blob || !activePreview) return
    const blobUrl = URL.createObjectURL(previewContent.blob)
    const link = document.createElement("a")
    link.href = blobUrl
    link.download = activePreview.fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  }

  const closePreview = () => {
    if (previewContent?.blobUrl) {
      URL.revokeObjectURL(previewContent.blobUrl)
    }
    setActivePreview(null)
    setPreviewContent(null)
    setIsLoadingPreview(false)
  }

  const requestSequenceRef = useRef(0)

  const replyBodyRef = useRef<HTMLTextAreaElement>(null)
  const replySecureFormRef = useRef<HTMLTextAreaElement>(null)
  const filesRef = useRef<FileWithPreview[]>([])

  useEffect(() => {
    filesRef.current = files
  }, [files])

  useEffect(() => {
    return () => {
      filesRef.current.forEach((f) => {
        if (f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl)
        }
      })
    }
  }, [])

  const loadThread = async () => {
    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const nextThread = await apiClient.getTicketThread(ticketId)
      if (requestSequenceRef.current === requestId) {
        setThread(nextThread)
        if (nextThread.ticket) {
          setDepartment(nextThread.ticket.department)
          setPriority(nextThread.ticket.priority)
          setService(nextThread.ticket.service || "none")
          setStatus(nextThread.ticket.status)
        }
      }
    } catch (error) {
      if (requestSequenceRef.current === requestId) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load support ticket thread."
        )
      }
    } finally {
      if (requestSequenceRef.current === requestId) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadThread()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      requestSequenceRef.current += 1
    }
  }, [ticketId])

  const ticket = thread?.ticket ?? null
  const isClosed = ticket?.status === "closed"

  const replyCountLabel = useMemo(() => {
    const total = thread?.replies.length ?? 0
    return `${total} repl${total === 1 ? "y" : "ies"}`
  }, [thread?.replies.length])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? [])
    const nextFiles = selected.map((file) => ({
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }))
    setFiles((prev) => {
      prev.forEach((f) => {
        if (f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl)
        }
      })
      return nextFiles
    })
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => {
      const target = prev[index]
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl)
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const uploadReplyFiles = async () => {
    const uploadSessionIds: string[] = []

    for (const item of files) {
      const file = item.file
      const presigned = await apiClient.presignAttachment({
        target: "reply",
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
        target: "reply",
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

  const submitReply = async () => {
    const replyBody = replyBodyRef.current?.value || ""
    const replySecureForm = replySecureFormRef.current?.value || ""

    if (!replyBody.trim()) {
      setErrorMessage("Reply message is required.")
      return
    }

    setIsSubmittingReply(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const uploadSessionIds = await uploadReplyFiles()
      await apiClient.addReply({
        ticketId,
        body: replyBody.trim(),
        secureForm: replySecureForm.trim() ? replySecureForm.trim() : null,
        isInternalNote,
        uploadSessionIds,
      })

      if (replyBodyRef.current) replyBodyRef.current.value = ""
      if (replySecureFormRef.current) replySecureFormRef.current.value = ""

      files.forEach((f) => {
        if (f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl)
        }
      })
      setFiles([])
      setIsInternalNote(false)
      await loadThread()
      setSuccessMessage("Reply posted successfully.")
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to submit ticket reply."
      )
    } finally {
      setIsSubmittingReply(false)
    }
  }

  // Update Metadata (CRUD Update)
  const saveMetadata = async () => {
    setIsUpdatingMetadata(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const isTransitioningToClosed = status === "closed" && ticket?.status !== "closed"

    if (isTransitioningToClosed) {
      const confirmClose = window.confirm(
        "WARNING: Transitioning this ticket to CLOSED will permanently delete all secure credential details and reply credentials. This action is irreversible. Proceed?"
      )
      if (!confirmClose) {
        setIsUpdatingMetadata(false)
        return
      }
    }

    try {
      const updated = await apiClient.updateAdminTicket(ticketId, {
        department,
        priority,
        service: service === "none" ? null : service,
        status,
      })
      setThread((current) => {
        if (!current) return current
        return {
          ...current,
          ticket: updated,
        }
      })
      setSuccessMessage("Ticket categorization updated successfully.")
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update support ticket categorization."
      )
    } finally {
      setIsUpdatingMetadata(false)
    }
  }

  // Close Ticket with warning
  const closeTicket = async () => {
    if (!ticket || ticket.status === "closed") {
      return
    }

    const shouldClose = window.confirm(
      "WARNING: Closing this support ticket will permanently delete all secure credentials stored in the secure form segments. Proceed?"
    )
    if (!shouldClose) {
      return
    }

    setIsClosing(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const closedTicket = await apiClient.closeTicket(ticket.id)
      setThread((current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          ticket: closedTicket,
        }
      })
      setStatus("closed")
      setSuccessMessage("Ticket closed and secure form data wiped successfully.")
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to close support ticket."
      )
    } finally {
      setIsClosing(false)
    }
  }

  // Delete Ticket (CRUD Delete)
  const deleteTicket = async () => {
    if (!ticket) return

    const confirmDelete = window.confirm(
      "CRITICAL: Are you absolutely sure you want to delete this ticket and all associated replies and attachments? This action cannot be undone."
    )
    if (!confirmDelete) return

    setIsDeleting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await apiClient.deleteAdminTicket(ticket.id)
      router.push(listPath)
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to delete support ticket."
      )
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return <SupportTicketDetailSkeleton />
  }

  if (!thread || !ticket) {
    return (
      <p className="text-sm text-muted-foreground">
        Support ticket thread is unavailable.
      </p>
    )
  }

  return (
    <section className="grid gap-6">
      {errorMessage ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive font-medium" role="alert">
              {errorMessage}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {successMessage ? (
        <Card className="border-green-500/30 bg-green-500/10">
          <CardContent className="pt-6">
            <p className="text-sm text-green-500 font-medium" role="status">
              {successMessage}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Red Alert Closed Warning Banner */}
      {isClosed && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/[0.03] p-4 text-sm flex items-start gap-3 text-destructive animate-fade-in">
          <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <div>
            <p className="font-semibold text-sm">Secure Details Permanently Wiped</p>
            <p className="mt-0.5 text-xs text-destructive/80 leading-relaxed">
              This ticket is closed. For security compliance, all credentials and sensitive information in the secure fields have been permanently deleted and cannot be retrieved.
            </p>
          </div>
        </div>
      )}

      {/* Pre-close warning banner for open tickets */}
      {!isClosed && ticket.secureForm && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/[0.03] p-4 text-sm flex items-start gap-3 text-yellow-500 animate-fade-in">
          <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <div>
            <p className="font-semibold text-sm">Active Secure Details Warning</p>
            <p className="mt-0.5 text-xs text-yellow-500/80 leading-relaxed">
              This ticket currently stores secure credential information. Closing this ticket will permanently wipe all secure credentials across the thread.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Details Area */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-heading text-base font-semibold">{ticket.ticketNumber}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Organization: <span className="font-semibold text-foreground">{ticket.organizationName || ticket.organizationId}</span>
                    {ticket.organizationName && (
                      <span className="font-mono text-muted-foreground text-[10px] ml-1.5">({ticket.organizationId})</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground font-medium">
                    Status: {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isClosed || isClosing}
                    onClick={closeTicket}
                  >
                    {isClosing ? "Closing..." : isClosed ? "Closed" : "Close Ticket"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg bg-muted/30 p-4 text-sm border border-border/50">
                <p className="font-semibold text-foreground">Subject</p>
                <p className="mt-1 text-muted-foreground leading-relaxed font-medium">{ticket.subject}</p>
              </div>

              {ticket.organizationMetadata && Object.keys(ticket.organizationMetadata).length > 0 && (
                <div className="rounded-lg bg-muted/30 p-4 text-sm border border-border/50 space-y-1.5 animate-fade-in">
                  <p className="font-semibold text-foreground">Organization Billing/Support Details</p>
                  <p className="text-xs font-medium text-foreground">
                    Full Name: {ticket.organizationMetadata.billing_full_name || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Address: {ticket.organizationMetadata.billing_address || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    City, State: {[ticket.organizationMetadata.billing_city, ticket.organizationMetadata.billing_state].filter(Boolean).join(", ") || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Country, Post Code: {[ticket.organizationMetadata.billing_country, ticket.organizationMetadata.billing_post_code].filter(Boolean).join(" ") || "—"}
                  </p>
                </div>
              )}

              {ticket.description ? (
                <div className="rounded-lg bg-muted/30 p-4 text-sm border border-border/50">
                  <p className="font-semibold text-foreground">Message</p>
                  {ticket.descriptionHtml ? (
                    <div
                      className="mt-1.5 text-muted-foreground text-sm space-y-3 leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-muted/50 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_a]:text-primary [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: ticket.descriptionHtml }}
                    />
                  ) : (
                    <p className="mt-1.5 whitespace-pre-wrap text-muted-foreground leading-relaxed">{ticket.description}</p>
                  )}
                </div>
              ) : null}

              {ticket.secureForm ? (
                <SecureDetailsViewer content={ticket.secureForm} label="Secure details" />
              ) : null}

              {ticket.attachmentMetadata.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Attachments</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ticket.attachmentMetadata.map((attachment) => (
                      <AttachmentItem
                        key={attachment.id}
                        attachment={attachment}
                        onPreview={handleAttachmentClick}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Reply List */}
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-base font-semibold">Thread</h3>
                <p className="text-xs text-muted-foreground font-medium">{replyCountLabel}</p>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {thread.replies.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">No replies yet.</p>
              ) : (
                <div className="space-y-4">
                  {thread.replies.map((reply) => {
                    const author = thread.users?.[reply.authorWorkosUserId] || {
                      name: `User (${reply.authorWorkosUserId.slice(-4)})`,
                      avatarUrl: null,
                      isStaff: false,
                    }
                    const initials = resolveInitials(author.name)
                    
                    let cardClasses = "rounded-lg border p-4 space-y-3 relative overflow-hidden"
                    if (reply.isInternalNote) {
                      cardClasses += " border-yellow-500/30 border-l-4 border-l-yellow-500 bg-yellow-500/[0.05] dark:bg-yellow-500/[0.02]"
                    } else if (author.isStaff) {
                      cardClasses += " border-primary/30 border-l-4 border-l-primary bg-primary/[0.05] dark:bg-primary/[0.02] shadow-xs"
                    } else {
                      cardClasses += " border-border bg-muted/20 dark:bg-muted/10"
                    }

                    return (
                      <article key={reply.id} className={cardClasses}>
                        <div className="flex items-start justify-between flex-wrap gap-4 pb-2 border-b border-border/30">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 rounded-full border border-border bg-muted">
                              {author.avatarUrl ? (
                                <AvatarImage src={author.avatarUrl} alt={author.name} />
                              ) : null}
                              <AvatarFallback className="rounded-full text-xs font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="grid gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground leading-none">
                                  {author.name}
                                </span>
                                {reply.isInternalNote ? (
                                  <span className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-yellow-500/30 uppercase">
                                    Internal Note
                                  </span>
                                ) : author.isStaff ? (
                                  <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/30">
                                    Support Team
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-muted/60 dark:bg-muted/30 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border">
                                    Customer
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {reply.authorWorkosUserId}
                              </span>
                            </div>
                          </div>
                          <time className="text-[11px] text-muted-foreground font-medium self-center">
                            {new Date(reply.createdAt).toLocaleString()}
                          </time>
                        </div>
                        {reply.bodyHtml ? (
                          <div
                            className="text-foreground text-sm space-y-3 leading-relaxed pt-1 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-muted/50 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_a]:text-primary [&_a]:underline"
                            dangerouslySetInnerHTML={{ __html: reply.bodyHtml }}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed pt-1">{reply.body}</p>
                        )}
                        
                        {reply.secureForm ? (
                          <SecureDetailsViewer content={reply.secureForm} label="Secure details" />
                        ) : null}
                        
                        {reply.attachmentMetadata.length > 0 ? (
                          <div className="space-y-1.5 pt-2">
                            <p className="text-[10px] font-semibold text-muted-foreground">Attachments</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {reply.attachmentMetadata.map((attachment) => (
                                <AttachmentItem
                                  key={attachment.id}
                                  attachment={attachment}
                                  onPreview={handleAttachmentClick}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reply Form */}
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader className="pb-3 border-b border-border/50">
              <h3 className="font-heading text-base font-semibold">Reply</h3>
            </CardHeader>
            <CardContent className="pt-5 space-y-6">
              {/* Tabbed Editor Container */}
              <div className="space-y-4">
                {/* Tabs list */}
                <div className="flex border-b border-border">
                  <button
                    type="button"
                    onClick={() => setActiveTab("message")}
                    disabled={isClosed}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-all -mb-[1px] ${
                      activeTab === "message"
                        ? "border-primary text-foreground font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground disabled:opacity-50"
                    }`}
                  >
                    General Message
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("secure")}
                    disabled={isClosed}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-all -mb-[1px] flex items-center gap-1.5 ${
                      activeTab === "secure"
                        ? "border-yellow-500 text-yellow-500 font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground disabled:opacity-50"
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      {activeTab === "secure" && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                      )}
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                    </span>
                    Secure details
                  </button>
                </div>

                {/* General Message Tab */}
                <div className={activeTab === "message" ? "space-y-2" : "hidden"}>
                  <Label htmlFor="reply-body" className="text-xs font-semibold text-muted-foreground">
                    Message
                  </Label>
                  <MarkdownEditor
                    id="reply-body"
                    ref={replyBodyRef}
                    rows={4}
                    placeholder="Write your reply"
                    disabled={isClosed || isSubmittingReply}
                  />
                </div>

                {/* Secure Details Tab */}
                <div className={activeTab === "secure" ? "space-y-4" : "hidden"}>
                  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.02] p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-yellow-500">
                        Encrypted
                      </span>
                      <span className="text-xs font-medium text-yellow-500/90 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                        End-to-End Secure Channel
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Details entered here are encrypted end-to-end and only visible to engineers assigned to your ticket. Use this section for passwords, tokens, API keys, or sensitive credentials.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="reply-secure-form" className="sr-only">
                      Secure Form (encrypted)
                    </Label>
                    <MarkdownEditor
                      id="reply-secure-form"
                      ref={replySecureFormRef}
                      rows={4}
                      placeholder="Sensitive credentials, configurations, or secrets only"
                      disabled={isClosed || isSubmittingReply}
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border my-4" />

              {/* Attachments Section */}
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="reply-files" className="text-xs font-semibold text-muted-foreground">
                    Attachments (optional)
                  </Label>
                  <Input
                    id="reply-files"
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    disabled={isClosed || isSubmittingReply}
                    className="bg-background/50 border-border text-foreground file:text-foreground file:bg-primary/10 file:border-0 file:rounded-md cursor-pointer"
                  />
                </div>

                {files.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {files.map((item, idx) => {
                      const isImage = item.file.type.startsWith("image/")
                      return (
                        <div
                          key={idx}
                          className="relative group rounded-lg border border-border bg-card/50 p-2 flex items-center gap-3"
                        >
                          {isImage && item.previewUrl ? (
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted border border-border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.previewUrl}
                                alt={item.file.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded bg-muted text-muted-foreground border border-border">
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">
                              {item.file.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatBytes(item.file.size)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-background border border-border hover:bg-muted text-muted-foreground hover:text-foreground rounded-full flex items-center justify-center text-[10px] transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Internal Note Selector */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="internal-note"
                  checked={isInternalNote}
                  onCheckedChange={(checked) => setIsInternalNote(Boolean(checked))}
                  disabled={isClosed || isSubmittingReply}
                />
                <Label htmlFor="internal-note" className="text-sm font-medium text-yellow-500 cursor-pointer select-none">
                  Post as Internal Note (visible only to support agents/admins)
                </Label>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={submitReply}
                  disabled={isClosed || isSubmittingReply}
                >
                  {isSubmittingReply ? "Sending..." : "Send Reply"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Categorization Update and Operations */}
        <div className="space-y-6">
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground font-heading">Categorization & Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="ticket-status" className="text-xs font-semibold text-muted-foreground">Status</Label>
                <Select
                  value={status}
                  onValueChange={(nextValue) => setStatus(nextValue as SupportTicketStatus)}
                  disabled={isUpdatingMetadata}
                >
                  <SelectTrigger id="ticket-status" className="w-full bg-background/50 border-border text-foreground">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {SUPPORT_TICKET_STATUSES.map((statusValue) => (
                      <SelectItem key={statusValue} value={statusValue} className="text-foreground hover:bg-muted">
                        {SUPPORT_TICKET_STATUS_LABELS[statusValue]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ticket-department" className="text-xs font-semibold text-muted-foreground">Department</Label>
                <Select
                  value={department}
                  onValueChange={(nextValue) => setDepartment(nextValue as SupportTicketDepartment)}
                  disabled={isUpdatingMetadata}
                >
                  <SelectTrigger id="ticket-department" className="w-full bg-background/50 border-border text-foreground">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {SUPPORT_TICKET_DEPARTMENTS.map((departmentValue) => (
                      <SelectItem key={departmentValue} value={departmentValue} className="text-foreground hover:bg-muted">
                        {SUPPORT_TICKET_DEPARTMENT_LABELS[departmentValue]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ticket-service" className="text-xs font-semibold text-muted-foreground">Service (optional)</Label>
                <Select
                  value={service}
                  onValueChange={(nextValue) => setService(nextValue as SupportTicketService | "none")}
                  disabled={isUpdatingMetadata}
                >
                  <SelectTrigger id="ticket-service" className="w-full bg-background/50 border-border text-foreground">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="none" className="text-foreground hover:bg-muted">None</SelectItem>
                    {SUPPORT_TICKET_SERVICES.map((serviceValue) => (
                      <SelectItem key={serviceValue} value={serviceValue} className="text-foreground hover:bg-muted">
                        {SUPPORT_TICKET_SERVICE_LABELS[serviceValue]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ticket-priority" className="text-xs font-semibold text-muted-foreground">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(nextValue) => setPriority(nextValue as SupportTicketPriority)}
                  disabled={isUpdatingMetadata}
                >
                  <SelectTrigger id="ticket-priority" className="w-full bg-background/50 border-border text-foreground">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {SUPPORT_TICKET_PRIORITIES.map((priorityValue) => (
                      <SelectItem key={priorityValue} value={priorityValue} className="text-foreground hover:bg-muted">
                        {SUPPORT_TICKET_PRIORITY_LABELS[priorityValue]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={saveMetadata}
                disabled={isUpdatingMetadata}
              >
                {isUpdatingMetadata ? "Saving..." : "Save Categorization"}
              </Button>
            </CardContent>
          </Card>

          {/* Delete Ticket panel */}
          <Card className="border-destructive/20 bg-destructive/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-destructive font-heading">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Permanently delete this support ticket. All messages and attachments will be lost and cannot be recovered.
              </p>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={deleteTicket}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Support Ticket"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {activePreview && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in"
          onClick={closePreview}
        >
          <div 
            className="relative max-w-4xl w-full bg-card border border-border rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30">
              <div className="min-w-0 flex-1 pr-4">
                <h3 className="font-semibold text-sm truncate text-foreground">
                  {activePreview.fileName}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatBytes(activePreview.sizeBytes)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLoadingPreview}
                  onClick={triggerDownload}
                  className="flex items-center gap-1.5 h-8 text-xs font-semibold"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  <span>Download</span>
                </Button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="h-8 w-8 rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center text-xs transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-black/5 dark:bg-black/20 min-h-0">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center gap-2 py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-muted-foreground">Loading preview...</span>
                </div>
              ) : previewContent ? (
                <>
                  {previewContent.type === "image" && previewContent.blobUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={previewContent.blobUrl}
                      alt={activePreview.fileName}
                      className="max-h-[60vh] object-contain rounded-lg border border-border/50 shadow-sm"
                    />
                  )}

                  {previewContent.type === "pdf" && previewContent.blobUrl && (
                    <iframe
                      src={previewContent.blobUrl}
                      title={activePreview.fileName}
                      className="w-full h-[60vh] border border-border/50 rounded-lg bg-background"
                    />
                  )}

                  {previewContent.type === "csv" && previewContent.textContent && (
                    <div className="w-full max-h-[60vh] overflow-auto bg-muted/40 p-4 border border-border/50 rounded-lg">
                      <pre className="font-mono text-[11px] text-foreground whitespace-pre leading-relaxed text-left">
                        {previewContent.textContent}
                      </pre>
                    </div>
                  )}

                  {previewContent.type === "unsupported" && (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4">
                      <div className="h-14 w-14 bg-muted rounded-full flex items-center justify-center text-muted-foreground border border-border">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">Preview Unavailable</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                          A preview {"isn't"} available for this file type. Please download the file to view its contents.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Unable to load preview</span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

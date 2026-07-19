"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSupportTicketsClient } from "@/modules/support-tickets/api/support-tickets.client"

import { SupportTicketDetailSkeleton } from "@/modules/support-tickets/ui/support-ticket-detail-skeleton"
import {
  SUPPORT_TICKET_DEPARTMENT_LABELS,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_SERVICE_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
  type SupportTicketAttachmentMetadata,
  type SupportTicketThread,
} from "@/modules/support-tickets/support-ticket.types"
import { formatBytes } from "@/lib/utils"
import { MarkdownEditor } from "@/components/ui/markdown-editor"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type SupportTicketDetailScreenProps = {
  ticketId: string
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

function SecureDetailsViewer({
  content,
  label,
}: {
  content: string
  label: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="space-y-2 rounded-lg border border-yellow-500/30 bg-yellow-500/[0.02] p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium text-yellow-500">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            ></path>
          </svg>
          <span>{label}</span>
          <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-semibold">
            Encrypted
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="h-7 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? "Hide secure details" : "Show secure details"}
        </Button>
      </div>
      {isOpen && (
        <pre className="mt-2 rounded border border-border/50 bg-background/50 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-foreground">
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
      className="group relative flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-card/50 p-2 text-left transition-all hover:bg-accent/50 focus:ring-1 focus:ring-ring focus:outline-none"
    >
      {isImage ? (
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={downloadUrl}
            alt={attachment.fileName}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
          <svg
            className="h-5 w-5"
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
        <p className="truncate text-xs font-medium text-foreground group-hover:underline">
          {attachment.fileName}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatBytes(attachment.sizeBytes)}
        </p>
      </div>
    </button>
  )
}

export function SupportTicketDetailScreen({
  ticketId,
}: SupportTicketDetailScreenProps) {
  const router = useRouter()
  const [thread, setThread] = useState<SupportTicketThread | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [activeTab, setActiveTab] = useState<"message" | "secure">("message")
  const [activePreview, setActivePreview] =
    useState<SupportTicketAttachmentMetadata | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewContent, setPreviewContent] = useState<{
    type: "image" | "pdf" | "csv" | "unsupported"
    blobUrl?: string
    textContent?: string
    blob: Blob
  } | null>(null)

  const handleAttachmentClick = async (
    attachment: SupportTicketAttachmentMetadata
  ) => {
    setActivePreview(attachment)
    setIsLoadingPreview(true)
    setPreviewContent(null)

    const downloadUrl = `/api/support-tickets/attachments/${attachment.id}`
    try {
      // eslint-disable-next-line no-restricted-globals
      const response = await fetch(downloadUrl)
      if (!response.ok) throw new Error("Failed to load preview")
      const blob = await response.blob()

      const mimeType = attachment.mimeType.toLowerCase()
      const isImg = mimeType.startsWith("image/")
      const isPdf =
        mimeType === "application/pdf" ||
        attachment.fileName.toLowerCase().endsWith(".pdf")
      const isCsv =
        mimeType === "text/csv" ||
        attachment.fileName.toLowerCase().endsWith(".csv")

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      previewUrl: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined,
    }))
    setFiles((prev) => [...prev, ...nextFiles])
    event.currentTarget.value = ""
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

    try {
      const uploadSessionIds = await uploadReplyFiles()
      await apiClient.addReply({
        ticketId,
        body: replyBody.trim(),
        secureForm: replySecureForm.trim() ? replySecureForm.trim() : null,
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
      await loadThread()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit ticket reply."
      )
    } finally {
      setIsSubmittingReply(false)
    }
  }

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
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to close support ticket."
      )
    } finally {
      setIsClosing(false)
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
            <p className="text-sm font-medium text-destructive" role="alert">
              {errorMessage}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Red Alert Closed Warning Banner */}
      {isClosed && (
        <div className="animate-fade-in flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/[0.03] p-4 text-sm text-destructive">
          <svg
            className="mt-0.5 h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            ></path>
          </svg>
          <div>
            <p className="text-sm font-semibold">
              Secure Details Permanently Wiped
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-destructive/80">
              This ticket is closed. For security compliance, all credentials
              and sensitive information in the secure fields have been
              permanently deleted and cannot be retrieved.
            </p>
          </div>
        </div>
      )}

      {/* Pre-close warning banner for open tickets */}
      {!isClosed && ticket.secureForm && (
        <div className="animate-fade-in flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/[0.03] p-4 text-sm text-yellow-500">
          <svg
            className="mt-0.5 h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            ></path>
          </svg>
          <div>
            <p className="text-sm font-semibold">
              Active Secure Details Warning
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-yellow-500/80">
              This ticket currently stores secure credential information.
              Closing this ticket will permanently wipe all secure credentials
              across the thread.
            </p>
          </div>
        </div>
      )}

      <Card className="border-border bg-card text-card-foreground">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2
              className="font-heading text-base font-semibold"
              data-slot="card-title"
            >
              {ticket.ticketNumber}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Status: {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isClosed || isClosing}
                onClick={closeTicket}
              >
                {isClosing
                  ? "Closing..."
                  : isClosed
                    ? "Closed"
                    : "Close Ticket"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid gap-4 border-b border-border/50 pb-4 text-sm sm:grid-cols-2 md:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">
                Subject
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {ticket.subject}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">
                Department
              </dt>
              <dd className="mt-0.5 text-foreground">
                {SUPPORT_TICKET_DEPARTMENT_LABELS[ticket.department]}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">
                Priority
              </dt>
              <dd className="mt-0.5 text-foreground capitalize">
                {SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">
                Service
              </dt>
              <dd className="mt-0.5 text-foreground">
                {ticket.service
                  ? SUPPORT_TICKET_SERVICE_LABELS[ticket.service]
                  : "-"}
              </dd>
            </div>
          </dl>

          {ticket.organizationMetadata &&
            Object.keys(ticket.organizationMetadata).length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-border/50 bg-muted/30 p-4 text-sm">
                <p className="font-semibold text-foreground">
                  Organization Billing/Support Details
                </p>
                <p className="text-xs font-medium text-foreground">
                  Full Name:{" "}
                  {ticket.organizationMetadata.billing_full_name || "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Address: {ticket.organizationMetadata.billing_address || "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  City, State:{" "}
                  {[
                    ticket.organizationMetadata.billing_city,
                    ticket.organizationMetadata.billing_state,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Country, Post Code:{" "}
                  {[
                    ticket.organizationMetadata.billing_country,
                    ticket.organizationMetadata.billing_post_code,
                  ]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </p>
              </div>
            )}

          {ticket.description ? (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-sm">
              <p className="font-semibold text-foreground">Message</p>
              {ticket.descriptionHtml ? (
                <div
                  className="mt-1.5 space-y-3 text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted/50 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: ticket.descriptionHtml }}
                />
              ) : (
                <p className="mt-1.5 leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {ticket.description}
                </p>
              )}
            </div>
          ) : null}

          {ticket.secureForm ? (
            <SecureDetailsViewer
              content={ticket.secureForm}
              label="Secure details"
            />
          ) : null}

          {ticket.attachmentMetadata.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Attachments
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <Card className="border-border bg-card text-card-foreground">
        <CardHeader className="border-b border-border/50 pb-3">
          <div className="flex items-center justify-between">
            <h3
              className="font-heading text-base font-semibold"
              data-slot="card-title"
            >
              Thread
            </h3>
            <p className="text-xs font-medium text-muted-foreground">
              {replyCountLabel}
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {thread.replies.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground italic">
              No replies yet.
            </p>
          ) : (
            <div className="space-y-4">
              {thread.replies.map((reply) => {
                const author = thread.users?.[reply.authorWorkosUserId] || {
                  name: `User (${reply.authorWorkosUserId.slice(-4)})`,
                  avatarUrl: null,
                  isStaff: false,
                }
                const initials = resolveInitials(author.name)
                const cardClasses = author.isStaff
                  ? "rounded-lg border border-primary/30 border-l-4 border-l-primary bg-primary/[0.05] dark:bg-primary/[0.02] p-4 space-y-3 relative overflow-hidden shadow-xs"
                  : "rounded-lg border border-border bg-muted/20 dark:bg-muted/10 p-4 space-y-3 relative overflow-hidden"

                return (
                  <article key={reply.id} className={cardClasses}>
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/30 pb-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 rounded-full border border-border bg-muted">
                          {author.avatarUrl ? (
                            <AvatarImage
                              src={author.avatarUrl}
                              alt={author.name}
                            />
                          ) : null}
                          <AvatarFallback className="rounded-full text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm leading-none font-semibold text-foreground">
                              {author.name}
                            </span>
                            {author.isStaff ? (
                              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                Support Team
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground dark:bg-muted/30">
                                Customer
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <time className="self-center text-[11px] font-medium text-muted-foreground">
                        {new Date(reply.createdAt).toLocaleString()}
                      </time>
                    </div>
                    {reply.bodyHtml ? (
                      <div
                        className="space-y-3 pt-1 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted/50 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5"
                        dangerouslySetInnerHTML={{ __html: reply.bodyHtml }}
                      />
                    ) : (
                      <p className="pt-1 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                        {reply.body}
                      </p>
                    )}

                    {reply.secureForm ? (
                      <SecureDetailsViewer
                        content={reply.secureForm}
                        label="Secure details"
                      />
                    ) : null}

                    {reply.attachmentMetadata.length > 0 ? (
                      <div className="space-y-1.5 pt-2">
                        <p className="text-[10px] font-semibold text-muted-foreground">
                          Attachments
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      {isClosed ? (
        <Card className="border-border bg-card text-card-foreground">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              This ticket is closed. If you have a new issue, please open a new
              ticket.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className="border-b border-border/50 pb-3">
            <h3
              className="font-heading text-base font-semibold"
              data-slot="card-title"
            >
              Reply
            </h3>
          </CardHeader>
          <CardContent className="space-y-6 pt-5">
            {/* Tabbed Editor Container */}
            <div className="space-y-4">
              {/* Tabs list */}
              <div className="flex border-b border-border">
                <button
                  type="button"
                  onClick={() => setActiveTab("message")}
                  className={`-mb-[1px] border-b-2 px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === "message"
                      ? "border-primary font-semibold text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground disabled:opacity-50"
                  }`}
                >
                  General Message
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("secure")}
                  className={`-mb-[1px] flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === "secure"
                      ? "border-yellow-500 font-semibold text-yellow-500"
                      : "border-transparent text-muted-foreground hover:text-foreground disabled:opacity-50"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    {activeTab === "secure" && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75"></span>
                    )}
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500"></span>
                  </span>
                  Secure details
                </button>
              </div>

              {/* General Message Tab */}
              <div className={activeTab === "message" ? "space-y-2" : "hidden"}>
                <Label
                  htmlFor="reply-body"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Message
                </Label>
                <MarkdownEditor
                  id="reply-body"
                  ref={replyBodyRef}
                  rows={4}
                  placeholder="Write your reply"
                  disabled={isSubmittingReply}
                />
              </div>

              {/* Secure Details Tab */}
              <div className={activeTab === "secure" ? "space-y-4" : "hidden"}>
                <div className="space-y-2 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.02] p-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-yellow-500">
                      Encrypted
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-yellow-500/90">
                      <svg
                        className="h-3.5 w-3.5 text-yellow-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        ></path>
                      </svg>
                      End-to-End Secure Channel
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Details entered here are encrypted end-to-end and only
                    visible to engineers assigned to your ticket. Use this
                    section for passwords, tokens, API keys, or sensitive
                    credentials.
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
                    disabled={isSubmittingReply}
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="my-4 border-t border-border" />

            {/* Attachments Section */}
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="reply-files"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Attachments (optional)
                </Label>
                <Input
                  id="reply-files"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  disabled={isSubmittingReply}
                  className="cursor-pointer border-border bg-background/50 text-foreground file:rounded-md file:border-0 file:bg-primary/10 file:text-foreground"
                />
              </div>

              {files.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {files.map((item, idx) => {
                    const isImage = item.file.type.startsWith("image/")
                    return (
                      <div
                        key={idx}
                        className="group relative flex items-center gap-3 rounded-lg border border-border bg-card/50 p-2"
                      >
                        {isImage && item.previewUrl ? (
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-border bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.previewUrl}
                              alt={item.file.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
                            <svg
                              className="h-5 w-5"
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
                          <p className="truncate text-xs font-medium text-foreground">
                            {item.file.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatBytes(item.file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-[10px] text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-muted hover:text-foreground focus:opacity-100"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={submitReply}
                disabled={isSubmittingReply}
              >
                {isSubmittingReply ? "Sending..." : "Send Reply"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activePreview && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          onClick={closePreview}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-4xl animate-in flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl duration-200 zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 p-4">
              <div className="min-w-0 flex-1 pr-4">
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {activePreview.fileName}
                </h3>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatBytes(activePreview.sizeBytes)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLoadingPreview}
                  onClick={triggerDownload}
                  className="flex h-8 items-center gap-1.5 text-xs font-semibold"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    ></path>
                  </svg>
                  <span>Download</span>
                </Button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black/5 p-6 dark:bg-black/20">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center gap-2 py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  <span className="text-xs text-muted-foreground">
                    Loading preview...
                  </span>
                </div>
              ) : previewContent ? (
                <>
                  {previewContent.type === "image" &&
                    previewContent.blobUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={previewContent.blobUrl}
                        alt={activePreview.fileName}
                        className="max-h-[60vh] rounded-lg border border-border/50 object-contain shadow-sm"
                      />
                    )}

                  {previewContent.type === "pdf" && previewContent.blobUrl && (
                    <iframe
                      src={previewContent.blobUrl}
                      title={activePreview.fileName}
                      className="h-[60vh] w-full rounded-lg border border-border/50 bg-background"
                    />
                  )}

                  {previewContent.type === "csv" &&
                    previewContent.textContent && (
                      <div className="max-h-[60vh] w-full overflow-auto rounded-lg border border-border/50 bg-muted/40 p-4">
                        <pre className="text-left font-mono text-[11px] leading-relaxed whitespace-pre text-foreground">
                          {previewContent.textContent}
                        </pre>
                      </div>
                    )}

                  {previewContent.type === "unsupported" && (
                    <div className="flex flex-col items-center justify-center space-y-4 px-4 py-12 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                        <svg
                          className="h-6 w-6"
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
                          ></path>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Preview Unavailable
                        </p>
                        <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                          A preview {"isn't"} available for this file type.
                          Please download the file to view its contents.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Unable to load preview
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

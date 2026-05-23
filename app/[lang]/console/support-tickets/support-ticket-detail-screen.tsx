"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSupportTicketsClient } from "@/modules/support-tickets/api/support-tickets.client"
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

type SupportTicketDetailScreenProps = {
  ticketId: string
}

type FileWithPreview = {
  file: File
  previewUrl?: string
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

function AttachmentItem({ attachment }: { attachment: SupportTicketAttachmentMetadata }) {
  const isImage = attachment.mimeType.startsWith("image/")
  const downloadUrl = `/api/support-tickets/attachments/${attachment.id}`

  return (
    <a
      href={downloadUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="relative group rounded-lg border border-border bg-card/50 p-2 flex items-center gap-3 hover:bg-accent/50 transition-all cursor-pointer"
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
    </a>
  )
}

export function SupportTicketDetailScreen({ ticketId }: SupportTicketDetailScreenProps) {
  const [thread, setThread] = useState<SupportTicketThread | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [activeTab, setActiveTab] = useState<"message" | "secure">("message")
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
        error instanceof Error ? error.message : "Unable to submit ticket reply."
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
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to close support ticket."
      )
    } finally {
      setIsClosing(false)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading ticket...</p>
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

      <Card className="border-border bg-card text-card-foreground">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-heading text-base font-semibold" data-slot="card-title">{ticket.ticketNumber}</h2>
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
          <dl className="grid gap-4 text-sm sm:grid-cols-2 md:grid-cols-4 border-b border-border/50 pb-4">
            <div>
              <dt className="text-xs text-muted-foreground font-semibold">Subject</dt>
              <dd className="font-medium text-foreground mt-0.5">{ticket.subject}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground font-semibold">Department</dt>
              <dd className="text-foreground mt-0.5">{SUPPORT_TICKET_DEPARTMENT_LABELS[ticket.department]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground font-semibold">Priority</dt>
              <dd className="text-foreground mt-0.5 capitalize">{SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground font-semibold">Service</dt>
              <dd className="text-foreground mt-0.5">{ticket.service ? SUPPORT_TICKET_SERVICE_LABELS[ticket.service] : "-"}</dd>
            </div>
          </dl>

          {ticket.description ? (
            <div className="rounded-lg bg-muted/30 p-4 text-sm border border-border/50">
              <p className="font-semibold text-foreground">Message</p>
              <p className="mt-1.5 whitespace-pre-wrap text-muted-foreground leading-relaxed">{ticket.description}</p>
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
                  <AttachmentItem key={attachment.id} attachment={attachment} />
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border bg-card text-card-foreground">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-base font-semibold" data-slot="card-title">Thread</h3>
            <p className="text-xs text-muted-foreground font-medium">{replyCountLabel}</p>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {thread.replies.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">No replies yet.</p>
          ) : (
            <div className="space-y-4">
              {thread.replies.map((reply) => (
                <article key={reply.id} className="rounded-lg border border-border bg-background/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-medium">
                      {new Date(reply.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{reply.body}</p>
                  
                  {reply.secureForm ? (
                    <SecureDetailsViewer content={reply.secureForm} label="Secure details" />
                  ) : null}
                  
                  {reply.attachmentMetadata.length > 0 ? (
                    <div className="space-y-1.5 pt-2">
                      <p className="text-[10px] font-semibold text-muted-foreground">Attachments</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {reply.attachmentMetadata.map((attachment) => (
                          <AttachmentItem key={attachment.id} attachment={attachment} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card text-card-foreground">
        <CardHeader className="pb-3 border-b border-border/50">
          <h3 className="font-heading text-base font-semibold" data-slot="card-title">Reply</h3>
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
    </section>
  )
}

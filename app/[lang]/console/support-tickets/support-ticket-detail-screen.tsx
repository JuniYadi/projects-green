"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createSupportTicketsClient } from "@/modules/support-tickets/api/support-tickets.client"
import {
  SUPPORT_TICKET_DEPARTMENT_LABELS,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_SERVICE_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
  type SupportTicketThread,
} from "@/modules/support-tickets/support-ticket.types"

type SupportTicketDetailScreenProps = {
  ticketId: string
}

const apiClient = createSupportTicketsClient()

export function SupportTicketDetailScreen({ ticketId }: SupportTicketDetailScreenProps) {
  const [thread, setThread] = useState<SupportTicketThread | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState("")
  const [replySecureForm, setReplySecureForm] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const requestSequenceRef = useRef(0)

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

  const uploadReplyFiles = async () => {
    const uploadSessionIds: string[] = []

    for (const file of files) {
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

      setReplyBody("")
      setReplySecureForm("")
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

    const shouldClose = window.confirm("Close this support ticket?")
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
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <section className="grid gap-3 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{ticket.ticketNumber}</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
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

        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Subject</dt>
            <dd className="font-medium">{ticket.subject}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Department</dt>
            <dd>{SUPPORT_TICKET_DEPARTMENT_LABELS[ticket.department]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Priority</dt>
            <dd>{SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Service</dt>
            <dd>{ticket.service ? SUPPORT_TICKET_SERVICE_LABELS[ticket.service] : "-"}</dd>
          </div>
        </dl>

        {ticket.description ? (
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <p className="font-medium">Message</p>
            <p className="mt-1 whitespace-pre-wrap">{ticket.description}</p>
          </div>
        ) : null}

        {ticket.secureForm ? (
          <div className="rounded-md border border-dashed border-amber-500/50 bg-amber-50/50 p-3 text-sm">
            <p className="font-medium">Secure Form</p>
            <p className="mt-1 whitespace-pre-wrap">{ticket.secureForm}</p>
          </div>
        ) : null}

        {ticket.attachmentMetadata.length > 0 ? (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Attachments</p>
            <ul className="space-y-1 text-muted-foreground">
              {ticket.attachmentMetadata.map((attachment) => (
                <li key={attachment.id}>
                  {attachment.fileName} ({attachment.mimeType}, {attachment.sizeBytes} bytes)
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Thread</h3>
          <p className="text-xs text-muted-foreground">{replyCountLabel}</p>
        </div>

        {thread.replies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No replies yet.</p>
        ) : (
          <div className="space-y-3">
            {thread.replies.map((reply) => (
              <article key={reply.id} className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">
                  {new Date(reply.createdAt).toLocaleString()}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{reply.body}</p>
                {reply.secureForm ? (
                  <div className="mt-3 rounded-md border border-dashed border-amber-500/50 bg-amber-50/50 p-2 text-sm">
                    <p className="font-medium">Secure Form</p>
                    <p className="mt-1 whitespace-pre-wrap">{reply.secureForm}</p>
                  </div>
                ) : null}
                {reply.attachmentMetadata.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {reply.attachmentMetadata.map((attachment) => (
                      <li key={attachment.id}>
                        {attachment.fileName} ({attachment.mimeType})
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 rounded-md border p-4">
        <h3 className="text-sm font-semibold">Reply</h3>

        <div className="grid gap-2">
          <Label htmlFor="reply-body">Message</Label>
          <Textarea
            id="reply-body"
            value={replyBody}
            onChange={(event) => setReplyBody(event.target.value)}
            rows={4}
            placeholder="Write your reply"
            disabled={isClosed}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="reply-secure-form">Secure Form (encrypted)</Label>
          <Textarea
            id="reply-secure-form"
            value={replySecureForm}
            onChange={(event) => setReplySecureForm(event.target.value)}
            rows={5}
            placeholder="Sensitive details only"
            disabled={isClosed}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="reply-files">Attachments</Label>
          <Input
            id="reply-files"
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            disabled={isClosed}
          />
          {files.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {files.length} file{files.length > 1 ? "s" : ""} selected
            </p>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={submitReply}
            disabled={isClosed || isSubmittingReply}
          >
            {isSubmittingReply ? "Sending..." : "Send Reply"}
          </Button>
        </div>
      </section>
    </section>
  )
}

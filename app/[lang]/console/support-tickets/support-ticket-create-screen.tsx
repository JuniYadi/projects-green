"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MarkdownEditor } from "@/components/ui/markdown-editor"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { createSupportTicketsClient } from "@/modules/support-tickets/api/support-tickets.client"
import {
  SUPPORT_TICKET_DEPARTMENT_LABELS,
  SUPPORT_TICKET_DEPARTMENTS,
  SUPPORT_TICKET_SERVICES,
  SUPPORT_TICKET_SERVICE_LABELS,
  type SupportTicketDepartment,
  type SupportTicketPriority,
  type SupportTicketService,
} from "@/modules/support-tickets/support-ticket.types"
import { formatBytes } from "@/lib/utils"

type SupportTicketCreateScreenProps = {
  lang: string
}

type FileWithPreview = {
  file: File
  previewUrl?: string
}

const apiClient = createSupportTicketsClient()

export function SupportTicketCreateScreen({ lang }: SupportTicketCreateScreenProps) {
  const router = useRouter()
  const locale = resolveLocaleOrDefault(lang)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  const [department, setDepartment] = useState<SupportTicketDepartment>("technical")
  const [priority, setPriority] = useState<SupportTicketPriority>("medium")
  const [service, setService] = useState<SupportTicketService | "none">("none")
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [activeTab, setActiveTab] = useState<"message" | "secure">("message")

  const subjectRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const secureFormRef = useRef<HTMLTextAreaElement>(null)

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

  // Prompt the user if they try to reload or navigate away during submission
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSubmitting) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isSubmitting])

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

  const listPath = localizePathname({
    pathname: "/console/support-tickets",
    locale,
  })

  const uploadFiles = async (target: "create", ticketId?: string) => {
    const uploadSessionIds: string[] = []

    for (const item of files) {
      const file = item.file
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
    const subject = subjectRef.current?.value || ""
    const description = descriptionRef.current?.value || ""
    const secureForm = secureFormRef.current?.value || ""

    if (!subject.trim()) {
      setErrorMessage("Subject is required.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const uploadSessionIds = await uploadFiles("create")
      await apiClient.createTicket({
        subject: subject.trim(),
        department,
        priority,
        service: service === "none" ? null : service,
        description: description.trim() ? description.trim() : null,
        secureForm: secureForm.trim() ? secureForm.trim() : null,
        uploadSessionIds,
      })

      router.push(listPath)
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create support ticket."
      )
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border p-6 rounded-lg shadow-xl max-w-sm w-full text-center space-y-4">
            <div className="flex justify-center">
              <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground">Creating Ticket</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Please wait while we process your request and upload any attachments. Do not refresh, close, or navigate away.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">
        {/* Left Column: Form Fields (Main Details & Secure Form) */}
        <div className="lg:col-span-2 space-y-6">
          {errorMessage ? (
            <Card className="border-destructive/30 bg-destructive/10">
              <CardContent className="pt-6">
                <p className="text-sm text-destructive font-medium" role="alert">
                  {errorMessage}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground">Ticket Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="ticket-subject" className="text-xs font-semibold text-muted-foreground">Subject</Label>
                <Input
                  id="ticket-subject"
                  ref={subjectRef}
                  placeholder="Describe your issue"
                  disabled={isSubmitting}
                  className="bg-background/50 border-border text-foreground focus-visible:ring-primary/50"
                />
              </div>

              {/* Tabbed Editor Container */}
              <div className="space-y-4 pt-2">
                {/* Tabs list */}
                <div className="flex border-b border-border">
                  <button
                    type="button"
                    onClick={() => setActiveTab("message")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-all -mb-[1px] ${
                      activeTab === "message"
                        ? "border-primary text-foreground font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    General Message
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("secure")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-all -mb-[1px] flex items-center gap-1.5 ${
                      activeTab === "secure"
                        ? "border-yellow-500 text-yellow-500 font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground"
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
                <div data-testid="message-tab-content" className={activeTab === "message" ? "space-y-2" : "hidden"}>
                  <Label htmlFor="ticket-description" className="text-xs font-semibold text-muted-foreground">
                    Message (optional)
                  </Label>
                  <MarkdownEditor
                    id="ticket-description"
                    ref={descriptionRef}
                    rows={6}
                    placeholder="Add any details about your request"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Secure Details Tab */}
                <div data-testid="secure-tab-content" className={activeTab === "secure" ? "space-y-4" : "hidden"}>
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
                    <Label htmlFor="ticket-secure-form" className="sr-only">
                      Secure Details (optional)
                    </Label>
                    <MarkdownEditor
                      id="ticket-secure-form"
                      ref={secureFormRef}
                      rows={6}
                      placeholder="Sensitive credentials, configurations, or secrets only"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border my-4" />

              {/* Attachments Section */}
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ticket-files" className="text-xs font-semibold text-muted-foreground">
                    Attachments (optional)
                  </Label>
                  <Input
                    id="ticket-files"
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    disabled={isSubmitting}
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
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Settings, Attachments, Actions */}
        <div className="space-y-6">
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground">Categorization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="ticket-department" className="text-xs font-semibold text-muted-foreground">Department</Label>
                <Select
                  value={department}
                  onValueChange={(nextValue) =>
                    setDepartment(nextValue as SupportTicketDepartment)
                  }
                  disabled={isSubmitting}
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
                  onValueChange={(nextValue) =>
                    setService(nextValue as SupportTicketService | "none")
                  }
                  disabled={isSubmitting}
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
                  onValueChange={(nextValue) =>
                    setPriority(nextValue as SupportTicketPriority)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="ticket-priority" className="w-full bg-background/50 border-border text-foreground">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="low" className="text-foreground hover:bg-muted">Low</SelectItem>
                    <SelectItem value="medium" className="text-foreground hover:bg-muted">Medium</SelectItem>
                    <SelectItem value="high" className="text-foreground hover:bg-muted">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Action Panel Card */}
          <Card className="border-border bg-card text-card-foreground">
            <CardContent className="pt-6 space-y-3">
              <Button
                type="button"
                className="w-full"
                onClick={onSubmitCreateTicket}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Ticket"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push(listPath)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSupportTicketsClient } from "@/modules/support-tickets/api/support-tickets.client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MarkdownEditor } from "@/components/ui/markdown-editor"
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
import {
  S3_ATTACHMENT_ALLOWED_EXTENSIONS,
  S3_ATTACHMENT_ALLOWED_MIME_TYPES,
  S3_ATTACHMENT_MAX_SIZE_BYTES,
} from "@/modules/support-tickets/support-ticket-attachment.validation"

type SupportTicketCreateScreenProps = {
  lang: string
}

type FileWithPreview = {
  file: File
  previewUrl?: string
}

const ACCEPT_MIME_STRING = S3_ATTACHMENT_ALLOWED_MIME_TYPES.join(",")

const apiClient = createSupportTicketsClient()

export function SupportTicketCreateScreen({
  lang,
}: SupportTicketCreateScreenProps) {
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale)
  const router = useRouter()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [department, setDepartment] =
    useState<SupportTicketDepartment>("technical")
  const [priority, setPriority] = useState<SupportTicketPriority>("medium")
  const [service, setService] = useState<SupportTicketService | "none">("none")
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({})
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
    const newErrors: Record<string, string> = {}
    const validFiles: FileWithPreview[] = []

    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? ""

      if (file.size > S3_ATTACHMENT_MAX_SIZE_BYTES) {
        newErrors[file.name] = `"${file.name}" exceeds 10MB limit.`
        continue
      }

      if (!S3_ATTACHMENT_ALLOWED_EXTENSIONS.includes(ext)) {
        newErrors[file.name] = `"${file.name}" is not supported. Supported: ${S3_ATTACHMENT_ALLOWED_EXTENSIONS.join(", ")}`
        continue
      }

      if (
        file.type &&
        file.type !== "" &&
        !S3_ATTACHMENT_ALLOWED_MIME_TYPES.includes(file.type)
      ) {
        newErrors[file.name] = `"${file.name}" is not supported. Supported: ${S3_ATTACHMENT_ALLOWED_EXTENSIONS.join(", ")}`
        continue
      }

      validFiles.push({
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
      })
    }

    setFiles((prev) => [...prev, ...validFiles])
    setValidationErrors((prev) => ({ ...prev, ...newErrors }))
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
    setValidationErrors((prev) => {
      const next = { ...prev }
      const target = files[index]
      if (target) delete next[target.file.name]
      return next
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
      setErrorMessage(messages.console.supportTickets.subjectRequired)
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
        error instanceof Error
          ? error.message
          : messages.console.supportTickets.unableToCreate
      )
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 text-center shadow-xl">
            <div className="flex justify-center">
              <svg
                className="h-8 w-8 animate-spin text-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {messages.console.supportTickets.creatingTicket}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {messages.console.supportTickets.creatingDescription}
            </p>
          </div>
        </div>
      )}

      <div className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Left Column: Form Fields (Main Details & Secure Form) */}
        <div className="space-y-6 lg:col-span-2">
          {errorMessage ? (
            <Card className="border-destructive/30 bg-destructive/10">
              <CardContent className="pt-6">
                <p
                  className="text-sm font-medium text-destructive"
                  role="alert"
                >
                  {errorMessage}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground">
                {messages.console.supportTickets.ticketDetails}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label
                  htmlFor="ticket-subject"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  {messages.console.supportTickets.subject}
                </Label>
                <Input
                  id="ticket-subject"
                  ref={subjectRef}
                  placeholder={
                    messages.console.supportTickets.subjectPlaceholder
                  }
                  disabled={isSubmitting}
                  className="border-border bg-background/50 text-foreground focus-visible:ring-primary/50"
                />
              </div>

              {/* Tabbed Editor Container */}
              <div className="space-y-4 pt-2">
                {/* Tabs list */}
                <div className="flex border-b border-border">
                  <button
                    type="button"
                    onClick={() => setActiveTab("message")}
                    className={`-mb-[1px] border-b-2 px-4 py-2 text-sm font-medium transition-all ${
                      activeTab === "message"
                        ? "border-primary font-semibold text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {messages.console.supportTickets.generalMessage}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("secure")}
                    className={`-mb-[1px] flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-all ${
                      activeTab === "secure"
                        ? "border-yellow-500 font-semibold text-yellow-500"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      {activeTab === "secure" && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75"></span>
                      )}
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500"></span>
                    </span>
                    {messages.console.supportTickets.secureDetails}
                  </button>
                </div>

                {/* General Message Tab */}
                <div
                  data-testid="message-tab-content"
                  className={activeTab === "message" ? "space-y-2" : "hidden"}
                >
                  <Label
                    htmlFor="ticket-description"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    {messages.console.supportTickets.messageOptional}
                  </Label>
                  <MarkdownEditor
                    id="ticket-description"
                    ref={descriptionRef}
                    rows={6}
                    placeholder={
                      messages.console.supportTickets.messagePlaceholder
                    }
                    disabled={isSubmitting}
                  />
                </div>

                {/* Secure Details Tab */}
                <div
                  data-testid="secure-tab-content"
                  className={activeTab === "secure" ? "space-y-4" : "hidden"}
                >
                  <div className="space-y-2 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.02] p-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-yellow-500">
                        {messages.console.supportTickets.encrypted}
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
                        {messages.console.supportTickets.endToEndSecure}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {messages.console.supportTickets.secureDescription}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ticket-secure-form" className="sr-only">
                      {messages.console.supportTickets.secureDetailsOptional}
                    </Label>
                    <MarkdownEditor
                      id="ticket-secure-form"
                      ref={secureFormRef}
                      rows={6}
                      placeholder={
                        messages.console.supportTickets.securePlaceholder
                      }
                      disabled={isSubmitting}
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
                    htmlFor="ticket-files"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    {messages.console.supportTickets.attachmentsOptional}
                  </Label>
                  <Input
                    id="ticket-files"
                    type="file"
                    multiple
                    accept={ACCEPT_MIME_STRING}
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                    className="cursor-pointer border-border bg-background/50 text-foreground file:rounded-md file:border-0 file:bg-primary/10 file:text-foreground"
                  />
                  {Object.keys(validationErrors).length > 0 && (
                    <div className="space-y-1">
                      {Object.entries(validationErrors).map(
                        ([fileName, message]) => (
                          <p
                            key={fileName}
                            className="text-sm text-destructive"
                          >
                            {message}
                          </p>
                        )
                      )}
                    </div>
                  )}
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
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Settings, Attachments, Actions */}
        <div className="space-y-6">
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground">
                {messages.console.supportTickets.categorization}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label
                  htmlFor="ticket-department"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  {messages.console.supportTickets.department}
                </Label>
                <Select
                  value={department}
                  onValueChange={(nextValue) =>
                    setDepartment(nextValue as SupportTicketDepartment)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="ticket-department"
                    className="w-full border-border bg-background/50 text-foreground"
                  >
                    <SelectValue
                      placeholder={
                        messages.console.supportTickets.selectDepartment
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover">
                    {SUPPORT_TICKET_DEPARTMENTS.map((departmentValue) => (
                      <SelectItem
                        key={departmentValue}
                        value={departmentValue}
                        className="text-foreground hover:bg-muted"
                      >
                        {SUPPORT_TICKET_DEPARTMENT_LABELS[departmentValue]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label
                  htmlFor="ticket-service"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  {messages.console.supportTickets.serviceOptional}
                </Label>
                <Select
                  value={service}
                  onValueChange={(nextValue) =>
                    setService(nextValue as SupportTicketService | "none")
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="ticket-service"
                    className="w-full border-border bg-background/50 text-foreground"
                  >
                    <SelectValue
                      placeholder={
                        messages.console.supportTickets.selectService
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover">
                    <SelectItem
                      value="none"
                      className="text-foreground hover:bg-muted"
                    >
                      {messages.console.supportTickets.none}
                    </SelectItem>
                    {SUPPORT_TICKET_SERVICES.map((serviceValue) => (
                      <SelectItem
                        key={serviceValue}
                        value={serviceValue}
                        className="text-foreground hover:bg-muted"
                      >
                        {SUPPORT_TICKET_SERVICE_LABELS[serviceValue]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label
                  htmlFor="ticket-priority"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  {messages.console.supportTickets.priority}
                </Label>
                <Select
                  value={priority}
                  onValueChange={(nextValue) =>
                    setPriority(nextValue as SupportTicketPriority)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="ticket-priority"
                    className="w-full border-border bg-background/50 text-foreground"
                  >
                    <SelectValue
                      placeholder={
                        messages.console.supportTickets.selectPriority
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover">
                    <SelectItem
                      value="low"
                      className="text-foreground hover:bg-muted"
                    >
                      {messages.console.supportTickets.low}
                    </SelectItem>
                    <SelectItem
                      value="medium"
                      className="text-foreground hover:bg-muted"
                    >
                      {messages.console.supportTickets.medium}
                    </SelectItem>
                    <SelectItem
                      value="high"
                      className="text-foreground hover:bg-muted"
                    >
                      {messages.console.supportTickets.high}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Action Panel Card */}
          <Card className="border-border bg-card text-card-foreground">
            <CardContent className="space-y-3 pt-6">
              <Button
                type="button"
                className="w-full"
                onClick={onSubmitCreateTicket}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? messages.console.supportTickets.submitting
                  : messages.console.supportTickets.submitTicket}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push(listPath)}
                disabled={isSubmitting}
              >
                {messages.console.supportTickets.cancel}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

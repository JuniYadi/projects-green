"use client"

import * as React from "react"
import {
  ChatCircle,
  PaperPlaneTilt,
  ArrowBendDownLeft,
  ArrowBendUpRight,
  MagnifyingGlass,
  Phone,
  FunnelSimple,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"
import { useTemplates } from "@/modules/whatsapp/templates/api/templates.hooks"
import { MessageStatusBadge } from "@/modules/whatsapp/messages/ui/message-status-badge"
import { normalizeIndonesianPhoneNumber } from "@/modules/whatsapp/messages/phone-number"

// ─── Local Types ─────────────────────────────────────────────────────────────

type MessageDirection = "INBOX" | "OUTBOX"
type DeliveryStatus = "SENT" | "DELIVERED" | "READ" | "FAILED"

type StatusHistory = {
  status: DeliveryStatus
  error: string | null
}

type ConversationListItem = {
  id: string
  organizationId: string
  contactPhone: string
  lastMessageAt: string | null
  lastDirection: MessageDirection | null
  whatsappDeviceId: string | null
  createdAt: string
  updatedAt: string
  _count: { whatsappMessages: number }
}

type Message = {
  id: string
  conversationId: string
  direction: MessageDirection
  messageType: string
  body: string | null
  mediaUrl: string | null
  waMessageId: string | null
  metadata: Record<string, unknown> | null
  statusHistory?: StatusHistory[]
  createdAt: string
  updatedAt: string
}

type ConversationDetail = ConversationListItem & {
  whatsappMessages: Message[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatTime = (iso: string | null | undefined) => {
  if (!iso) return ""
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  return d.toLocaleDateString([], { day: "numeric", month: "short" })
}

const formatPhone = (phone: string) => {
  if (phone.startsWith("+")) return phone
  return `+${phone}`
}
function isReplyWindowClosed(conversation: ConversationDetail | null): boolean {
  if (!conversation) return false
  const inboxMessages = conversation.whatsappMessages.filter(
    (m) => m.direction === "INBOX"
  )
  if (inboxMessages.length === 0) return true
  const newestInbox = inboxMessages.reduce((latest, m) =>
    new Date(m.createdAt) > new Date(latest.createdAt) ? m : latest
  )
  return Date.now() - new Date(newestInbox.createdAt).getTime() >= 24 * 60 * 60 * 1000
}

// ─── Conversation List Item ───────────────────────────────────────────────────

function ConversationItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: ConversationListItem
  isActive: boolean
  onClick: () => void
}) {
  const DirectionIcon =
    conversation.lastDirection === "INBOX"
      ? ArrowBendDownLeft
      : ArrowBendUpRight

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
        isActive ? "bg-muted" : ""
      }`}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Phone className="size-5 text-primary" weight="fill" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">
            {formatPhone(conversation.contactPhone)}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatTime(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <DirectionIcon className="size-3 text-muted-foreground" />
          <span className="truncate text-xs text-muted-foreground">
            {conversation.lastDirection === "INBOX" ? "Received" : "Sent"}
          </span>
          {conversation._count.whatsappMessages > 0 && (
            <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">
              {conversation._count.whatsappMessages}
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isInbox = message.direction === "INBOX"

  return (
    <div className={`flex ${isInbox ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
          isInbox
            ? "rounded-bl-sm bg-muted text-foreground"
            : "rounded-br-sm bg-primary text-primary-foreground"
        }`}
      >
        <p className="break-words whitespace-pre-wrap">
          {message.body || (
            <span className="text-muted-foreground/60 italic">
              (no content)
            </span>
          )}
        </p>
        <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
          isInbox ? "text-muted-foreground" : "text-primary-foreground/70"
        }`}>
          <span>{formatTime(message.createdAt)}</span>
          <MessageStatusBadge
            statusHistory={message.statusHistory}
            direction={message.direction}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function WhatsAppMessagesPage() {
  // State - conversations
  const [conversations, setConversations] = React.useState<
    ConversationListItem[]
  >([])
  const [conversationsLoading, setConversationsLoading] = React.useState(true)
  const [conversationsError, setConversationsError] = React.useState<
    string | null
  >(null)
  const [refreshKey, setRefreshKey] = React.useState(0)

  // State - active conversation
  const [activeConversationId, setActiveConversationId] = React.useState<
    string | null
  >(null)
  const [activeConversation, setActiveConversation] =
    React.useState<ConversationDetail | null>(null)
  const [activeLoading, setActiveLoading] = React.useState(false)

  // State - filters
  const [searchQuery, setSearchQuery] = React.useState("")
  const [directionFilter, setDirectionFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")

  // State - send message
  const [sendDialogOpen, setSendDialogOpen] = React.useState(false)
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [sendPhone, setSendPhone] = React.useState("")
  const [sendDeviceId, setSendDeviceId] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("")
  const [selectedTemplateLanguage, setSelectedTemplateLanguage] = React.useState("")
  const [templateFieldValues, setTemplateFieldValues] = React.useState<Record<number, string>>({})
  const [templateSearchQuery, setTemplateSearchQuery] = React.useState("")
  const [templatePickerOpen, setTemplatePickerOpen] = React.useState(true)

  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // ── Data fetching ──────────────────────────────────────────────────────

  // Fetch conversations when filters change
  React.useEffect(() => {
    let cancelled = false

    React.startTransition(() => {
      setConversationsLoading(true)
      setConversationsError(null)
    })

    whatsappClient.conversations
      .list({ status: statusFilter !== "all" ? statusFilter : undefined })
      .then((payload) => {
        if (cancelled) return
        React.startTransition(() => {
          if (payload.ok) {
            setConversations(payload.conversations ?? [])
          } else {
            setConversationsError("Failed to load conversations")
          }
          setConversationsLoading(false)
        })
      })
      .catch(() => {
        if (cancelled) return
        React.startTransition(() => {
          setConversationsError("Failed to load conversations")
          setConversationsLoading(false)
        })
      })

    return () => {
      cancelled = true
    }
  }, [searchQuery, statusFilter, refreshKey])

  // Fetch conversation details when activeConversationId changes
  React.useEffect(() => {
    if (!activeConversationId) {
      return
    }

    let cancelled = false

    React.startTransition(() => {
      setActiveLoading(true)
      setActiveConversation(null)
    })

    whatsappClient.conversations
      .get(activeConversationId)
      .then((payload) => {
        if (cancelled) return
        React.startTransition(() => {
          if (payload.ok) {
            setActiveConversation(payload.conversation)
          }
          setActiveLoading(false)
        })
      })
      .catch(() => {
        if (cancelled) return
        React.startTransition(() => {
          setActiveConversation(null)
          setActiveLoading(false)
        })
      })

    return () => {
      cancelled = true
    }
  }, [activeConversationId])

  // Scroll to bottom on new messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeConversation?.whatsappMessages])

  // Fetch devices for send dialog
  React.useEffect(() => {
    let cancelled = false

    whatsappClient.devices
      .list()
      .then((payload) => {
        if (!cancelled && payload.ok) setDevices(payload.devices)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  const hasActiveDevice = React.useMemo(
    () => devices.some((d) => d.status === "ACTIVE"),
    [devices]
  )

  // ── Device-filtered templates ──────────────────────────────────────────

  const { templates: deviceTemplates, loading: templatesLoading, error: templatesError, reload: reloadTemplates } = useTemplates({
    whatsappDeviceId: sendDeviceId || undefined,
    enabled: Boolean(sendDeviceId),
    sort: "desc",
  })

  const activeDevices = React.useMemo(
    () => devices.filter((d) => d.status === "ACTIVE"),
    [devices]
  )

  const hasSingleActiveDevice = React.useMemo(
    () => activeDevices.length === 1,
    [activeDevices]
  )

  // Auto-select the only active device when there's exactly one
  React.useEffect(() => {
    if (hasSingleActiveDevice && !sendDeviceId) {
      setSendDeviceId(activeDevices[0].id)
    }
  }, [activeDevices, hasSingleActiveDevice, sendDeviceId])

  const approvedTemplates = React.useMemo(
    () => deviceTemplates.filter((t) => t.metaStatus === "APPROVED"),
    [deviceTemplates]
  )

  // Reset template selection when device changes
  React.useEffect(() => {
    if (sendDeviceId) {
      // device changed — reset template state
      setSelectedTemplateId("")
      setSelectedTemplateLanguage("")
      setTemplateFieldValues({})
      setTemplateSearchQuery("")
      setTemplatePickerOpen(true)
    }
  }, [sendDeviceId])

  // ── Template helpers ─────────────────────────────────────────────────

  function getTemplateFieldIndexes(body?: string | null): number[] {
    if (!body) return []
    const matches = body.match(/{{\s*(\d+)\s*}}/g)
    if (!matches) return []
    const indexes = new Set<number>()
    for (const match of matches) {
      const num = parseInt(match.replace(/[{}]/g, "").trim(), 10)
      if (!isNaN(num) && num > 0) indexes.add(num)
    }
    return Array.from(indexes).sort((a, b) => a - b)
  }

  function renderTemplatePreview(body: string | null | undefined, values: Record<number, string>): string {
    if (!body) return ""
    return body.replace(/{{\s*(\d+)\s*}}/g, (_, num) => {
      const index = parseInt(num, 10)
      return values[index] || `{{${index}}}`
    })
  }

  // ── Derived state ──────────────────────────────────────────────────────

  const filteredConversations = React.useMemo(() => {
    let result = conversations

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((c) => c.contactPhone.toLowerCase().includes(q))
    }

    if (directionFilter !== "all") {
      result = result.filter((c) => c.lastDirection === directionFilter)
    }

    return result
  }, [conversations, searchQuery, directionFilter])

  // Reverse messages to show oldest first (they come desc from API)
  const orderedMessages = React.useMemo(
    () => (activeConversation?.whatsappMessages ?? []).slice().reverse(),
    [activeConversation?.whatsappMessages]
  )

  const replyWindowClosed = React.useMemo(
    () => isReplyWindowClosed(activeConversation),
    [activeConversation]
  )

  // Visible templates after search filter
  const visibleTemplates = React.useMemo(() => {
    if (!templateSearchQuery.trim()) return approvedTemplates
    const q = templateSearchQuery.trim().toLowerCase()
    return approvedTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
    )
  }, [approvedTemplates, templateSearchQuery])

  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (directionFilter !== "all") count++
    if (statusFilter !== "all") count++
    return count
  }, [directionFilter, statusFilter])

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id)
  }

  const openTemplateDialogForConversation = React.useCallback(
    (conversation: ConversationDetail) => {
      const phone = normalizeIndonesianPhoneNumber(conversation.contactPhone) ?? conversation.contactPhone
      setSendPhone(phone)
      if (activeDevices.some((d) => d.id === conversation.whatsappDeviceId)) {
        setSendDeviceId(conversation.whatsappDeviceId!)
      }
      setSelectedTemplateId("")
      setSelectedTemplateLanguage("")
      setTemplateFieldValues({})
      setTemplateSearchQuery("")
      setTemplatePickerOpen(true)
      setSendDialogOpen(true)
    },
    [activeDevices]
  )

  const handleSendMessage = async () => {
    if (!sendDeviceId) {
      toast.error("Please select a device")
      return
    }

    const normalizedPhone = normalizeIndonesianPhoneNumber(sendPhone)
    if (!normalizedPhone) {
      toast.error("Enter a valid phone number")
      return
    }

    if (!selectedTemplateId) {
      toast.error("Please select a template")
      return
    }

    if (!selectedTemplateLanguage) {
      toast.error("Please select a language")
      return
    }

    const selectedTemplate = approvedTemplates.find((t) => t.id === selectedTemplateId)
    const selectedLang = selectedTemplate?.languages.find(
      (l) => l.lang === selectedTemplateLanguage
    )
    const placeholderIndexes = getTemplateFieldIndexes(selectedLang?.body)

    for (const index of placeholderIndexes) {
      if (!templateFieldValues[index]?.trim()) {
        toast.error(`Template field {{${index}}} is required`)
        return
      }
    }

    setSending(true)
    try {
      await whatsappClient.messages.sendTemplate({
        phoneNumber: normalizedPhone,
        templateId: selectedTemplateId,
        templateLanguage: selectedTemplateLanguage,
        fields: placeholderIndexes.map((index) => templateFieldValues[index].trim()),
        deviceId: sendDeviceId,
      })

      toast.success("Template message queued for delivery")
      // Refresh conversations list
      whatsappClient.conversations
        .list()
        .then((p) => {
          if (p.ok) setConversations(p.conversations)
        })
        .catch(() => {})

      setSendDialogOpen(false)
      setSendDeviceId(hasSingleActiveDevice ? activeDevices[0]?.id ?? "" : "")
      setSelectedTemplateId("")
      setSelectedTemplateLanguage("")
      setTemplateFieldValues({})
      setTemplateSearchQuery("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────
  const handleDialogOpenChange = (open: boolean) => {
    setSendDialogOpen(open)
    if (open && !selectedTemplateId) {
      setTemplatePickerOpen(true)
    }
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">
            View and manage your WhatsApp message history.
          </p>
        </div>
        <Dialog open={sendDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button disabled={devices.length > 0 && !hasActiveDevice}>
              <PaperPlaneTilt className="mr-2 size-4" weight="bold" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Send Template Message</DialogTitle>
              <DialogDescription>
                Select a device, choose an approved WhatsApp template, fill required fields, then send it to a phone number.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
              <div className="grid min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                {/* ── Left Column ───────────────────────────────────── */}
                <div className="space-y-4">
                  {/* Phone Number — top of left column */}
                  <div className="grid gap-2">
                    <Label htmlFor="send-phone">Phone Number *</Label>
                    <Input
                      id="send-phone"
                      placeholder="+628123456789"
                      value={sendPhone}
                      onChange={(e) => setSendPhone(e.target.value)}
                    />
                  </div>

                  {/* Device Selection — hidden when single active device */}
                  {hasSingleActiveDevice && sendDeviceId ? (
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">Device</Label>
                      <p className="text-sm font-medium">{activeDevices[0].phoneNumber}</p>
                    </div>
                  ) : activeDevices.length > 1 ? (
                    <div className="grid gap-2 mb-4">
                      <Label htmlFor="send-device">Device *</Label>
                      <Select value={sendDeviceId} onValueChange={setSendDeviceId}>
                        <SelectTrigger id="send-device">
                          <SelectValue placeholder="Select a device..." />
                        </SelectTrigger>
                        <SelectContent>
                          {activeDevices.map((device) => (
                            <SelectItem key={device.id} value={device.id}>
                              {device.phoneNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="grid gap-2 mb-4">
                      <Label htmlFor="send-device">Device *</Label>
                      <Select value={sendDeviceId} onValueChange={setSendDeviceId}>
                        <SelectTrigger id="send-device">
                          <SelectValue placeholder="Select a device..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none" disabled>
                            No active devices available
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Template Selection — searchable */}
                  <div className="grid gap-2">
                    <Label htmlFor="send-template">Template *</Label>
                    {!sendDeviceId ? (
                      <div className="flex h-10 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                        Select a device first
                      </div>
                    ) : templatesLoading ? (
                      <div className="flex h-10 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                        Loading templates...
                      </div>
                    ) : templatesError ? (
                      <div className="flex flex-col gap-2 rounded-md border border-destructive/50 p-3">
                        <span className="text-sm text-destructive">{templatesError}</span>
                        <Button size="sm" variant="outline" onClick={reloadTemplates}>
                          Retry
                        </Button>
                      </div>
                    ) : approvedTemplates.length === 0 ? (
                      <div className="flex h-10 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                        No approved templates for this device
                      </div>
                    ) : selectedTemplateId && !templatePickerOpen ? (
                      <div className="rounded-md border p-3">
                        {(() => {
                          const tpl = approvedTemplates.find((t) => t.id === selectedTemplateId)
                          if (!tpl) return null
                          return (
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{tpl.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{tpl.slug}</p>
                                <Badge variant="secondary" className="mt-1 text-[10px]">
                                  {tpl.languages.length} lang{tpl.languages.length !== 1 ? "s" : ""}
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setTemplatePickerOpen(true)}
                              >
                                Change Template
                              </Button>
                            </div>
                          )
                        })()}
                      </div>
                    ) : (
                      <>
                        <Input
                          id="send-template"
                          placeholder="Type to filter templates..."
                          value={templateSearchQuery}
                          onChange={(e) => setTemplateSearchQuery(e.target.value)}
                        />
                        <div className="max-h-64 overflow-y-auto rounded-md border">
                          {visibleTemplates.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              No templates match your search
                            </div>
                          ) : (
                            visibleTemplates.map((tpl) => (
                              <button
                                key={tpl.id}
                                type="button"
                                onClick={() => {
                                  setSelectedTemplateId(tpl.id)
                                  setTemplateSearchQuery("")
                                  setTemplateFieldValues({})
                                  setTemplatePickerOpen(false)
                                  const approvedLang = tpl.languages.find(
                                    (l) => l.isApproved || l.metaStatus === "APPROVED"
                                  )
                                  setSelectedTemplateLanguage(
                                    approvedLang?.lang ?? tpl.languages[0]?.lang ?? ""
                                  )
                                }}
                                className={`flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50 ${
                                  selectedTemplateId === tpl.id ? "bg-muted" : ""
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-sm truncate">{tpl.name}</span>
                                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                                    {tpl.languages.length} lang{tpl.languages.length !== 1 ? "s" : ""}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground truncate">{tpl.slug}</span>
                                {tpl.languages[0]?.body && (
                                  <span className="text-xs text-muted-foreground line-clamp-2">
                                    {tpl.languages[0].body.substring(0, 80)}
                                    {tpl.languages[0].body.length > 80 ? "…" : ""}
                                  </span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Language Selection */}
                  {selectedTemplateId && (() => {
                    const tpl = approvedTemplates.find((t) => t.id === selectedTemplateId)
                    if (!tpl) return null
                    return (
                      <div className="grid gap-2">
                        <Label htmlFor="send-language">Language *</Label>
                        <Select
                          value={selectedTemplateLanguage}
                          onValueChange={setSelectedTemplateLanguage}
                        >
                          <SelectTrigger id="send-language">
                            <SelectValue placeholder="Select language..." />
                          </SelectTrigger>
                          <SelectContent>
                            {tpl.languages.map((lang) => (
                              <SelectItem key={lang.lang} value={lang.lang}>
                                {lang.lang}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  })()}

                  {/* Field placeholders */}
                  {selectedTemplateLanguage && (() => {
                    const tpl = approvedTemplates.find((t) => t.id === selectedTemplateId)
                    const lang = tpl?.languages.find((l) => l.lang === selectedTemplateLanguage)
                    const indexes = getTemplateFieldIndexes(lang?.body)
                    if (indexes.length === 0) return null
                    return (
                      <>
                        {indexes.map((index) => (
                          <div className="grid gap-2" key={index}>
                            <Label htmlFor={`field-${index}`}>Field {`{{${index}}}`}</Label>
                            <Input
                              id={`field-${index}`}
                              placeholder={`Value for {{${index}}}`}
                              value={templateFieldValues[index] ?? ""}
                              onChange={(e) =>
                                setTemplateFieldValues((prev) => ({ ...prev, [index]: e.target.value }))
                              }
                            />
                          </div>
                        ))}
                      </>
                    )
                  })()}
                </div>

                {/* ── Right Column: Preview Panel ─────────────────────── */}
                <div className="space-y-4 lg:sticky lg:top-0">
                  <div className="rounded-lg border bg-card">
                    <div className="border-b px-4 py-3">
                      <h4 className="text-sm font-semibold">Message Preview</h4>
                    </div>
                    <div className="space-y-3 p-4">
                      {selectedTemplateId ? (() => {
                        const tpl = approvedTemplates.find((t) => t.id === selectedTemplateId)
                        if (!tpl) return null
                        return (
                          <>
                            <div>
                              <p className="text-xs text-muted-foreground">Template</p>
                              <p className="text-sm font-medium">{tpl.name}</p>
                            </div>
                            {selectedTemplateLanguage && (
                              <div>
                                <p className="text-xs text-muted-foreground">Language</p>
                                <p className="text-sm">{selectedTemplateLanguage}</p>
                              </div>
                            )}
                            {(() => {
                              const lang = tpl.languages.find((l) => l.lang === selectedTemplateLanguage)
                              if (!lang?.body) return null
                              return (
                                <div>
                                  <p className="text-xs text-muted-foreground">Body</p>
                                  <div className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                                    {renderTemplatePreview(lang.body, templateFieldValues) || "—"}
                                  </div>
                                </div>
                              )
                            })()}
                          </>
                        )
                      })() : (
                        <p className="text-sm text-muted-foreground">
                          Select a template to see a preview.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={
                  sending ||
                  activeDevices.length === 0 ||
                  !sendDeviceId ||
                  templatesLoading ||
                  !approvedTemplates.find((t) => t.id === selectedTemplateId)
                }
              >
                {sending ? "Sending..." : "Send Template Message"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Left Column: Conversations List ─────────────────────────── */}
        <div className="overflow-hidden rounded-lg border bg-card lg:col-span-1">
          {/* Sticky compact filter header */}
          <div className="sticky top-0 z-10 border-b bg-card/95 p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold shrink-0">Conversations</h3>
              <div className="relative min-w-0 flex-1">
                <MagnifyingGlass className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 min-w-0 flex-1 pl-8 text-sm"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
                    <FunnelSimple className="size-4" />
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-0.5 h-5 w-5 items-center justify-center p-0 text-[10px]">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Direction</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={directionFilter} onValueChange={setDirectionFilter}>
                    <DropdownMenuRadioItem value="all">All Directions</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="INBOX">Inbox</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="OUTBOX">Outbox</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                    <DropdownMenuRadioItem value="all">All Status</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="SENT">Sent</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="DELIVERED">Delivered</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="READ">Read</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="FAILED">Failed</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {/* Loading */}
            {conversationsLoading && (
              <div className="space-y-1 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {!conversationsLoading && conversationsError && (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <ChatCircle
                  className="mb-3 size-10 text-destructive"
                  weight="fill"
                />
                <p className="text-sm text-destructive">{conversationsError}</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => setRefreshKey((k) => k + 1)}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Empty */}
            {!conversationsLoading &&
              !conversationsError &&
              filteredConversations.length === 0 && (
                <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                  <ChatCircle
                    className="mb-3 size-10 text-muted-foreground"
                    weight="fill"
                  />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || directionFilter !== "all"
                      ? "No conversations match your filters"
                      : "No conversations yet"}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => setSendDialogOpen(true)}
                  >
                    <PaperPlaneTilt className="mr-2 size-4" />
                    Start a conversation
                  </Button>
                </div>
              )}

            {/* List */}
            {!conversationsLoading &&
              !conversationsError &&
              filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={activeConversationId === conversation.id}
                  onClick={() => handleSelectConversation(conversation.id)}
                />
              ))}
          </div>
        </div>

        {/* ── Right Column: Message Thread ────────────────────────────── */}
        <div className="flex flex-col overflow-hidden rounded-lg border bg-card lg:col-span-2">
          {/* Thread Header */}
          <div className="flex items-center justify-between border-b p-4">
            {activeConversation ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                    <Phone className="size-4 text-primary" weight="fill" />
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {formatPhone(activeConversation.contactPhone)}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {activeConversation._count.whatsappMessages} messages
                    </p>
                  </div>
                </div>
                {replyWindowClosed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTemplateDialogForConversation(activeConversation)}
                  >
                    <PaperPlaneTilt className="mr-1 size-4" weight="bold" />
                    Send Template
                  </Button>
                )}
              </>
            ) : (
              <h3 className="font-semibold">Select a conversation</h3>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex min-h-[500px] flex-1 flex-col overflow-y-auto p-4">
            {/* Loading */}
            {activeLoading && (
              <div className="flex flex-1 flex-col justify-end gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex ${
                      i % 2 === 0 ? "justify-start" : "justify-end"
                    }`}
                  >
                    <Skeleton
                      className={`h-12 rounded-2xl ${
                        i % 2 === 0 ? "rounded-bl-sm" : "rounded-br-sm"
                      } ${i % 2 === 0 ? "w-3/5" : "w-2/5"}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* No conversation selected */}
            {!activeLoading && !activeConversation && (
              <div className="flex flex-1 flex-col items-center justify-center">
                <ChatCircle
                  className="mb-3 size-10 text-muted-foreground"
                  weight="fill"
                />
                <p className="text-sm text-muted-foreground">
                  Select a conversation to view messages
                </p>
              </div>
            )}

            {/* Empty thread */}
            {!activeLoading &&
              activeConversation &&
              orderedMessages.length === 0 && (
                <div className="flex flex-1 flex-col items-center justify-center">
                  <ChatCircle
                    className="mb-3 size-10 text-muted-foreground"
                    weight="fill"
                  />
                  <p className="text-sm text-muted-foreground">
                    No messages in this conversation yet
                  </p>
                  {replyWindowClosed && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => openTemplateDialogForConversation(activeConversation)}
                    >
                      <PaperPlaneTilt className="mr-1 size-4" weight="bold" />
                      Send Template
                    </Button>
                  )}
                </div>
              )}

            {/* Messages */}
            {!activeLoading && orderedMessages.length > 0 && (
              <div className="flex flex-1 flex-col justify-end gap-3">
                {orderedMessages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

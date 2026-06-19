"use client"

import * as React from "react"
import {
  ChatCircle,
  PaperPlaneTilt,
  ArrowBendDownLeft,
  ArrowBendUpRight,
  MagnifyingGlass,
  Phone,
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
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"

// ─── Local Types ─────────────────────────────────────────────────────────────

type MessageDirection = "INBOX" | "OUTBOX"

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
        <p
          className={`mt-1 text-right text-[10px] ${
            isInbox ? "text-muted-foreground" : "text-primary-foreground/70"
          }`}
        >
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  )
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function WhatsAppMessagesPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
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

  // State - send message
  const [sendDialogOpen, setSendDialogOpen] = React.useState(false)
  const [devices, setDevices] = React.useState<DeviceListItem[]>([])
  const [sendPhone, setSendPhone] = React.useState("")
  const [sendText, setSendText] = React.useState("")
  const [sendDeviceId, setSendDeviceId] = React.useState("")
  const [sending, setSending] = React.useState(false)

  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // ── Data fetching ──────────────────────────────────────────────────────

  // Fetch conversations when searchQuery changes
  React.useEffect(() => {
    let cancelled = false

    React.startTransition(() => {
      setConversationsLoading(true)
      setConversationsError(null)
    })

    whatsappClient.conversations
      .list(
        searchQuery.trim() ? { contactPhone: searchQuery.trim() } : undefined
      )
      .then((payload) => {
        if (cancelled) return
        React.startTransition(() => {
          if (payload.ok) {
            setConversations(payload.conversations)
          }
          setConversationsLoading(false)
        })
      })
      .catch((err) => {
        if (cancelled) return
        React.startTransition(() => {
          setConversationsError(
            err instanceof Error ? err.message : "Failed to load conversations"
          )
          setConversationsLoading(false)
        })
      })

    return () => {
      cancelled = true
    }
  }, [searchQuery, refreshKey])

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

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id)
  }

  const handleSendMessage = async () => {
    if (!sendPhone.trim() || !sendText.trim()) {
      toast.error("Phone number and message are required")
      return
    }

    setSending(true)
    try {
      await whatsappClient.messages.send({
        phoneNumber: sendPhone.trim(),
        message: sendText.trim(),
        deviceId: sendDeviceId || undefined,
      })

      toast.success("Message queued for delivery")
      // Refresh conversations list
      whatsappClient.conversations
        .list()
        .then((p) => {
          if (p.ok) setConversations(p.conversations)
        })
        .catch(() => {})

      setSendDialogOpen(false)
      setSendPhone("")
      setSendText("")
      setSendDeviceId("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">
            View and manage your WhatsApp message history.
          </p>
        </div>
        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={devices.length > 0 && !hasActiveDevice}>
              <PaperPlaneTilt className="mr-2 size-4" weight="bold" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send a Message</DialogTitle>
              <DialogDescription>
                Send a new WhatsApp message to a phone number.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="send-phone">Phone Number *</Label>
                <Input
                  id="send-phone"
                  placeholder="+628123456789"
                  value={sendPhone}
                  onChange={(e) => setSendPhone(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="send-message">Message *</Label>
                <textarea
                  id="send-message"
                  className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-none"
                  placeholder="Type your message..."
                  value={sendText}
                  onChange={(e) => setSendText(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="send-device">Device (optional)</Label>
                <Select value={sendDeviceId} onValueChange={setSendDeviceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auto-select device" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-select device</SelectItem>
                    {devices.map((device) => (
                      <SelectItem
                        key={device.id}
                        value={device.id}
                        disabled={device.status !== "ACTIVE"}
                      >
                        {device.phoneNumber}
                        {device.status !== "ACTIVE" && " (inactive)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSendDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSendMessage} disabled={sending}>
                {sending ? "Sending..." : "Send Message"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Left Column: Conversations List ─────────────────────────── */}
        <div className="overflow-hidden rounded-lg border bg-card lg:col-span-1">
          <div className="border-b p-4">
            <h3 className="font-semibold">Conversations</h3>
            <div className="mt-3 flex flex-col gap-2">
              <div className="relative">
                <MagnifyingGlass className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={directionFilter}
                onValueChange={setDirectionFilter}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Directions</SelectItem>
                  <SelectItem value="INBOX">Inbox</SelectItem>
                  <SelectItem value="OUTBOX">Outbox</SelectItem>
                </SelectContent>
              </Select>
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

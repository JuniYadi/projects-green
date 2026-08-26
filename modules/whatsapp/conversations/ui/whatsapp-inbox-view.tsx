"use client"

import * as React from "react"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import {
  ChatCircleText,
  MagnifyingGlass,
  Check,
  Checks,
  PaperPlaneRight,
  ArrowClockwise,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"

export type LifecycleStatus = "ALL" | "OPEN" | "PENDING" | "RESOLVED"

export interface MessageItem {
  id: string
  direction: "INBOX" | "OUTBOX"
  messageType: string
  body: string | null
  createdAt: string
  statusHistory?: Array<{ status: string }>
}

export interface ConversationItem {
  id: string
  contactPhone: string
  status: "OPEN" | "PENDING" | "RESOLVED"
  stage?: string | null
  assigneeId?: string | null
  lastMessageAt?: string | null
  lastDirection?: "INBOX" | "OUTBOX" | null
  csatScore?: number | null
  conversationLabels?: Array<{
    label: { id: string; name: string; color?: string | null }
  }>
  whatsappMessages?: MessageItem[]
  _count?: { whatsappMessages: number }
  notes?: Array<{
    id: string
    body: string
    authorName?: string | null
    createdAt: string
  }>
  activities?: Array<{
    id: string
    type: string
    fromValue?: string | null
    toValue?: string | null
    actorName?: string | null
    createdAt: string
  }>
}

export function WhatsAppInboxView() {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<LifecycleStatus>(
    (searchParams.get("status")?.toUpperCase() as LifecycleStatus) || "ALL"
  )
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "")
  const initialSelectedId = searchParams.get("id")
  const [selectedIdState, setSelectedIdState] = useState<string | null>(
    initialSelectedId
  )
  const [replyText, setReplyText] = useState("")
  const [noteText, setNoteText] = useState("")
  const [activeTab, setActiveTab] = useState<"chat" | "notes" | "activity">(
    "chat"
  )

  // Fetch conversations list with auto-refresh polling (every 10s)
  const {
    data: conversationsData,
    isLoading: isLoadingList,
    refetch: refetchList,
  } = useQuery({
    queryKey: ["whatsapp-inbox-conversations", statusFilter, searchQuery],
    queryFn: async () => {
      const q = new URLSearchParams()
      if (statusFilter !== "ALL") q.set("lifecycleStatus", statusFilter)
      if (searchQuery) q.set("contactPhone", searchQuery)
      q.set("limit", "50")

      const res = await fetch(`/api/whatsapp/conversations?${q.toString()}`)
      if (!res.ok) throw new Error("Failed to load conversations")
      const json = await res.json()
      return (json.conversations || []) as ConversationItem[]
    },
    refetchInterval: 10000,
  })

  const conversations = conversationsData || []
  const selectedId = selectedIdState || conversations[0]?.id || null

  // Fetch selected conversation details
  const {
    data: selectedConversation,
    isLoading: isLoadingDetail,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ["whatsapp-conversation-detail", selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const res = await fetch(`/api/whatsapp/conversations/${selectedId}`)
      if (!res.ok) throw new Error("Failed to load conversation details")
      const json = await res.json()
      return json.conversation as ConversationItem
    },
    enabled: !!selectedId,
    refetchInterval: 8000,
  })

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async ({ phone, text }: { phone: string; text: string }) => {
      const res = await fetch("/api/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          messageType: "TEXT",
          text: { body: text },
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || "Failed to send message")
      }
      return res.json()
    },
    onSuccess: () => {
      setReplyText("")
      toast.success("Message sent")
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-conversation-detail", selectedId],
      })
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-inbox-conversations"],
      })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // Update lifecycle status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: "OPEN" | "PENDING" | "RESOLVED"
    }) => {
      const res = await fetch(`/api/whatsapp/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      return res.json()
    },
    onSuccess: (_, vars) => {
      toast.success(`Conversation marked as ${vars.status}`)
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-conversation-detail", selectedId],
      })
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-inbox-conversations"],
      })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const res = await fetch(`/api/whatsapp/conversations/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error("Failed to add note")
      return res.json()
    },
    onSuccess: () => {
      setNoteText("")
      toast.success("Internal note added")
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-conversation-detail", selectedId],
      })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!replyText.trim() || !selectedConversation) return
    sendMutation.mutate({
      phone: selectedConversation.contactPhone,
      text: replyText.trim(),
    })
  }

  const handleAddNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!noteText.trim() || !selectedId) return
    addNoteMutation.mutate({
      id: selectedId,
      body: noteText.trim(),
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-600"
          >
            Open
          </Badge>
        )
      case "PENDING":
        return (
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 text-xs text-amber-600"
          >
            Pending
          </Badge>
        )
      case "RESOLVED":
        return (
          <Badge
            variant="outline"
            className="border-zinc-500/30 bg-zinc-500/10 text-xs text-zinc-600"
          >
            Resolved
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        )
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] w-full flex-col overflow-hidden rounded-lg border bg-card">
      {/* Inbox Header */}
      <header className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <ChatCircleText className="h-5 w-5 text-primary" weight="fill" />
          <h1 className="text-base font-semibold">WhatsApp Operations Inbox</h1>
          <Badge variant="secondary" className="ml-2 font-mono text-xs">
            {conversations.length}{" "}
            {conversations.length === 1 ? "chat" : "chats"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchList()
              if (selectedId) refetchDetail()
            }}
            className="h-8 gap-1 text-xs"
          >
            <ArrowClockwise className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-12">
        {/* Left Column: Conversations List */}
        <aside className="flex flex-col overflow-hidden border-r bg-muted/5 md:col-span-4 lg:col-span-4">
          {/* Filter & Search Controls */}
          <div className="space-y-2 border-b bg-background p-3">
            <div className="relative">
              <MagnifyingGlass className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val as LifecycleStatus)}
              >
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue placeholder="Status Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conversation List Items */}
          <div className="flex-1 divide-y overflow-y-auto">
            {isLoadingList ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No conversations match the current filter.
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.id === selectedId
                const isUnread = conv.lastDirection === "INBOX"
                const lastMsg = conv.whatsappMessages?.[0]
                const preview = lastMsg?.body || "No messages yet"

                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedIdState(conv.id)}
                    className={`flex w-full flex-col gap-1.5 p-3 text-left transition-colors hover:bg-muted/40 ${
                      isSelected ? "border-l-2 border-primary bg-muted/60" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        {conv.contactPhone}
                        {isUnread && (
                          <span
                            className="h-2 w-2 rounded-full bg-emerald-500"
                            title="New unread message"
                          />
                        )}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {conv.lastMessageAt
                          ? new Date(conv.lastMessageAt).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" }
                            )
                          : ""}
                      </span>
                    </div>

                    <p className="line-clamp-1 text-xs break-all text-muted-foreground">
                      {preview}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1">
                        {getStatusBadge(conv.status)}
                        {conv.stage && (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1.5 py-0 text-[10px]"
                          >
                            {conv.stage}
                          </Badge>
                        )}
                      </div>
                      {conv.conversationLabels?.map((cl) => (
                        <Badge
                          key={cl.label.id}
                          variant="outline"
                          className="h-4 px-1.5 py-0 text-[10px]"
                        >
                          {cl.label.name}
                        </Badge>
                      ))}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Right Column: Chat View & Sidebar */}
        <main className="flex flex-col overflow-hidden bg-background md:col-span-8 lg:col-span-8">
          {selectedConversation ? (
            <div className="flex h-full flex-col overflow-hidden">
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b bg-muted/10 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {selectedConversation.contactPhone.slice(-2)}
                  </div>
                  <div>
                    <h2 className="text-sm leading-none font-semibold">
                      {selectedConversation.contactPhone}
                    </h2>
                    <div className="mt-1 flex items-center gap-2">
                      {getStatusBadge(selectedConversation.status)}
                      <span className="text-[11px] text-muted-foreground">
                        {selectedConversation._count?.whatsappMessages || 0}{" "}
                        messages
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={selectedConversation.status}
                    onValueChange={(val) =>
                      updateStatusMutation.mutate({
                        id: selectedConversation.id,
                        status: val as "OPEN" | "PENDING" | "RESOLVED",
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Mark Open</SelectItem>
                      <SelectItem value="PENDING">Mark Pending</SelectItem>
                      <SelectItem value="RESOLVED">Mark Resolved</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex rounded-md border bg-muted/30 p-0.5 text-xs">
                    <button
                      onClick={() => setActiveTab("chat")}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                        activeTab === "chat"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      Chat
                    </button>
                    <button
                      onClick={() => setActiveTab("notes")}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                        activeTab === "notes"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      Notes ({selectedConversation.notes?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab("activity")}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                        activeTab === "activity"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      Activity
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat View / Notes / Activity Tabs */}
              <div className="flex flex-1 flex-col overflow-hidden">
                {activeTab === "chat" && (
                  <>
                    {/* Message Bubble Stream */}
                    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col-reverse space-y-3 space-y-reverse overflow-y-auto p-4">
                      {isLoadingDetail ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          Loading message history...
                        </div>
                      ) : selectedConversation.whatsappMessages?.length ===
                        0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          No messages recorded in this conversation.
                        </div>
                      ) : (
                        selectedConversation.whatsappMessages?.map((msg) => {
                          const isOutbound = msg.direction === "OUTBOX"
                          const latestStatus = msg.statusHistory?.[0]?.status

                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
                            >
                              <div
                                className={`max-w-[75%] rounded-lg px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
                                  isOutbound
                                    ? "rounded-br-none bg-primary text-primary-foreground"
                                    : "rounded-bl-none bg-muted text-foreground"
                                }`}
                              >
                                <p className="break-words whitespace-pre-wrap">
                                  {msg.body || `[${msg.messageType}]`}
                                </p>
                                <div
                                  className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${
                                    isOutbound
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  <span>
                                    {new Date(msg.createdAt).toLocaleTimeString(
                                      [],
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )}
                                  </span>
                                  {isOutbound && (
                                    <span>
                                      {latestStatus === "READ" ? (
                                        <Checks
                                          className="h-3 w-3 text-cyan-300"
                                          weight="bold"
                                        />
                                      ) : latestStatus === "DELIVERED" ? (
                                        <Checks className="h-3 w-3" />
                                      ) : (
                                        <Check className="h-3 w-3" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>

                    {/* Inline Reply Composer */}
                    <form
                      onSubmit={handleSend}
                      className="flex items-center gap-2 border-t bg-muted/10 p-3"
                    >
                      <Input
                        placeholder={`Reply to ${selectedConversation.contactPhone}...`}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        disabled={sendMutation.isPending}
                        className="h-9 flex-1 text-xs"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!replyText.trim() || sendMutation.isPending}
                        className="h-9 gap-1.5 px-4 text-xs"
                      >
                        <PaperPlaneRight className="h-4 w-4" weight="bold" />
                        Send
                      </Button>
                    </form>
                  </>
                )}

                {activeTab === "notes" && (
                  <div className="flex flex-1 flex-col overflow-hidden p-4">
                    <form onSubmit={handleAddNote} className="mb-4 space-y-2">
                      <Textarea
                        placeholder="Add an internal note (@mention teammates)..."
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        rows={3}
                        className="text-xs"
                      />
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={
                            !noteText.trim() || addNoteMutation.isPending
                          }
                          className="h-8 text-xs"
                        >
                          Add Note
                        </Button>
                      </div>
                    </form>

                    <div className="flex-1 space-y-3 overflow-y-auto">
                      {selectedConversation.notes?.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          No internal notes yet.
                        </div>
                      ) : (
                        selectedConversation.notes?.map((note) => (
                          <Card
                            key={note.id}
                            className="space-y-1 bg-muted/20 p-3 text-xs"
                          >
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span className="font-semibold text-foreground">
                                {note.authorName || "Team Member"}
                              </span>
                              <span>
                                {new Date(note.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{note.body}</p>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "activity" && (
                  <div className="mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto p-4">
                    {selectedConversation.activities?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground">
                        No activities logged yet.
                      </div>
                    ) : (
                      selectedConversation.activities?.map((act) => (
                        <div
                          key={act.id}
                          className="flex items-start gap-2 border-l-2 border-primary/30 py-1 pl-3 text-xs text-muted-foreground"
                        >
                          <div>
                            <p className="text-foreground">
                              <span className="font-medium">
                                {act.actorName || "System"}
                              </span>{" "}
                              <span className="font-mono text-xs text-muted-foreground">
                                [{act.type}]
                              </span>
                              {act.fromValue && act.toValue && (
                                <span>
                                  : {act.fromValue} → {act.toValue}
                                </span>
                              )}
                            </p>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(act.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <ChatCircleText className="mb-2 h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">
                No conversation selected
              </p>
              <p className="mt-1 text-xs">
                Select a conversation from the left to view messages and reply.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

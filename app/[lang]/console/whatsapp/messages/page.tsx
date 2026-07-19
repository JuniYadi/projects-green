"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ChatCircle,
  PaperPlaneTilt,
  ArrowBendDownLeft,
  ArrowBendUpRight,
  MagnifyingGlass,
  Phone,
  FunnelSimple,
  CheckIcon,
  DotsThreeVertical,
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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { FilterPills } from "@/components/ui/filter-pills"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import type { WhatsAppTemplateLanguage } from "@/lib/api/whatsapp-client"
import { useTemplates } from "@/modules/whatsapp/templates/api/templates.hooks"
import { MessageStatusBadge } from "@/modules/whatsapp/messages/ui/message-status-badge"
import { normalizeIndonesianPhoneNumber } from "@/modules/whatsapp/messages/phone-number"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { groupMessagesByDate } from "@/modules/whatsapp/messages/ui/date-group"
import { MessageDateGroup } from "@/modules/whatsapp/messages/ui/message-date-group"
import {
  getTemplatePlaceholderIndexes,
  WhatsAppTemplatePreview,
} from "@/modules/whatsapp/templates/ui/template-preview"

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
  conversationLabels?: Array<{
    label: { id: string; name: string; color?: string | null }
  }>
  internalNotes?: string | null
}
type Message = {
  id: string
  conversationId: string
  direction: MessageDirection
  messageType: string
  body: string | null
  mediaUrl: string | null
  waMessageId: string | null
  metadata: TemplateMessageMetadata | Record<string, unknown> | null
  statusHistory?: StatusHistory[]
  createdAt: string
  updatedAt: string
}
type TemplateMessageMetadata = {
  templateName?: string
  templateLanguage?: string
  fields?: string[]
  templateLanguageData?: WhatsAppTemplateLanguage
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

function formatLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return ""
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ""
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZoneName: "short",
    }).format(d)
  } catch {
    return ""
  }
}

const PHONE_QUERY_KEY = "phone"

const cleanPhoneForQuery = (phone: string) => phone.replace(/\D/g, "")

const findConversationByPhone = (
  conversations: ConversationListItem[],
  phone: string
) => {
  const target = cleanPhoneForQuery(phone)
  if (!target) return null
  return (
    conversations.find(
      (conversation) => cleanPhoneForQuery(conversation.contactPhone) === target
    ) ?? null
  )
}
// ─── Conversation List Item ───────────────────────────────────────────────────

function ConversationItem({
  conversation,
  isActive,
  onClick,
  onDelete,
  onNotes,
  onLabels,
}: {
  conversation: ConversationListItem
  isActive: boolean
  onClick: () => void
  onDelete: (id: string) => void
  onNotes: (conversation: ConversationListItem) => void
  onLabels: (conversation: ConversationListItem) => void
}) {
  const DirectionIcon =
    conversation.lastDirection === "INBOX"
      ? ArrowBendDownLeft
      : ArrowBendUpRight

  return (
    <div
      className={`flex w-full items-center gap-2 border-b px-3 py-3 transition-colors hover:bg-muted/50 ${
        isActive ? "bg-muted" : ""
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
              <Badge
                variant="secondary"
                className="ml-auto shrink-0 text-[10px]"
              >
                {conversation._count.whatsappMessages}
              </Badge>
            )}
          </div>
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted focus:ring-1 focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <DotsThreeVertical className="size-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onNotes(conversation)}>
            <span>Internal Notes</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onLabels(conversation)}>
            <span>Add Label</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => onDelete(conversation.id)}
          >
            <span>Delete Chat</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ─── Message Bubble ──────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: Message }) {
  const isInbox = message.direction === "INBOX"

  // Template messages with stored language data render as full preview
  if (
    message.messageType === "template" &&
    message.metadata?.templateLanguageData
  ) {
    const meta = message.metadata as TemplateMessageMetadata
    const values = (meta.fields ?? []).reduce<Record<number, string>>(
      (acc, val, i) => {
        acc[i + 1] = val
        return acc
      },
      {}
    )

    return (
      <div className="flex justify-end">
        <WhatsAppTemplatePreview
          language={meta.templateLanguageData!}
          values={values}
          mode="full"
        />
      </div>
    )
  }

  return (
    <TooltipProvider>
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
          <div
            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
              isInbox ? "text-muted-foreground" : "text-primary-foreground/70"
            }`}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{formatTime(message.createdAt)}</span>
              </TooltipTrigger>
              <TooltipContent>
                {formatLocalDateTime(message.createdAt)}
              </TooltipContent>
            </Tooltip>
            <MessageStatusBadge
              statusHistory={message.statusHistory}
              direction={message.direction}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function WhatsAppMessagesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // State - filters
  const [searchQuery, setSearchQuery] = React.useState("")
  const [directionFilter, setDirectionFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  // State - label filters
  const [labelFilterIds, setLabelFilterIds] = React.useState<string[]>([])

  // State - action menu
  const [selectedConversationId, setSelectedConversationId] = React.useState<
    string | null
  >(null)
  const [notesDialogOpen, setNotesDialogOpen] = React.useState(false)
  const [notesText, setNotesText] = React.useState("")
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [labelPickerOpen, setLabelPickerOpen] = React.useState(false)
  const [selectedLabelIds, setSelectedLabelIds] = React.useState<Set<string>>(
    new Set()
  )

  // State - active conversation
  const [activeConversationId, setActiveConversationId] = React.useState<
    string | null
  >(null)

  // State - send message
  const [sendDialogOpen, setSendDialogOpen] = React.useState(false)
  const [sendPhone, setSendPhone] = React.useState("")
  const [sendDeviceId, setSendDeviceId] = React.useState("")
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("")
  const [selectedTemplateLanguage, setSelectedTemplateLanguage] =
    React.useState("")
  const [templateFieldValues, setTemplateFieldValues] = React.useState<
    Record<number, string>
  >({})
  const [templateSearchQuery, setTemplateSearchQuery] = React.useState("")
  const [templatePickerOpen, setTemplatePickerOpen] = React.useState(true)

  const queryClient = useQueryClient()

  const {
    data: conversations = [],
    isLoading: conversationsLoading,
    error: conversationsError,
  } = useQuery({
    queryKey: ["whatsapp", "conversations", { status: statusFilter }],
    queryFn: () =>
      whatsappClient.conversations.list({
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
    select: (payload) => (payload.ok ? (payload.conversations ?? []) : []),
  })

  const { data: activeConversation = null, isLoading: activeLoading } =
    useQuery<ConversationDetail | null>({
      queryKey: ["whatsapp", "conversation", activeConversationId],
      queryFn: async () => {
        if (!activeConversationId) return null
        const payload =
          await whatsappClient.conversations.get(activeConversationId)
        return payload.ok ? payload.conversation : null
      },
      enabled: Boolean(activeConversationId),
    })

  const { data: devices = [] } = useQuery({
    queryKey: ["whatsapp", "devices"],
    queryFn: async () => {
      const payload = await whatsappClient.devices.list()
      return payload.ok ? payload.devices : []
    },
  })
  const { data: allLabels = [] } = useQuery({
    queryKey: ["whatsapp", "conversations", "labels"],
    queryFn: async () => {
      const payload = await whatsappClient.conversations.getLabels()
      return payload.ok ? payload.labels : []
    },
  })

  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const loadConversationForPhone = React.useCallback(
    async (phone: string, conversationsCache: ConversationListItem[]) => {
      const target = cleanPhoneForQuery(phone)
      if (!target) return null
      const local = findConversationByPhone(conversationsCache, phone)
      if (local) return local
      const payload = await whatsappClient.conversations.list({
        contactPhone: phone,
      })
      return payload.ok
        ? findConversationByPhone(payload.conversations ?? [], phone)
        : null
    },
    []
  )

  // Select conversation from ?phone= query parameter
  React.useEffect(() => {
    const phoneQuery = searchParams.get(PHONE_QUERY_KEY)
    if (!phoneQuery) return
    const phoneDigits = cleanPhoneForQuery(phoneQuery)
    if (!phoneDigits) return
    const match = findConversationByPhone(conversations, phoneDigits)
    if (match && match.id !== activeConversationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveConversationId(match.id)
    }

    // Async fallback: conversations not yet loaded
    if (conversations.length === 0) {
      let cancelled = false
      loadConversationForPhone(phoneDigits, conversations)
        .then((found) => {
          if (cancelled || !found) return
          setActiveConversationId((prev) =>
            prev === found.id ? prev : found.id
          )
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }
  }, [
    searchParams,
    conversations,
    activeConversationId,
    loadConversationForPhone,
  ])

  const hasActiveDevice = React.useMemo(
    () => devices.some((d) => d.status === "ACTIVE"),
    [devices]
  )

  // ── Device-filtered templates ──────────────────────────────────────────

  const {
    templates: deviceTemplates,
    loading: templatesLoading,
    error: templatesError,
    reload: reloadTemplates,
  } = useTemplates({
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

  React.useEffect(() => {
    if (hasSingleActiveDevice && !sendDeviceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSendDeviceId(activeDevices[0].id)
    }
  }, [activeDevices, hasSingleActiveDevice, sendDeviceId])

  const approvedTemplates = React.useMemo(
    () => deviceTemplates.filter((t) => t.metaStatus === "APPROVED"),
    [deviceTemplates]
  )

  React.useEffect(() => {
    if (sendDeviceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedTemplateId("")
      setSelectedTemplateLanguage("")
      setTemplateFieldValues({})
      setTemplateSearchQuery("")
      setTemplatePickerOpen(true)
    }
  }, [sendDeviceId])

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

    if (labelFilterIds.length > 0) {
      result = result.filter((c) => {
        const conversationLabelIds =
          c.conversationLabels?.map(
            (cl: {
              label: { id: string; name: string; color?: string | null }
            }) => cl.label.id
          ) ?? []
        return labelFilterIds.every((fid) => conversationLabelIds.includes(fid))
      })
    }

    return result
  }, [conversations, searchQuery, directionFilter, labelFilterIds])

  // Reverse messages to show oldest first (they come desc from API)
  const orderedMessages = React.useMemo(
    () => (activeConversation?.whatsappMessages ?? []).slice().reverse(),
    [activeConversation?.whatsappMessages]
  )

  // Scroll to bottom on new messages
  React.useEffect(() => {
    if (orderedMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
    }
  }, [orderedMessages])

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
    if (labelFilterIds.length > 0) count++
    return count
  }, [directionFilter, statusFilter, labelFilterIds])

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleSelectConversation = React.useCallback(
    (conversation: ConversationListItem) => {
      setActiveConversationId(conversation.id)
      const next = new URLSearchParams(searchParams.toString())
      const phone = cleanPhoneForQuery(conversation.contactPhone)
      if (phone) next.set(PHONE_QUERY_KEY, phone)
      else next.delete(PHONE_QUERY_KEY)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const handleDeleteConversation = React.useCallback((id: string) => {
    setSelectedConversationId(id)
    setDeleteConfirmOpen(true)
  }, [])

  const handleNotesConversation = React.useCallback(
    (conversation: ConversationListItem) => {
      setSelectedConversationId(conversation.id)
      setNotesText(conversation.internalNotes ?? "")
      setNotesDialogOpen(true)
    },
    []
  )

  const handleLabelsConversation = React.useCallback(
    (conversation: ConversationListItem) => {
      setSelectedConversationId(conversation.id)
      setSelectedLabelIds(
        new Set(conversation.conversationLabels?.map((cl) => cl.label.id) ?? [])
      )
      setLabelPickerOpen(true)
    },
    []
  )

  // ── Mutations ──────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: whatsappClient.messages.sendTemplate,
    onSuccess: async (data, variables) => {
      toast.success("Template message queued for delivery")
      setSendDialogOpen(false)
      setSendDeviceId(hasSingleActiveDevice ? (activeDevices[0]?.id ?? "") : "")
      setSelectedTemplateId("")
      setSelectedTemplateLanguage("")
      setTemplateFieldValues({})
      setTemplateSearchQuery("")
      let sentConversation: ConversationListItem | null = null
      try {
        sentConversation = await loadConversationForPhone(
          variables.phoneNumber,
          conversations
        )
      } catch (lookupError) {
        console.warn(
          "[WhatsAppMessagesPage] Sent template but failed to open conversation",
          { phoneNumber: variables.phoneNumber, error: lookupError }
        )
        toast.warning(
          "Template sent, but the chat could not be opened automatically."
        )
      }
      if (sentConversation?.id) {
        setActiveConversationId(sentConversation.id)
        await queryClient.invalidateQueries({
          queryKey: ["whatsapp", "conversation", sentConversation.id],
        })
      }
      await queryClient.invalidateQueries({
        queryKey: ["whatsapp", "conversations"],
      })
      const next = new URLSearchParams(searchParams.toString())
      next.set(PHONE_QUERY_KEY, cleanPhoneForQuery(variables.phoneNumber))
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to send message")
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => whatsappClient.conversations.delete(id),
    onSuccess: async () => {
      toast.success("Chat deleted")
      if (selectedConversationId === activeConversationId) {
        setActiveConversationId(null)
      }
      await queryClient.invalidateQueries({
        queryKey: ["whatsapp", "conversations"],
      })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete chat")
    },
  })

  const saveNotesMutation = useMutation({
    mutationFn: ({
      id,
      internalNotes,
    }: {
      id: string
      internalNotes: string | null
    }) => whatsappClient.conversations.update(id, { internalNotes }),
    onSuccess: async () => {
      toast.success("Notes saved")
      setNotesDialogOpen(false)
      await queryClient.invalidateQueries({
        queryKey: ["whatsapp", "conversations"],
      })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save notes")
    },
  })

  const updateLabelsMutation = useMutation({
    mutationFn: ({ id, labelIds }: { id: string; labelIds: string[] }) =>
      whatsappClient.conversations.update(id, { labelIds }),
    onSuccess: async () => {
      toast.success("Labels updated")
      setLabelPickerOpen(false)
      await queryClient.invalidateQueries({
        queryKey: ["whatsapp", "conversations"],
      })
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to update labels"
      )
    },
  })

  const handleSaveNotes = React.useCallback(() => {
    if (!selectedConversationId) return
    saveNotesMutation.mutate({
      id: selectedConversationId,
      internalNotes: notesText || null,
    })
  }, [selectedConversationId, notesText, saveNotesMutation])

  const handleConfirmDelete = React.useCallback(() => {
    if (!selectedConversationId) return
    deleteMutation.mutate(selectedConversationId)
    setDeleteConfirmOpen(false)
  }, [selectedConversationId, deleteMutation])

  const handleToggleLabel = React.useCallback((labelId: string) => {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev)
      if (next.has(labelId)) next.delete(labelId)
      else next.add(labelId)
      return next
    })
  }, [])

  const handleSaveLabels = React.useCallback(() => {
    if (!selectedConversationId) return
    updateLabelsMutation.mutate({
      id: selectedConversationId,
      labelIds: Array.from(selectedLabelIds),
    })
  }, [selectedConversationId, selectedLabelIds, updateLabelsMutation])

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

    const selectedTemplate = approvedTemplates.find(
      (t) => t.id === selectedTemplateId
    )
    const selectedLang = selectedTemplate?.languages.find(
      (l) => l.lang === selectedTemplateLanguage
    )
    const placeholderIndexes = getTemplatePlaceholderIndexes(selectedLang?.body)

    for (const index of placeholderIndexes) {
      if (!templateFieldValues[index]?.trim()) {
        toast.error(`Template field {{${index}}} is required`)
        return
      }
    }

    sendMutation.mutate({
      phoneNumber: normalizedPhone,
      templateId: selectedTemplateId,
      templateLanguage: selectedTemplateLanguage,
      fields: placeholderIndexes.map((index) =>
        templateFieldValues[index].trim()
      ),
      deviceId: sendDeviceId,
    })
  }

  // ─── Render ────────────────────────────────────────────────────────────
  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      // Reset template/language/fields on each open
      setSelectedTemplateId("")
      setSelectedTemplateLanguage("")
      setTemplateFieldValues({})
      setTemplateSearchQuery("")
      setTemplatePickerOpen(true)

      // Pre-fill phone from ?phone= query parameter
      const phoneParam = searchParams.get(PHONE_QUERY_KEY)
      const normalized = phoneParam
        ? normalizeIndonesianPhoneNumber(phoneParam)
        : null
      setSendPhone(normalized ?? "")
    } else {
      // Reset all on close; next open re-reads ?phone=
      setSendPhone("")
      setSendDeviceId("")
      setSelectedTemplateId("")
      setSelectedTemplateLanguage("")
      setTemplateFieldValues({})
      setTemplateSearchQuery("")
    }
    setSendDialogOpen(open)
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex shrink-0 items-center gap-2">
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
              Send Message
            </Button>
          </DialogTrigger>
          <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Send Template Message</DialogTitle>
              <DialogDescription>
                Select a device, choose an approved WhatsApp template, fill
                required fields, then send it to a phone number.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
              <div className="grid min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                {/* ── Left Column ───────────────────────────────────── */}
                <div className="space-y-4">
                  {/* Phone Number — top of left column */}
                  <div className="grid gap-2">
                    <Label htmlFor="send-phone">Phone Number *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="send-phone"
                        placeholder="+628123456789"
                        value={sendPhone}
                        onChange={(e) => setSendPhone(e.target.value)}
                        className="flex-1"
                      />
                      {sendPhone && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSendPhone("")}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Device Selection — hidden when single active device */}
                  {hasSingleActiveDevice && sendDeviceId ? (
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">
                        Device
                      </Label>
                      <p className="text-sm font-medium">
                        {activeDevices[0].phoneNumber}
                      </p>
                    </div>
                  ) : activeDevices.length > 1 ? (
                    <div className="mb-4 grid gap-2">
                      <Label htmlFor="send-device">Device *</Label>
                      <Select
                        value={sendDeviceId}
                        onValueChange={setSendDeviceId}
                      >
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
                    <div className="mb-4 grid gap-2">
                      <Label htmlFor="send-device">Device *</Label>
                      <Select
                        value={sendDeviceId}
                        onValueChange={setSendDeviceId}
                      >
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
                        <span className="text-sm text-destructive">
                          {templatesError}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={reloadTemplates}
                        >
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
                          const tpl = approvedTemplates.find(
                            (t) => t.id === selectedTemplateId
                          )
                          if (!tpl) return null
                          return (
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {tpl.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {tpl.slug}
                                </p>
                                <Badge
                                  variant="secondary"
                                  className="mt-1 text-[10px]"
                                >
                                  {tpl.languages.length} lang
                                  {tpl.languages.length !== 1 ? "s" : ""}
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
                          onChange={(e) =>
                            setTemplateSearchQuery(e.target.value)
                          }
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
                                    (l) =>
                                      l.isApproved ||
                                      l.metaStatus === "APPROVED"
                                  )
                                  setSelectedTemplateLanguage(
                                    approvedLang?.lang ??
                                      tpl.languages[0]?.lang ??
                                      ""
                                  )
                                }}
                                className={`flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50 ${
                                  selectedTemplateId === tpl.id
                                    ? "bg-muted"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-sm font-medium">
                                    {tpl.name}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="shrink-0 text-[10px]"
                                  >
                                    {tpl.languages.length} lang
                                    {tpl.languages.length !== 1 ? "s" : ""}
                                  </Badge>
                                </div>
                                <span className="truncate text-xs text-muted-foreground">
                                  {tpl.slug}
                                </span>
                                {tpl.languages[0]?.body && (
                                  <span className="line-clamp-2 text-xs text-muted-foreground">
                                    {tpl.languages[0].body.substring(0, 80)}
                                    {tpl.languages[0].body.length > 80
                                      ? "…"
                                      : ""}
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
                  {selectedTemplateId &&
                    (() => {
                      const tpl = approvedTemplates.find(
                        (t) => t.id === selectedTemplateId
                      )
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
                  {selectedTemplateLanguage &&
                    (() => {
                      const tpl = approvedTemplates.find(
                        (t) => t.id === selectedTemplateId
                      )
                      const lang = tpl?.languages.find(
                        (l) => l.lang === selectedTemplateLanguage
                      )
                      const indexes = getTemplatePlaceholderIndexes(lang?.body)
                      if (indexes.length === 0) return null
                      return (
                        <>
                          {indexes.map((index) => (
                            <div className="grid gap-2" key={index}>
                              <Label htmlFor={`field-${index}`}>
                                Field {`{{${index}}}`}
                              </Label>
                              <Input
                                id={`field-${index}`}
                                placeholder={`Value for {{${index}}}`}
                                value={templateFieldValues[index] ?? ""}
                                onChange={(e) =>
                                  setTemplateFieldValues((prev) => ({
                                    ...prev,
                                    [index]: e.target.value,
                                  }))
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
                      {selectedTemplateId ? (
                        (() => {
                          const tpl = approvedTemplates.find(
                            (t) => t.id === selectedTemplateId
                          )
                          if (!tpl) return null
                          return (
                            <>
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Template
                                </p>
                                <p className="text-sm font-medium">
                                  {tpl.name}
                                </p>
                              </div>
                              {selectedTemplateLanguage && (
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Language
                                  </p>
                                  <p className="text-sm">
                                    {selectedTemplateLanguage}
                                  </p>
                                </div>
                              )}
                              {(() => {
                                const lang = tpl.languages.find(
                                  (l) => l.lang === selectedTemplateLanguage
                                )
                                if (!lang) return null
                                return (
                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      Body
                                    </p>
                                    <div className="mt-1">
                                      <WhatsAppTemplatePreview
                                        language={lang}
                                        values={templateFieldValues}
                                        mode="compact"
                                      />
                                    </div>
                                  </div>
                                )
                              })()}
                            </>
                          )
                        })()
                      ) : (
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
              <Button
                variant="outline"
                onClick={() => setSendDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={
                  sendMutation.isPending ||
                  activeDevices.length === 0 ||
                  !sendDeviceId ||
                  templatesLoading ||
                  !approvedTemplates.find((t) => t.id === selectedTemplateId)
                }
              >
                {sendMutation.isPending
                  ? "Sending..."
                  : "Send Template Message"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)]">
        {/* ── Left Column: Conversations List ─────────────────────────── */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card lg:col-span-1">
          {/* Sticky compact filter header */}
          <div className="sticky top-0 z-10 border-b bg-card/95 p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <div className="relative w-full">
                <MagnifyingGlass className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search phone number..."
                  aria-label="Search conversations by phone number"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full pl-8 text-sm"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                  >
                    <FunnelSimple className="size-4" />
                    {activeFilterCount > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-0.5 h-5 w-5 items-center justify-center p-0 text-[10px]"
                      >
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Direction</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={directionFilter}
                    onValueChange={setDirectionFilter}
                  >
                    <DropdownMenuRadioItem value="all">
                      All Directions
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="INBOX">
                      Inbox
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="OUTBOX">
                      Outbox
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                  >
                    <DropdownMenuRadioItem value="all">
                      All Status
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="SENT">
                      Sent
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="DELIVERED">
                      Delivered
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="READ">
                      Read
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="FAILED">
                      Failed
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  {allLabels.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Labels</DropdownMenuLabel>
                      {allLabels.map((label) => (
                        <DropdownMenuCheckboxItem
                          key={label.id}
                          checked={labelFilterIds.includes(label.id)}
                          onCheckedChange={() => {
                            if (labelFilterIds.includes(label.id)) {
                              setLabelFilterIds((prev) =>
                                prev.filter((id) => id !== label.id)
                              )
                            } else {
                              setLabelFilterIds((prev) => [...prev, label.id])
                            }
                          }}
                        >
                          {label.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {labelFilterIds.length > 0 && (
              <div className="mt-2">
                <FilterPills
                  pills={allLabels
                    .filter((l) => labelFilterIds.includes(l.id))
                    .map((l) => ({ id: l.id, label: l.name, color: l.color }))}
                  onRemove={(id) =>
                    setLabelFilterIds((prev) =>
                      prev.filter((fid) => fid !== id)
                    )
                  }
                />
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
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
                <p className="text-sm text-destructive">
                  {conversationsError?.message ??
                    "Failed to load conversations"}
                </p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() =>
                    queryClient.invalidateQueries({
                      queryKey: ["whatsapp", "conversations"],
                    })
                  }
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
                    {searchQuery ||
                    directionFilter !== "all" ||
                    statusFilter !== "all"
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

            {!conversationsLoading &&
              !conversationsError &&
              filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={activeConversationId === conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  onDelete={handleDeleteConversation}
                  onNotes={handleNotesConversation}
                  onLabels={handleLabelsConversation}
                />
              ))}
          </div>
        </div>

        {/* ── Right Column: Message Thread ────────────────────────────── */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card lg:col-span-2">
          {/* Thread Header */}
          <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
            {activeConversation ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                    <Phone className="size-4 text-primary" weight="fill" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">
                      {formatPhone(activeConversation.contactPhone)}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {activeConversation._count.whatsappMessages} messages
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <h3 className="font-semibold">Select a conversation</h3>
            )}
          </div>

          {/* Messages Area */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-3">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
                <div className="mt-auto flex flex-col justify-end gap-3">
                  {groupMessagesByDate(orderedMessages).map((group) => (
                    <React.Fragment key={group.label}>
                      <MessageDateGroup label={group.label} />
                      {group.messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                      ))}
                    </React.Fragment>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* ── Delete Confirmation Dialog ─────────────────────────────────── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Internal Notes Dialog ─────────────────────────────────────── */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Internal Notes</DialogTitle>
            <DialogDescription>
              Add notes about this conversation. Only visible to your team.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="notes-textarea" className="sr-only">
              Notes
            </Label>
            <textarea
              id="notes-textarea"
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Add notes about this conversation..."
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveNotes}
              disabled={saveNotesMutation.isPending}
            >
              {saveNotesMutation.isPending ? "Saving..." : "Save Notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Label Picker Dialog ────────────────────────────────────────── */}
      <Dialog open={labelPickerOpen} onOpenChange={setLabelPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Labels</DialogTitle>
            <DialogDescription>
              Select labels to organize this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            {allLabels.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No labels available. Create labels from the Labels page.
              </p>
            ) : (
              allLabels.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => handleToggleLabel(label.id)}
                >
                  <span
                    className={`size-4 shrink-0 rounded border ${
                      selectedLabelIds.has(label.id)
                        ? "bg-primary"
                        : "border-muted-foreground/30"
                    }`}
                    style={
                      label.color
                        ? {
                            backgroundColor: selectedLabelIds.has(label.id)
                              ? label.color
                              : "transparent",
                            borderColor: label.color,
                          }
                        : undefined
                    }
                  >
                    {selectedLabelIds.has(label.id) && (
                      <span className="flex size-full items-center justify-center text-primary-foreground">
                        <CheckIcon />
                      </span>
                    )}
                  </span>
                  <span className="truncate">{label.name}</span>
                </button>
              ))
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setLabelPickerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveLabels}
              disabled={updateLabelsMutation.isPending}
            >
              {updateLabelsMutation.isPending ? "Saving..." : "Save Labels"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

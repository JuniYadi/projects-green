"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  usePathname,
  useRouter,
  useSearchParams,
  useParams,
} from "next/navigation"
import {
  ChatCircle,
  PaperPlaneTilt,
  Paperclip,
  ArrowBendDownLeft,
  ArrowBendUpRight,
  MagnifyingGlass,
  Phone,
  FunnelSimple,
  CheckIcon,
  DotsThreeVertical,
  Buildings,
  DeviceMobile,
  Info,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
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
import { FieldSet, FieldLegend } from "@/components/ui/field"
import { useWhatsAppOnboarding } from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"
import { FlightHudWidget } from "@/modules/whatsapp/onboarding/flight-hud-widget"
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
import { cn } from "@/lib/utils"
import { CDNAsset } from "@/components/ui/cdn-asset"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import type { WhatsAppTemplate } from "@/lib/api/whatsapp-client"
import type { DeviceListItem } from "@/modules/whatsapp/devices/devices.schemas"
import {
  useTemplates,
  useTemplate,
} from "@/modules/whatsapp/templates/api/templates.hooks"
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
  renderTemplateBody,
  WhatsAppFormattedText,
  WhatsAppTemplatePreview,
} from "@/modules/whatsapp/templates/ui/template-preview"
import {
  getWhatsAppText,
  WhatsAppText,
} from "@/modules/whatsapp/ui/whatsapp-text"
import { eden } from "@/lib/eden"

// ─── Local Types ─────────────────────────────────────────────────────────────

export type MessageDirection = "INBOX" | "OUTBOX"
export type DeliveryStatus = "SENT" | "DELIVERED" | "READ" | "FAILED"

export type StatusHistory = {
  status: DeliveryStatus
  error: string | null
}

export type ConversationListItem = {
  id: string
  organizationId: string
  contactPhone: string
  contactName?: string | null
  lastMessageAt: string | null
  lastDirection: MessageDirection | null
  status?: "OPEN" | "PENDING" | "RESOLVED"
  stage?: string | null
  assigneeId?: string | null
  whatsappDeviceId: string | null
  whatsappDevice?: {
    id: string
    phoneNumber: string
    whatsappProfile?: Record<string, unknown> | null
  } | null
  createdAt: string
  updatedAt: string
  _count: { whatsappMessages: number }
  conversationLabels?: Array<{
    label: { id: string; name: string; color?: string | null }
  }>
  internalNotes?: string | null
}

export type Message = {
  id: string
  conversationId: string
  direction: MessageDirection
  messageType: string
  body: string | null
  mediaUrl?: string | null
  waMessageId?: string | null
  metadata?: TemplateMessageMetadata | null
  statusHistory?: StatusHistory[]
  createdAt: string
  updatedAt: string
}

export type TemplateLanguageData = {
  headerType?: string | null
  headerText?: string | null
  headerUrl?: string | null
  body?: string | null
  footer?: string | null
  buttons?: unknown
  parameters?: unknown
}

export type TemplateMessageMetadata = {
  templateId?: string
  templateName?: string
  language?: string
  templateLanguage?: string
  fields?: string[]
  variables?: string[]
  templateLanguageData?: TemplateLanguageData | null
  headerType?: string | null
  headerText?: string | null
  headerUrl?: string | null
  body?: string | null
  footer?: string | null
  buttons?: unknown
}

export type ConversationDetail = ConversationListItem & {
  whatsappMessages: Message[]
}

export type OrganizationOption = {
  id: string
  name: string
}

export interface WhatsAppInboxProps {
  organizationId?: string
  whatsappDeviceId?: string
  isAdminMode?: boolean
  basePath?: string
  showOnboardingHud?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatConversationTime = (iso: string | null | undefined) => {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const now = new Date()
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" })
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

const formatMessageTime = (iso: string | null | undefined) => {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

const formatPhone = (phone: string) => {
  if (phone.startsWith("+")) return phone
  return `+${phone}`
}

function formatLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const PHONE_QUERY_KEY = "phone"

const cleanPhoneForQuery = (phone: string) => phone.replace(/\D/g, "")

const normalizedPhoneDigits = (phone: string) => {
  const normalized = normalizeIndonesianPhoneNumber(phone)
  return cleanPhoneForQuery(normalized ?? phone)
}

const findConversationByPhone = (
  conversations: ConversationListItem[],
  phone: string
): ConversationListItem | undefined => {
  const digits = normalizedPhoneDigits(phone)
  if (!digits) return undefined
  return conversations.find(
    (c) => normalizedPhoneDigits(c.contactPhone) === digits
  )
}

type TemplateCategory = NonNullable<WhatsAppTemplate["category"]>

type LanguagePresentation = {
  name: string
  flag: string
}

const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utility",
  AUTHENTICATION: "Auth",
}

const LANGUAGE_PRESENTATIONS: Record<string, LanguagePresentation> = {
  id: { name: "Indonesian", flag: "🇮🇩" },
  id_ID: { name: "Indonesian", flag: "🇮🇩" },
  en: { name: "English", flag: "🇺🇸" },
  en_US: { name: "English (US)", flag: "🇺🇸" },
  en_GB: { name: "English (UK)", flag: "🇬🇧" },
  ms: { name: "Malay", flag: "🇲🇾" },
  zh_CN: { name: "Chinese (Simplified)", flag: "🇨🇳" },
  zh_TW: { name: "Chinese (Traditional)", flag: "🇹🇼" },
  ja: { name: "Japanese", flag: "🇯🇵" },
  ko: { name: "Korean", flag: "🇰🇷" },
  es: { name: "Spanish", flag: "🇪🇸" },
  pt_BR: { name: "Portuguese (Brazil)", flag: "🇧🇷" },
  ar: { name: "Arabic", flag: "🇸🇦" },
  hi: { name: "Hindi", flag: "🇮🇳" },
  fr: { name: "French", flag: "🇫🇷" },
  de: { name: "German", flag: "🇩🇪" },
}

function getTemplateCategoryLabel(category: WhatsAppTemplate["category"]) {
  return category ? TEMPLATE_CATEGORY_LABELS[category] : "Uncategorized"
}

function getLanguagePresentation(code: string): LanguagePresentation {
  if (LANGUAGE_PRESENTATIONS[code]) {
    return LANGUAGE_PRESENTATIONS[code]
  }
  const base = code.split("_")[0]
  if (LANGUAGE_PRESENTATIONS[base]) {
    return LANGUAGE_PRESENTATIONS[base]
  }
  return { name: code, flag: "🌐" }
}

// ─── Conversation List Item ───────────────────────────────────────────────────

function ConversationItem({
  conversation,
  isActive,
  isAdminMode,
  orgName,
  onClick,
  onDelete,
  onNotes,
  onLabels,
}: {
  conversation: ConversationListItem
  isActive: boolean
  isAdminMode?: boolean
  orgName?: string
  onClick: () => void
  onDelete: (id: string) => void
  onNotes: (conversation: ConversationListItem) => void
  onLabels: (conversation: ConversationListItem) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className={`group relative flex w-full cursor-pointer items-start gap-3 border-b p-3 text-left transition-colors hover:bg-muted/50 ${
        isActive ? "bg-muted" : ""
      }`}
    >
      {/* Avatar */}
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Phone className="size-5" weight="fill" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span
            className="truncate text-sm font-medium"
            title={
              conversation.contactName?.trim()
                ? formatPhone(conversation.contactPhone)
                : undefined
            }
          >
            {conversation.contactName?.trim() ||
              formatPhone(conversation.contactPhone)}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatConversationTime(conversation.lastMessageAt)}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {conversation.lastDirection === "INBOX" ? (
            <>
              <ArrowBendDownLeft className="size-3 text-blue-500" />
              <span>Received</span>
            </>
          ) : conversation.lastDirection === "OUTBOX" ? (
            <>
              <ArrowBendUpRight className="size-3 text-emerald-500" />
              <span>Sent</span>
            </>
          ) : (
            <span>No messages</span>
          )}
        </div>
        {/* Device & Org badges for tracking */}
        {(conversation.whatsappDevice ||
          (isAdminMode && (orgName || conversation.organizationId))) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {conversation.whatsappDevice && (
              <span className="inline-flex items-center gap-0.5 rounded-xs bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                <DeviceMobile className="size-3 text-muted-foreground" />
                {conversation.whatsappDevice.phoneNumber}
              </span>
            )}
            {isAdminMode && (
              <span
                className="inline-flex items-center gap-0.5 rounded-xs bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                title={`Org ID: ${conversation.organizationId}`}
              >
                <Buildings className="size-3 text-muted-foreground" />
                {orgName || conversation.organizationId}
              </span>
            )}
          </div>
        )}

        {/* Labels & Note indicator */}
        {(Boolean(conversation.internalNotes) ||
          (conversation.conversationLabels &&
            conversation.conversationLabels.length > 0)) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {Boolean(conversation.internalNotes) && (
              <span
                className="inline-flex items-center rounded-xs bg-amber-500/10 px-1 py-0.5 text-[10px] text-amber-600 dark:text-amber-400"
                title={conversation.internalNotes ?? undefined}
              >
                Note
              </span>
            )}
            {conversation.conversationLabels?.map((cl) => (
              <span
                key={cl.label.id}
                className="inline-flex items-center rounded-xs px-1 py-0.5 text-[10px] font-medium"
                style={
                  cl.label.color
                    ? {
                        backgroundColor: `${cl.label.color}20`,
                        color: cl.label.color,
                        borderColor: `${cl.label.color}40`,
                      }
                    : {
                        backgroundColor: "var(--muted)",
                        color: "var(--muted-foreground)",
                      }
                }
              >
                {cl.label.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action Menu button (visible on hover or when active) */}
      <div
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Conversation actions"
            >
              <DotsThreeVertical className="size-4" weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onNotes(conversation)}>
              Edit Notes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onLabels(conversation)}>
              Manage Labels
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(conversation.id)}
            >
              Delete Conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function getTemplateButtonLabel(button: Record<string, unknown>): string {
  if (typeof button.text === "string" && button.text.trim()) {
    return button.text.trim()
  }
  const ctaUrl = button.cta_url
  if (
    ctaUrl &&
    typeof ctaUrl === "object" &&
    "display_text" in ctaUrl &&
    typeof ctaUrl.display_text === "string" &&
    ctaUrl.display_text.trim()
  ) {
    return ctaUrl.display_text.trim()
  }
  const reply = button.reply
  if (
    reply &&
    typeof reply === "object" &&
    "title" in reply &&
    typeof reply.title === "string" &&
    reply.title.trim()
  ) {
    return reply.title.trim()
  }
  return button.type === "OTP" ? "Copy Code" : String(button.type ?? "Button")
}

function TemplateHeader({ data }: { data: TemplateLanguageData }) {
  const headerType = data.headerType?.toUpperCase()
  const headerText = data.headerText?.trim()
  const headerUrl = data.headerUrl?.trim()

  if (headerText) {
    return (
      <div className="mb-2 text-sm font-bold text-[#111b21] dark:text-[#e9edef]">
        <WhatsAppFormattedText text={headerText} />
      </div>
    )
  }

  if (headerUrl && (headerType === "IMAGE" || !headerType)) {
    return (
      <div className="mb-2 overflow-hidden rounded-lg border border-border/40">
        {/* eslint-disable-next-line @next/next/no-img-element -- template media URLs are dynamic */}
        <img
          src={headerUrl}
          alt="Template header"
          className="max-h-48 w-full object-cover"
        />
      </div>
    )
  }

  if (headerUrl && headerType === "VIDEO") {
    return (
      <div className="mb-2 overflow-hidden rounded-lg border border-border/40">
        <video
          src={headerUrl}
          controls
          className="max-h-48 w-full object-cover"
          aria-label="Template header video"
        />
      </div>
    )
  }

  if (headerUrl && headerType === "DOCUMENT") {
    return (
      <a
        href={headerUrl}
        target="_blank"
        rel="noreferrer"
        className="mb-2 block rounded-lg border border-border/40 bg-black/5 p-2.5 text-xs text-[#00a884] hover:underline dark:bg-white/5"
      >
        {headerUrl.split("/").pop()?.split("?")[0] || "Open document"}
      </a>
    )
  }

  if (headerType && headerType !== "NONE") {
    return (
      <div className="mb-2 rounded-lg border border-border/40 bg-black/5 p-2 text-center text-xs text-[#667781] dark:bg-white/5 dark:text-[#8696a0]">
        {headerType} attachment
      </div>
    )
  }

  return null
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({
  message,
  locale,
  basePath,
}: {
  message: Message
  locale: string
  basePath: string
}) {
  const isInbox = message.direction === "INBOX"
  const journeyHref = `${basePath.replace(/\/$/, "")}/${encodeURIComponent(
    message.waMessageId || ""
  )}`
  const metadata = message.metadata
  const templateData =
    metadata?.templateLanguageData ??
    (metadata &&
    (metadata.headerType ||
      metadata.headerText ||
      metadata.headerUrl ||
      metadata.body ||
      metadata.footer ||
      metadata.buttons)
      ? metadata
      : null)
  const isTemplatePreview = message.messageType === "template" && !!templateData
  const fields = metadata?.fields
  const values = Array.isArray(fields)
    ? Object.fromEntries(fields.map((value, index) => [index + 1, value]))
    : undefined
  const templateBody = templateData?.body
    ? renderTemplateBody(templateData.body, values)
    : message.body
  const templateButtons = Array.isArray(templateData?.buttons)
    ? templateData.buttons.filter(
        (button): button is Record<string, unknown> =>
          !!button && typeof button === "object"
      )
    : []

  return (
    <TooltipProvider>
      <div
        className={`group flex items-end gap-2 ${
          isInbox ? "justify-start" : "justify-end"
        }`}
      >
        <div
          className={`relative max-w-[78%] rounded-2xl px-3.5 py-2 pr-16 pb-4 text-sm shadow-xs ${
            isInbox
              ? "rounded-tl-xs border border-border/40 bg-white text-[#111b21] dark:border-transparent dark:bg-[#202c33] dark:text-[#e9edef]"
              : "rounded-tr-xs bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]"
          }`}
        >
          {isTemplatePreview ? (
            <>
              <TemplateHeader data={templateData} />
              {templateBody ? (
                <div className="leading-relaxed break-words whitespace-pre-wrap">
                  <WhatsAppFormattedText text={templateBody} />
                </div>
              ) : null}
              {templateData.footer ? (
                <div className="mt-1.5 text-[11px] text-[#667781] dark:text-[#8696a0]">
                  {templateData.footer}
                </div>
              ) : null}
              {templateButtons.length > 0 ? (
                <div className="-mx-3.5 mt-2 -mb-2 divide-y divide-border/40 border-t border-border/40">
                  {templateButtons.map((button, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-center px-3 py-2.5 text-center text-xs font-semibold text-[#00a884] transition-colors hover:bg-black/5 dark:text-[#00a884] dark:hover:bg-white/5"
                    >
                      {getTemplateButtonLabel(button)}
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : message.messageType === "reaction" ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="text-2xl leading-none">
                {message.body || "👍"}
              </span>
              <span className="text-[11px] text-muted-foreground italic">
                (Reaksi)
              </span>
            </div>
          ) : message.messageType === "sticker" ? (
            <div className="py-1">
              {message.mediaUrl ? (
                <CDNAsset
                  url={message.mediaUrl}
                  type="sticker"
                  alt="Sticker"
                  imageClassName="size-32 object-contain"
                />
              ) : (
                <span className="italic opacity-60">🎨 (Sticker)</span>
              )}
            </div>
          ) : message.messageType === "audio" ? (
            <div className="py-1">
              {message.mediaUrl ? (
                <CDNAsset
                  url={message.mediaUrl}
                  type="audio"
                  alt="Audio message"
                />
              ) : (
                <span className="italic opacity-60">🎵 (Audio)</span>
              )}
            </div>
          ) : message.messageType === "video" ? (
            <div className="space-y-1.5 py-1">
              {message.mediaUrl ? (
                <CDNAsset
                  url={message.mediaUrl}
                  type="video"
                  alt="Video message"
                />
              ) : (
                <span className="italic opacity-60">🎥 (Video)</span>
              )}
              {message.body ? (
                <p className="leading-relaxed break-words whitespace-pre-wrap">
                  {message.body}
                </p>
              ) : null}
            </div>
          ) : message.messageType === "image" && message.mediaUrl ? (
            <div className="space-y-1.5 py-1">
              <CDNAsset
                url={message.mediaUrl}
                type="image"
                alt="Image"
                imageClassName="max-h-60 max-w-full rounded-md object-contain"
              />
              {message.body ? (
                <p className="leading-relaxed break-words whitespace-pre-wrap">
                  {message.body}
                </p>
              ) : null}
            </div>
          ) : message.messageType === "document" && message.mediaUrl ? (
            <div className="space-y-1.5 py-1">
              <CDNAsset
                url={message.mediaUrl}
                type="document"
                filename={message.body || "document"}
              />
              {message.body ? (
                <p className="text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                  {message.body}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="leading-relaxed break-words whitespace-pre-wrap">
              {message.body || (
                <span className="italic opacity-60">
                  <WhatsAppText id="s133" />
                </span>
              )}
            </p>
          )}
          <div className="absolute right-2 bottom-1.5 flex items-center gap-1 text-[10px] text-[#667781] select-none dark:text-[#8696a0]">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{formatMessageTime(message.createdAt)}</span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="border border-border bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-md [&_svg]:bg-popover [&_svg]:fill-popover"
              >
                {formatLocalDateTime(message.createdAt)}
              </TooltipContent>
            </Tooltip>
            <MessageStatusBadge
              statusHistory={message.statusHistory}
              direction={message.direction}
            />
          </div>

          {message.waMessageId && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 ${
                isInbox ? "-right-7" : "-left-7"
              }`}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={journeyHref}
                    className="flex size-6 items-center justify-center rounded-full bg-muted/80 text-muted-foreground shadow-xs backdrop-blur hover:bg-muted hover:text-foreground"
                    aria-label={getWhatsAppText("s132", locale)}
                  >
                    <Info className="size-3" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="border border-border bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-md [&_svg]:bg-popover [&_svg]:fill-popover"
                >
                  {getWhatsAppText("s132", locale)}
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

// ─── Agent P in-situ components ─────────────────────────────────────────────

export function SmartComposerBar({
  suggestions,
  onSelect,
}: {
  suggestions: string[]
  onSelect: (suggestion: string) => void
}) {
  if (suggestions.length === 0) return null

  return (
    <div className="mb-2 flex flex-wrap gap-2" aria-label="Suggested replies">
      {suggestions.slice(0, 3).map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WhatsAppInbox({
  organizationId: propOrganizationId,
  whatsappDeviceId: propWhatsappDeviceId,
  isAdminMode = false,
  basePath,
  showOnboardingHud = !isAdminMode,
}: WhatsAppInboxProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.console.whatsapp.messages
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const onboarding = useWhatsAppOnboarding()

  const resolvedBasePath =
    basePath ||
    (isAdminMode
      ? `/${locale}/portal/whatsapp/messages`
      : `/${locale}/console/whatsapp/messages`)

  // Admin filter state
  const [selectedOrgIdState, setSelectedOrgIdState] =
    React.useState<string>("all")
  const [selectedDeviceIdFilterState, setSelectedDeviceIdFilterState] =
    React.useState<string>("all")

  const selectedOrgId =
    propOrganizationId !== undefined
      ? propOrganizationId || "all"
      : selectedOrgIdState
  const selectedDeviceIdFilter =
    propWhatsappDeviceId !== undefined
      ? propWhatsappDeviceId || "all"
      : selectedDeviceIdFilterState

  const setSelectedOrgId = (val: string) => {
    setSelectedOrgIdState(val)
  }
  const setSelectedDeviceIdFilter = (val: string) => {
    setSelectedDeviceIdFilterState(val)
  }
  // Admin organizations query
  const { data: adminOrganizations = [], isLoading: adminOrgsLoading } =
    useQuery<OrganizationOption[]>({
      queryKey: ["admin", "organizations", "list-all"],
      queryFn: async () => {
        try {
          const { data } = await eden.api.admin.organizations.get({
            $query: { limit: 100 },
          })
          const body = data as unknown as {
            ok: boolean
            data?: { organizations: OrganizationOption[] }
            organizations?: OrganizationOption[]
          }
          if (body?.ok) {
            return body.data?.organizations ?? body.organizations ?? []
          }
          return []
        } catch {
          return []
        }
      },
      enabled: isAdminMode,
    })

  // Admin / portal devices query
  const { data: adminDevices = [], isLoading: adminDevicesLoading } = useQuery<
    DeviceListItem[]
  >({
    queryKey: [
      "admin",
      "whatsapp",
      "devices",
      { organizationId: selectedOrgId },
    ],
    queryFn: async () => {
      try {
        const query: { take: string; organizationId?: string } = {
          take: "200",
        }
        if (selectedOrgId && selectedOrgId !== "all") {
          query.organizationId = selectedOrgId
        }
        const { data } = await eden.api.admin.devices.get({
          $query: query,
        })
        const body = data as unknown as {
          ok: boolean
          devices: DeviceListItem[]
        }
        if (body?.ok) {
          return body.devices ?? []
        }
        return []
      } catch {
        return []
      }
    },
    enabled: isAdminMode,
  })

  const [searchQuery, setSearchQuery] = React.useState(
    () => searchParams.get(PHONE_QUERY_KEY) || ""
  )
  const [lifecycleFilter, setLifecycleFilter] = React.useState("all")
  const [directionFilter, setDirectionFilter] = React.useState("all")
  const [replyFilter, setReplyFilter] = React.useState<
    "all" | "unreplied" | "replied"
  >("all")
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

  // State - quick reply composer
  const [replyText, setReplyText] = React.useState("")
  const [replyAttachment, setReplyAttachment] = React.useState<File | null>(
    null
  )
  const replyAttachmentInputRef = React.useRef<HTMLInputElement>(null)
  const [aiSuggestions, setAiSuggestions] = React.useState<string[]>([])
  const agentPExecute = React.useMemo(() => {
    const executePost = eden?.api?.console?.ai?.["agent-p"]?.execute?.post
    if (typeof executePost === "function") {
      return executePost as unknown as (payload: {
        toolName: string
        input: unknown
      }) => Promise<{ data?: unknown }>
    }
    return undefined
  }, [])
  const [currentTime, setCurrentTime] = React.useState(() => Date.now())

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

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
  const openedTemplateQueryIdRef = React.useRef<string | null>(null)
  const queryClient = useQueryClient()

  const effectiveOrgId =
    isAdminMode && selectedOrgId !== "all" ? selectedOrgId : propOrganizationId
  const effectiveDeviceId =
    isAdminMode && selectedDeviceIdFilter !== "all"
      ? selectedDeviceIdFilter
      : propWhatsappDeviceId

  const {
    data: conversations = [],
    isLoading: conversationsLoading,
    error: conversationsError,
  } = useQuery({
    queryKey: [
      "whatsapp",
      "conversations",
      {
        status: statusFilter,
        organizationId: effectiveOrgId,
        whatsappDeviceId: effectiveDeviceId,
      },
    ],
    queryFn: () =>
      whatsappClient.conversations.list({
        status: statusFilter !== "all" ? statusFilter : undefined,
        organizationId: effectiveOrgId,
        whatsappDeviceId: effectiveDeviceId,
      }),
    select: (payload) => (payload.ok ? (payload.conversations ?? []) : []),
  })

  // State - active conversation override (null when following URL/default)
  const [selectedConversationIdOverride, setSelectedConversationIdOverride] =
    React.useState<string | null>(null)

  const phoneQuery = searchParams.get(PHONE_QUERY_KEY)
  const phoneDigits = phoneQuery ? cleanPhoneForQuery(phoneQuery) : null
  const matchedPhoneConversation = React.useMemo(() => {
    if (!phoneDigits) return null
    return findConversationByPhone(conversations, phoneDigits)
  }, [conversations, phoneDigits])

  const orgNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const org of adminOrganizations) {
      if (org.id) map.set(org.id, org.name || org.id)
    }
    return map
  }, [adminOrganizations])

  const activeConversationId =
    selectedConversationIdOverride ?? matchedPhoneConversation?.id ?? null
  const setActiveConversationId = React.useCallback(
    (val: string | null | ((prev: string | null) => string | null)) => {
      setSelectedConversationIdOverride((prevOverride) => {
        const current = prevOverride ?? matchedPhoneConversation?.id ?? null
        return typeof val === "function" ? val(current) : val
      })
    },
    [matchedPhoneConversation?.id]
  )

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
  const handleSummarizeConversation = React.useCallback(() => {
    if (!activeConversation) return
    const phone = activeConversation.phoneNumber ?? activeConversation.id
    const prompt = `Tolong rangkum percakapan dengan ${phone}. Jelaskan kebutuhan utama pelanggan, status pesan, dan rekomendasi tindakan berikutnya secara ringkas.`
    window.dispatchEvent(
      new CustomEvent("agent_p_trigger", {
        detail: {
          prompt,
          autoSend: true,
          context: {
            entityType: "whatsapp_conversation",
            entityId: activeConversation.id,
            entityName: phone,
          },
        },
      })
    )
  }, [activeConversation])
  const { data: consoleDevices = [] } = useQuery({
    queryKey: ["whatsapp", "devices"],
    queryFn: async () => {
      const payload = await whatsappClient.devices.list()
      return payload.ok ? payload.devices : []
    },
    enabled: !isAdminMode,
  })

  const devices = isAdminMode ? adminDevices : consoleDevices

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
        organizationId: effectiveOrgId,
        whatsappDeviceId: effectiveDeviceId,
      })
      return payload.ok
        ? findConversationByPhone(payload.conversations ?? [], phone)
        : null
    },
    [effectiveOrgId, effectiveDeviceId]
  )

  // Async fallback: load conversation for phone query if not yet loaded in initial list
  React.useEffect(() => {
    if (!phoneDigits || matchedPhoneConversation) {
      return
    }
    let cancelled = false
    loadConversationForPhone(phoneDigits, conversations)
      .then((found) => {
        if (cancelled || !found) return
        setActiveConversationId((prev) => (prev === found.id ? prev : found.id))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [
    phoneDigits,
    conversations,
    matchedPhoneConversation,
    loadConversationForPhone,
    setActiveConversationId,
  ])
  const templateQueryId = searchParams.get("template")
  const { template: queryTemplate } = useTemplate(templateQueryId ?? "")
  // Sync send template dialog from ?template= query param
  React.useEffect(() => {
    if (
      !templateQueryId ||
      openedTemplateQueryIdRef.current === templateQueryId ||
      !queryTemplate
    ) {
      if (!templateQueryId) {
        openedTemplateQueryIdRef.current = null
      }
      return
    }

    const timer = setTimeout(() => {
      setSendDialogOpen(true)
      if (queryTemplate.whatsappDeviceId) {
        setSendDeviceId(queryTemplate.whatsappDeviceId)
      }
      setSelectedTemplateId(queryTemplate.id)
      if (queryTemplate.languages && queryTemplate.languages.length > 0) {
        setSelectedTemplateLanguage(queryTemplate.languages[0].lang)
      }
      setTemplatePickerOpen(false)
      openedTemplateQueryIdRef.current = templateQueryId
    }, 0)
    return () => clearTimeout(timer)
  }, [templateQueryId, queryTemplate])

  const clearTemplateQuery = React.useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete("template")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      if (!templateQueryId) {
        setSelectedTemplateId("")
        setSelectedTemplateLanguage("")
        setTemplateFieldValues({})
        setTemplateSearchQuery("")
        setTemplatePickerOpen(true)
      }

      const phoneParam = searchParams.get(PHONE_QUERY_KEY)
      const normalized = phoneParam
        ? normalizeIndonesianPhoneNumber(phoneParam)
        : null
      setSendPhone(normalized ?? "")
    } else {
      setSendPhone("")
      setSendDeviceId("")
      setSelectedTemplateId("")
      setSelectedTemplateLanguage("")
      setTemplateFieldValues({})
      setTemplateSearchQuery("")
      if (templateQueryId) clearTemplateQuery()
    }
    setSendDialogOpen(open)
  }

  const hasActiveDevice = React.useMemo(
    () => devices.some((d) => d.status === "ACTIVE"),
    [devices]
  )

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
      const timer = setTimeout(() => {
        setSendDeviceId(activeDevices[0].id)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [activeDevices, hasSingleActiveDevice, sendDeviceId])

  const approvedTemplates = React.useMemo(
    () => deviceTemplates.filter((t) => t.metaStatus === "APPROVED"),
    [deviceTemplates]
  )

  const prevSendDeviceIdRef = React.useRef(sendDeviceId)
  React.useEffect(() => {
    if (
      sendDeviceId &&
      prevSendDeviceIdRef.current !== sendDeviceId &&
      !templateQueryId
    ) {
      prevSendDeviceIdRef.current = sendDeviceId
      const timer = setTimeout(() => {
        setSelectedTemplateId("")
        setSelectedTemplateLanguage("")
        setTemplateFieldValues({})
        setTemplateSearchQuery("")
        setTemplatePickerOpen(true)
      }, 0)
      return () => clearTimeout(timer)
    }
    prevSendDeviceIdRef.current = sendDeviceId
  }, [sendDeviceId, templateQueryId])

  // Filter conversations
  const filteredConversations = React.useMemo(() => {
    let result = conversations

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const qDigits = cleanPhoneForQuery(searchQuery.trim())
      result = result.filter((c) => {
        const phoneMatch = c.contactPhone.toLowerCase().includes(q)
        const nameMatch = c.contactName?.toLowerCase().includes(q) ?? false
        const digitsMatch = qDigits
          ? normalizedPhoneDigits(c.contactPhone).includes(qDigits)
          : false
        const orgMatch = isAdminMode
          ? c.organizationId.toLowerCase().includes(q) ||
            (orgNameMap.get(c.organizationId)?.toLowerCase().includes(q) ??
              false)
          : false
        const deviceMatch =
          c.whatsappDevice?.phoneNumber.toLowerCase().includes(q) ?? false
        return phoneMatch || nameMatch || digitsMatch || orgMatch || deviceMatch
      })
    }
    if (lifecycleFilter !== "all") {
      result = result.filter((c) => (c.status ?? "OPEN") === lifecycleFilter)
    }

    if (directionFilter !== "all") {
      result = result.filter((c) => c.lastDirection === directionFilter)
    }

    if (replyFilter === "unreplied") {
      result = result.filter((c) => c.lastDirection === "INBOX")
    } else if (replyFilter === "replied") {
      result = result.filter((c) => c.lastDirection === "OUTBOX")
    }

    if (labelFilterIds.length > 0) {
      result = result.filter((c) => {
        const conversationLabelIds =
          c.conversationLabels?.map(
            (cl: { label: { id: string } }) => cl.label.id
          ) ?? []
        return labelFilterIds.every((fid) => conversationLabelIds.includes(fid))
      })
    }

    return result
  }, [
    conversations,
    searchQuery,
    lifecycleFilter,
    directionFilter,
    replyFilter,
    labelFilterIds,
    isAdminMode,
    orgNameMap,
  ])

  // Reverse messages to show oldest first
  const orderedMessages = React.useMemo(
    () => (activeConversation?.whatsappMessages ?? []).slice().reverse(),
    [activeConversation?.whatsappMessages]
  )
  const fallbackSuggestions = React.useMemo(() => {
    const latest = orderedMessages.at(-1)?.body?.trim()
    return latest
      ? ["Terima kasih atas informasinya.", "Kami akan segera menindaklanjuti."]
      : ["Terima kasih telah menghubungi kami.", "Ada yang bisa kami bantu?"]
  }, [orderedMessages])

  const replySuggestions =
    aiSuggestions.length > 0 ? aiSuggestions : fallbackSuggestions

  React.useEffect(() => {
    if (!activeConversation || !agentPExecute) return
    let cancelled = false
    agentPExecute({
      toolName: "whatsapp.inbox.suggest_reply",
      input: { conversationId: activeConversation.id },
    })
      .then((response) => {
        if (cancelled) return
        const body = response?.data as
          { success?: boolean; data?: { suggestedReply?: string } } | undefined
        const suggestion = body?.success
          ? body.data?.suggestedReply?.trim()
          : undefined
        if (suggestion) {
          setAiSuggestions([suggestion, ...fallbackSuggestions].slice(0, 3))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [activeConversation, agentPExecute, fallbackSuggestions])

  React.useEffect(() => {
    if (orderedMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
    }
  }, [orderedMessages])

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
    if (lifecycleFilter !== "all") count++
    if (directionFilter !== "all") count++
    if (statusFilter !== "all") count++
    if (replyFilter !== "all") count++
    if (labelFilterIds.length > 0) count += labelFilterIds.length
    return count
  }, [
    lifecycleFilter,
    directionFilter,
    statusFilter,
    replyFilter,
    labelFilterIds,
  ])

  const sessionWindowInfo = React.useMemo(() => {
    if (!activeConversation || orderedMessages.length === 0) {
      return { isOpen: false, lastInboxAt: null, timeRemaining: null }
    }
    const lastInboxMsg = [...orderedMessages]
      .reverse()
      .find((m) => m.direction === "INBOX")
    if (!lastInboxMsg) {
      return { isOpen: false, lastInboxAt: null, timeRemaining: null }
    }
    const lastInboxTime = new Date(lastInboxMsg.createdAt).getTime()
    const elapsed = currentTime - lastInboxTime
    const twentyFourHours = 24 * 60 * 60 * 1000
    if (elapsed < twentyFourHours && elapsed >= 0) {
      const remainingMs = twentyFourHours - elapsed
      const hours = Math.floor(remainingMs / (60 * 60 * 1000))
      const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000))
      return {
        isOpen: true,
        lastInboxAt: lastInboxMsg.createdAt,
        timeRemaining: `${hours}h ${minutes}m`,
      }
    }
    return {
      isOpen: false,
      lastInboxAt: lastInboxMsg.createdAt,
      timeRemaining: null,
    }
  }, [activeConversation, orderedMessages, currentTime])

  const sendReplyMutation = useMutation({
    mutationFn: async (input: {
      phoneNumber: string
      message?: string
      deviceId: string
      attachment?: File
    }) => {
      let mediaUrl: string | undefined
      let type: "text" | "image" | "document" | "audio" | "video" = "text"
      if (input.attachment) {
        const upload = await whatsappClient.media.upload(
          input.attachment,
          input.deviceId
        )
        if (!upload.ok || !upload.media) {
          throw new Error("Failed to upload attachment")
        }
        const mediaId = upload.media.metaMediaId ?? upload.media.id
        if (!mediaId) throw new Error("Uploaded attachment has no media ID")
        mediaUrl = `__media:${mediaId}`
        type = input.attachment.type.startsWith("image/")
          ? "image"
          : input.attachment.type.startsWith("audio/")
            ? "audio"
            : input.attachment.type.startsWith("video/")
              ? "video"
              : "document"
      }
      return whatsappClient.messages.send({
        phoneNumber: input.phoneNumber,
        // Meta's API takes text under `caption` for media messages and
        // under `message` for plain text — never both. The service only
        // reads whichever field matches the resolved type.
        message: input.attachment ? undefined : input.message,
        caption: input.attachment ? input.message : undefined,
        mediaUrl,
        type,
        deviceId: input.deviceId,
      })
    },
    onSuccess: async () => {
      toast.success("Message sent")
      setReplyText("")
      setReplyAttachment(null)
      if (activeConversationId) {
        await queryClient.invalidateQueries({
          queryKey: ["whatsapp", "conversation", activeConversationId],
        })
      }
      await queryClient.invalidateQueries({
        queryKey: ["whatsapp", "conversations"],
      })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to send message")
    },
  })

  const handleSendReply = () => {
    if (!activeConversation || (!replyText.trim() && !replyAttachment)) return
    const deviceId = sendDeviceId || activeDevices[0]?.id
    if (!deviceId) {
      toast.error("No active WhatsApp device available")
      return
    }
    sendReplyMutation.mutate({
      phoneNumber: activeConversation.contactPhone,
      message: replyText.trim() || undefined,
      deviceId,
      attachment: replyAttachment ?? undefined,
    })
  }

  const handleOpenSendTemplateForActiveChat = () => {
    if (!activeConversation) return
    setSendPhone(activeConversation.contactPhone)
    setSendDialogOpen(true)
  }

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
    [pathname, router, searchParams, setActiveConversationId]
  )
  // Navigating here via a ?phone= link (e.g. from a notification or another
  // page) seeds the search box and silently narrows the sidebar to that one
  // number. Give the user an explicit way to see why and back out of it
  // without losing the conversation they're currently viewing.
  const handleClearPhoneFilter = React.useCallback(() => {
    if (activeConversationId) {
      setActiveConversationId(activeConversationId)
    }
    setSearchQuery("")
    const next = new URLSearchParams(searchParams.toString())
    next.delete(PHONE_QUERY_KEY)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [
    activeConversationId,
    pathname,
    router,
    searchParams,
    setActiveConversationId,
    setSearchQuery,
  ])
  const handleDeleteConversation = (id: string) => {
    setSelectedConversationId(id)
    setDeleteConfirmOpen(true)
  }

  const handleNotesConversation = (conversation: ConversationListItem) => {
    setSelectedConversationId(conversation.id)
    setNotesText(conversation.internalNotes ?? "")
    setNotesDialogOpen(true)
  }

  const handleLabelsConversation = (conversation: ConversationListItem) => {
    setSelectedConversationId(conversation.id)
    setSelectedLabelIds(
      new Set(conversation.conversationLabels?.map((cl) => cl.label.id) ?? [])
    )
    setLabelPickerOpen(true)
  }

  // ── Mutations ──────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: whatsappClient.messages.sendTemplate,
    onSuccess: async (data, variables) => {
      toast.success("Template message sent")
      setSendDialogOpen(false)
      setSendDeviceId(hasSingleActiveDevice ? (activeDevices[0]?.id ?? "") : "")
      setSelectedTemplateId("")
      setSelectedTemplateLanguage("")
      setTemplateFieldValues({})
      setTemplateSearchQuery("")
      let sentConversation: ConversationListItem | null | undefined = null
      try {
        sentConversation = await loadConversationForPhone(
          variables.phoneNumber,
          conversations
        )
      } catch (lookupError) {
        console.warn(
          "[WhatsAppInbox] Sent template but failed to open conversation",
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
      next.delete("template")
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

  const handleConfirmDelete = () => {
    if (!selectedConversationId) return
    deleteMutation.mutate(selectedConversationId)
    setDeleteConfirmOpen(false)
  }

  const handleToggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev)
      if (next.has(labelId)) next.delete(labelId)
      else next.add(labelId)
      return next
    })
  }

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

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {isAdminMode ? "Messages" : t.heading}
          </h1>
          <p className="text-muted-foreground">
            {isAdminMode
              ? "View and manage all WhatsApp conversations and message history across the platform."
              : t.description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdminMode && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Organization Filter */}
              <div className="flex items-center gap-1.5">
                <Buildings className="size-4 text-muted-foreground" />
                <Select
                  value={selectedOrgId}
                  onValueChange={(val) => {
                    setSelectedOrgId(val)
                    setSelectedDeviceIdFilter("all")
                    setActiveConversationId(null)
                  }}
                  disabled={adminOrgsLoading}
                >
                  <SelectTrigger
                    className="h-9 w-[180px] text-xs"
                    aria-label="Filter by organization"
                  >
                    <SelectValue placeholder="All Organizations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {adminOrganizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name || org.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* WhatsApp Device Filter */}
              <div className="flex items-center gap-1.5">
                <DeviceMobile className="size-4 text-muted-foreground" />
                <Select
                  value={selectedDeviceIdFilter}
                  onValueChange={(val) => {
                    setSelectedDeviceIdFilter(val)
                    setActiveConversationId(null)
                  }}
                  disabled={adminDevicesLoading}
                >
                  <SelectTrigger
                    className="h-9 w-[180px] text-xs"
                    aria-label="Filter by device"
                  >
                    <SelectValue placeholder="All Devices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Devices</SelectItem>
                    {adminDevices.map((dev) => (
                      <SelectItem key={dev.id} value={dev.id}>
                        {dev.phoneNumber} {dev.name ? `(${dev.name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Dialog open={sendDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button disabled={devices.length > 0 && !hasActiveDevice}>
                <PaperPlaneTilt className="mr-2 size-4" weight="bold" />
                {isAdminMode ? "New Message" : t.sendMessage}
              </Button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
              <DialogHeader className="border-b p-6 pb-3">
                <DialogTitle>
                  <WhatsAppText id="s134" />
                </DialogTitle>
                <DialogDescription>
                  <WhatsAppText id="s135" />
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                <div className="grid min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                  {/* Left Column */}
                  <div className="space-y-4">
                    {/* Phone Number */}
                    <div className="grid gap-2">
                      <Label htmlFor="send-phone">
                        <WhatsAppText id="s136" />
                      </Label>
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
                            <WhatsAppText id="s137" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Device Selection */}
                    {hasSingleActiveDevice && sendDeviceId ? (
                      <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">
                          <WhatsAppText id="s113" />
                        </Label>
                        <p className="text-sm font-medium">
                          {activeDevices[0].phoneNumber}
                        </p>
                      </div>
                    ) : activeDevices.length > 1 ? (
                      <div className="mb-4 grid gap-2">
                        <Label htmlFor="send-device">
                          <WhatsAppText id="s138" />
                        </Label>
                        <Select
                          value={sendDeviceId}
                          onValueChange={setSendDeviceId}
                        >
                          <SelectTrigger id="send-device">
                            <SelectValue
                              placeholder={getWhatsAppText("s139", locale)}
                            />
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
                        <Label htmlFor="send-device">
                          <WhatsAppText id="s138" />
                        </Label>
                        <Select
                          value={sendDeviceId}
                          onValueChange={setSendDeviceId}
                        >
                          <SelectTrigger id="send-device">
                            <SelectValue
                              placeholder={getWhatsAppText("s139", locale)}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none" disabled>
                              <WhatsAppText id="s140" />
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Template Selection */}
                    <div className="grid gap-2">
                      <Label htmlFor="send-template">
                        <WhatsAppText id="s141" />
                      </Label>
                      {!sendDeviceId ? (
                        <div className="flex h-10 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                          <WhatsAppText id="s142" />
                        </div>
                      ) : templatesLoading ? (
                        <div className="flex h-10 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                          <WhatsAppText id="s143" />
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
                            <WhatsAppText id="s101" />
                          </Button>
                        </div>
                      ) : approvedTemplates.length === 0 ? (
                        <div className="flex h-10 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                          <WhatsAppText id="s144" />
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
                                  <div className="flex min-w-0 items-center gap-2">
                                    <p className="truncate text-sm font-medium">
                                      {tpl.name}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 text-[10px]"
                                    >
                                      {getTemplateCategoryLabel(tpl.category)}
                                    </Badge>
                                  </div>
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
                                  <WhatsAppText id="s145" />
                                </Button>
                              </div>
                            )
                          })()}
                        </div>
                      ) : (
                        <>
                          <Input
                            id="send-template"
                            placeholder={getWhatsAppText("s146", locale)}
                            value={templateSearchQuery}
                            onChange={(e) =>
                              setTemplateSearchQuery(e.target.value)
                            }
                          />
                          <div className="max-h-64 overflow-y-auto rounded-md border">
                            {visibleTemplates.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">
                                <WhatsAppText id="s147" />
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
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="truncate text-sm font-medium">
                                        {tpl.name}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="shrink-0 text-[10px]"
                                      >
                                        {getTemplateCategoryLabel(tpl.category)}
                                      </Badge>
                                    </div>
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
                        if (tpl.languages.length === 1) {
                          const singleLang = tpl.languages[0]
                          const presentation = getLanguagePresentation(
                            singleLang.lang
                          )
                          return (
                            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3.5 py-2.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                Language
                              </span>
                              <span className="inline-flex items-center gap-2 text-sm font-medium">
                                <span aria-hidden="true">
                                  {presentation.flag}
                                </span>
                                <span>
                                  {presentation.name} ({singleLang.lang})
                                </span>
                              </span>
                            </div>
                          )
                        }
                        return (
                          <FieldSet className="gap-2">
                            <FieldLegend variant="label">
                              Language *
                            </FieldLegend>
                            <div className="flex flex-col gap-2">
                              {tpl.languages.map((lang, index) => {
                                const presentation = getLanguagePresentation(
                                  lang.lang
                                )
                                const languageId = `send-language-${index}-${lang.lang.replace(
                                  /[^a-zA-Z0-9_-]/g,
                                  "-"
                                )}`
                                const isSelected =
                                  selectedTemplateLanguage === lang.lang

                                return (
                                  <label
                                    key={lang.lang}
                                    htmlFor={languageId}
                                    className={cn(
                                      "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                                      isSelected
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:bg-muted/50"
                                    )}
                                  >
                                    <input
                                      id={languageId}
                                      type="radio"
                                      name="send-language"
                                      value={lang.lang}
                                      checked={isSelected}
                                      onChange={(event) =>
                                        setSelectedTemplateLanguage(
                                          event.target.value
                                        )
                                      }
                                      className="size-4 shrink-0 accent-primary"
                                      aria-label={`${presentation.name} (${lang.lang})`}
                                    />
                                    <span
                                      className="text-xl leading-none"
                                      aria-hidden="true"
                                    >
                                      {presentation.flag}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-sm font-medium">
                                        {presentation.name}
                                      </span>
                                      <span className="block text-xs text-muted-foreground">
                                        {lang.lang}
                                      </span>
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </FieldSet>
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
                        const indexes = getTemplatePlaceholderIndexes(
                          lang?.body
                        )
                        if (indexes.length === 0) return null

                        const params = lang?.parameters as {
                          components?: Array<{
                            type: string
                            example?: { body_text?: string[][] }
                          }>
                        }
                        const bodyComp = params?.components?.find(
                          (c) => c.type === "BODY"
                        )
                        const exampleValues =
                          bodyComp?.example?.body_text?.[0] || []

                        return (
                          <>
                            {indexes.map((index) => {
                              const exampleHint = exampleValues[index - 1]
                              const placeholder = `Value for {{${index}}}`

                              return (
                                <div className="grid gap-2" key={index}>
                                  <div className="flex items-center justify-between">
                                    <Label htmlFor={`field-${index}`}>
                                      Field {`{{${index}}}`}
                                    </Label>
                                    {exampleHint && (
                                      <span className="text-[11px] text-muted-foreground">
                                        Example:{" "}
                                        <span className="font-mono text-foreground/80">
                                          {exampleHint}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                  <Input
                                    id={`field-${index}`}
                                    placeholder={placeholder}
                                    value={templateFieldValues[index] ?? ""}
                                    onChange={(e) =>
                                      setTemplateFieldValues((prev) => ({
                                        ...prev,
                                        [index]: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              )
                            })}
                          </>
                        )
                      })()}
                  </div>

                  {/* Right Column: Preview Panel */}
                  <div className="space-y-4 lg:sticky lg:top-0">
                    <div className="rounded-lg border bg-card">
                      <div className="border-b px-4 py-3">
                        <h4 className="text-sm font-semibold">
                          <WhatsAppText id="s124" />
                        </h4>
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
                                    <WhatsAppText id="s16" />
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">
                                      {tpl.name}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px]"
                                    >
                                      {getTemplateCategoryLabel(tpl.category)}
                                    </Badge>
                                  </div>
                                </div>
                                {selectedTemplateLanguage && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      Language
                                    </p>
                                    <p className="flex items-center gap-2 text-sm">
                                      <span aria-hidden="true">
                                        {
                                          getLanguagePresentation(
                                            selectedTemplateLanguage
                                          ).flag
                                        }
                                      </span>
                                      {
                                        getLanguagePresentation(
                                          selectedTemplateLanguage
                                        ).name
                                      }
                                      <span className="text-xs text-muted-foreground">
                                        ({selectedTemplateLanguage})
                                      </span>
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
                                        <WhatsAppText id="s148" />
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
                            <WhatsAppText id="s149" />
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="border-t p-6 pt-3">
                <Button
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                >
                  <WhatsAppText id="s15" />
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
                  {sendMutation.isPending ? (
                    <WhatsAppText id="s380" locale={locale} />
                  ) : (
                    <WhatsAppText id="s134" locale={locale} />
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)]">
        {/* Left Column: Conversations List */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card lg:col-span-1">
          {/* Sticky compact filter header */}
          <div className="sticky top-0 z-10 border-b bg-card/95 p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <div className="relative w-full">
                <MagnifyingGlass className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={getWhatsAppText("s150", locale)}
                  aria-label={getWhatsAppText("s151", locale)}
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
                  <DropdownMenuLabel>Lifecycle Status</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={lifecycleFilter}
                    onValueChange={setLifecycleFilter}
                  >
                    <DropdownMenuRadioItem value="all">
                      All Lifecycles
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="OPEN">
                      Open
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="PENDING">
                      Pending
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="RESOLVED">
                      Resolved
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Reply State</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={replyFilter}
                    onValueChange={(val) => {
                      if (
                        val === "all" ||
                        val === "unreplied" ||
                        val === "replied"
                      ) {
                        setReplyFilter(val)
                      }
                    }}
                  >
                    <DropdownMenuRadioItem value="all">
                      <WhatsAppText id="s152" />
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="unreplied">
                      Needs Reply (Inbox)
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="replied">
                      Replied (Outbox)
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Direction</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={directionFilter}
                    onValueChange={setDirectionFilter}
                  >
                    <DropdownMenuRadioItem value="all">
                      <WhatsAppText id="s153" />
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="INBOX">
                      Inbox
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="OUTBOX">
                      Outbox
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>
                    <WhatsAppText id="s302" locale={locale} />
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                  >
                    <DropdownMenuRadioItem value="all">
                      <WhatsAppText id="s372" locale={locale} />
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="SENT">
                      <WhatsAppText id="s154" />
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="DELIVERED">
                      Delivered
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="READ">
                      Read
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="FAILED">
                      <WhatsAppText id="s155" />
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
            {searchParams.get(PHONE_QUERY_KEY) ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                <span className="truncate">
                  {getWhatsAppText("s411", locale).replace(
                    "{phone}",
                    formatPhone(searchParams.get(PHONE_QUERY_KEY) ?? "")
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleClearPhoneFilter}
                  className="shrink-0 font-medium underline-offset-2 hover:underline"
                >
                  {getWhatsAppText("s412", locale)}
                </button>
              </div>
            ) : null}
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
                  {conversationsError instanceof Error
                    ? conversationsError.message
                    : "Failed to load conversations"}
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
                  <WhatsAppText id="s101" />
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
                    <WhatsAppText id="s156" />
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
                  isAdminMode={isAdminMode}
                  orgName={orgNameMap.get(conversation.organizationId)}
                  onClick={() => handleSelectConversation(conversation)}
                  onDelete={handleDeleteConversation}
                  onNotes={handleNotesConversation}
                  onLabels={handleLabelsConversation}
                />
              ))}
          </div>
        </div>

        {/* Right Column: Message Thread */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card lg:col-span-2">
          {/* Thread Header */}
          <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
            {activeConversation ? (
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="size-4 text-primary" weight="fill" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      className="text-sm font-semibold"
                      title={
                        activeConversation.contactName?.trim()
                          ? formatPhone(activeConversation.contactPhone)
                          : undefined
                      }
                    >
                      {activeConversation.contactName?.trim() ||
                        formatPhone(activeConversation.contactPhone)}
                    </h3>
                    {activeConversation.whatsappDevice && (
                      <Badge
                        variant="outline"
                        className="h-5 gap-1 text-[10px] font-normal text-muted-foreground"
                      >
                        <DeviceMobile className="size-2.5" />
                        {activeConversation.whatsappDevice.phoneNumber}
                      </Badge>
                    )}
                    {isAdminMode && (
                      <Badge
                        variant="secondary"
                        className="h-5 gap-1 text-[10px] font-normal"
                      >
                        <Buildings className="size-2.5" />
                        {orgNameMap.get(activeConversation.organizationId) ||
                          activeConversation.organizationId}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <h3 className="font-semibold">
                <WhatsAppText id="s157" />
              </h3>
            )}
            {activeConversation && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSummarizeConversation}
              >
                ✨ Rangkum Percakapan
              </Button>
            )}
          </div>

          {/* Messages Area */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#efeae2]/30 dark:bg-[#0b141a]/40">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 pr-2">
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
                    <WhatsAppText id="s158" />
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
                      <WhatsAppText id="s159" />
                    </p>
                  </div>
                )}

              {/* Messages */}
              {!activeLoading && orderedMessages.length > 0 && (
                <div className="mt-auto flex flex-col justify-end gap-3 pb-2">
                  {groupMessagesByDate(orderedMessages).map((group) => (
                    <React.Fragment key={group.label}>
                      <MessageDateGroup label={group.label} />
                      {group.messages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          locale={locale}
                          basePath={resolvedBasePath}
                        />
                      ))}
                    </React.Fragment>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Bottom 24-Hour Context & Composer */}
            {activeConversation && (
              <div className="shrink-0 border-t bg-card p-3">
                {sessionWindowInfo.isOpen ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                        <WhatsAppText id="s160" />
                        {sessionWindowInfo.timeRemaining})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-2 text-[11px]"
                        onClick={handleOpenSendTemplateForActiveChat}
                      >
                        <PaperPlaneTilt className="size-3" />
                        <span>
                          <WhatsAppText id="s161" />
                        </span>
                      </Button>
                    </div>
                    <SmartComposerBar
                      suggestions={replySuggestions}
                      onSelect={setReplyText}
                    />
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleSendReply()
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        ref={replyAttachmentInputRef}
                        type="file"
                        accept="image/*,video/*,audio/*,application/pdf"
                        className="hidden"
                        onChange={(e) =>
                          setReplyAttachment(e.target.files?.[0] ?? null)
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-10 shrink-0"
                        onClick={() => replyAttachmentInputRef.current?.click()}
                        disabled={sendReplyMutation.isPending}
                        aria-label="Attach media"
                        title="Attach media"
                      >
                        <Paperclip className="size-4" />
                      </Button>
                      <Input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={
                          replyAttachment?.name ||
                          getWhatsAppText("s162", locale)
                        }
                        disabled={sendReplyMutation.isPending}
                        className="h-10 flex-1 bg-background text-sm"
                      />
                      {replyAttachment && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          onClick={() => {
                            setReplyAttachment(null)
                            if (replyAttachmentInputRef.current) {
                              replyAttachmentInputRef.current.value = ""
                            }
                          }}
                          disabled={sendReplyMutation.isPending}
                          aria-label="Remove attachment"
                          title="Remove attachment"
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                      <Button
                        type="submit"
                        size="sm"
                        className="h-10 shrink-0 gap-1.5 px-4"
                        disabled={
                          (!replyText.trim() && !replyAttachment) ||
                          sendReplyMutation.isPending
                        }
                      >
                        <PaperPlaneTilt className="size-4" weight="fill" />
                        <span>
                          {sendReplyMutation.isPending ? (
                            <WhatsAppText id="s380" locale={locale} />
                          ) : (
                            "Send"
                          )}
                        </span>
                      </Button>
                    </form>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-between gap-2 rounded-lg border bg-background/60 p-3 sm:flex-row">
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">
                        <WhatsAppText id="s163" />
                      </p>
                      <p className="text-[11px]">
                        <WhatsAppText id="s164" />
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleOpenSendTemplateForActiveChat}
                      className="shrink-0 gap-1.5"
                    >
                      <PaperPlaneTilt className="size-3.5" weight="fill" />
                      <span>
                        <WhatsAppText id="s161" />
                      </span>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <WhatsAppText id="s131" />
            </DialogTitle>
            <DialogDescription>
              <WhatsAppText id="s165" />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              <WhatsAppText id="s15" />
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

      {/* Internal Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Internal Notes</DialogTitle>
            <DialogDescription>
              <WhatsAppText id="s166" />
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="notes-textarea" className="sr-only">
              Notes
            </Label>
            <textarea
              id="notes-textarea"
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={getWhatsAppText("s167", locale)}
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
              <WhatsAppText id="s15" />
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

      {/* Label Picker Dialog */}
      <Dialog open={labelPickerOpen} onOpenChange={setLabelPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <WhatsAppText id="s168" />
            </DialogTitle>
            <DialogDescription>
              <WhatsAppText id="s169" />
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            {allLabels.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                <WhatsAppText id="s170" />
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
              <WhatsAppText id="s15" />
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

      {showOnboardingHud && <FlightHudWidget onboarding={onboarding} />}
    </main>
  )
}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Lightning,
  BookOpen,
  PaperPlane,
  ArrowSquareOut,
  Sparkle,
  ChatCircleDots,
  CreditCard,
  RocketLaunch,
  Key,
  Trash,
} from "@phosphor-icons/react"
import { ChatMarkdown } from "./chat-markdown"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { getLocaleFromPathname } from "@/lib/i18n/pathname"
import type {
  UiDocErrorResponse,
  UiDocSuccessResponse,
  KnowledgeChatMessage,
  KnowledgeCitation,
  KnowledgeChatStreamFrame,
} from "@/modules/docs/docs.types"

// Types
type DocRequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: UiDocSuccessResponse }
  | { status: "error"; message: string; code?: string }

type ChatMessage = KnowledgeChatMessage & {
  id: string
  citations?: KnowledgeCitation[]
  actionCards?: AgentPActionCard[]
  actionCard?: AgentPActionCard
}
type AgentPActionCard = {
  id?: string
  title: string
  description?: string
  actionLabel?: string
  actionType?: string
  payload?: Record<string, unknown>
  ctaLabel?: string
  eventName?: string
  eventDetail?: Record<string, unknown>
  href?: string
}

type ActiveEntityContext = {
  entityType?: string
  entityId?: string
  entityName?: string
}

type RelatedDoc = {
  titleEn: string
  titleId: string
  descriptionEn: string
  descriptionId: string
  slug: string
  icon: typeof BookOpen
}

type RouteContextConfig = {
  titleEn: string
  titleId: string
  descriptionEn: string
  descriptionId: string
  starterPromptsEn: string[]
  starterPromptsId: string[]
  relatedDocs: RelatedDoc[]
}

const DOC_QUERY_KEY = "doc"
const KB_QUERY_KEY = "kb"
const ACTIVE_VALUE = "1"

const DOMAIN_SCOPES = ["whatsapp", "billing", "app", "support"] as const
type DomainScope = (typeof DOMAIN_SCOPES)[number] | "general"

const getDomainScope = (routePath: string): DomainScope => {
  const segments = routePath.toLowerCase().split("/").filter(Boolean)
  const domain = segments.find((segment) =>
    DOMAIN_SCOPES.includes(segment as (typeof DOMAIN_SCOPES)[number])
  )
  return (domain as DomainScope | undefined) ?? "general"
}

const getChatStorageKey = (domainScope: DomainScope) =>
  `pfn_tanya_p_chat:${domainScope}`
const getSessionStorageKey = (domainScope: DomainScope) =>
  `pfn_tanya_p_session_id:${domainScope}`

const getRouteBreadcrumb = (
  routePath: string,
  routeContext: RouteContextConfig,
  _isId: boolean,
  entity?: ActiveEntityContext
) => {
  if (entity?.entityType && entity.entityId) {
    const entityLabel = entity.entityName ?? entity.entityType
    return `📍 Sedang melihat: ${entityLabel} #${entity.entityId}`
  }
  const broadcastId = routePath.match(/\/broadcasts\/([^/]+)/)?.[1]
  if (broadcastId) {
    return `📍 Sedang melihat: Halaman Broadcast #${broadcastId}`
  }
  return `📍 Sedang melihat: ${routeContext.titleId}`
}

const toMessageId = () =>
  `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`

const getErrorMessage = (payload: UiDocErrorResponse | null, isId: boolean) => {
  if (payload?.message) {
    return payload.message
  }
  return isId
    ? "Tidak dapat memuat dokumentasi saat ini."
    : "Unable to load documentation right now."
}

// Contextual mapping for console sections
const getRouteContext = (routePath: string): RouteContextConfig => {
  if (
    routePath.startsWith("/console/whatsapp") ||
    routePath.startsWith("/portal/whatsapp")
  ) {
    return {
      titleEn: "WhatsApp Business API",
      titleId: "WhatsApp Business & API",
      descriptionEn:
        "Cloud API devices, Meta message templates, and live broadcasts",
      descriptionId:
        "Perangkat Cloud API, template pesan Meta, dan pengiriman siaran",
      starterPromptsEn: [
        "Why did Meta change my template category from Utility to Marketing?",
        "How do I create and submit Meta message templates without rejections?",
        "How do I generate and manage WhatsApp API keys?",
      ],
      starterPromptsId: [
        "Kenapa kategori template saya berubah dari Utility jadi Marketing oleh Meta?",
        "Bagaimana cara membuat template agar disetujui Meta sebagai Utility?",
        "Bagaimana cara membuat dan mengelola API key WhatsApp?",
      ],
      relatedDocs: [
        {
          titleEn: "Message Templates & Approval",
          titleId: "Template Pesan & Persetujuan Meta",
          descriptionEn: "Step-by-step guide to submitting templates to Meta",
          descriptionId: "Panduan 3 langkah membuat template resmi ke Meta",
          slug: "whatsapp/templates",
          icon: ChatCircleDots,
        },
        {
          titleEn: "WhatsApp API Keys Management",
          titleId: "Pengelolaan WhatsApp API Key",
          descriptionEn:
            "Generate secret tokens for backend and bot integration",
          descriptionId:
            "Generate token rahasia untuk integrasi backend dan bot",
          slug: "whatsapp/api-keys",
          icon: Key,
        },
        {
          titleEn: "Live Chat & Broadcast Messages",
          titleId: "Pengiriman Pesan & Live Chat",
          descriptionEn: "Direct messaging, customer chat, and mass broadcast",
          descriptionId: "Panduan kirim pesan pelanggan dan siaran massal",
          slug: "whatsapp/messages",
          icon: ChatCircleDots,
        },
        {
          titleEn: "Webhooks & Audit Logs",
          titleId: "Webhook WhatsApp & Jejak Audit",
          descriptionEn:
            "Delivery reports, status callbacks, and security logs",
          descriptionId: "Laporan pengiriman, callback status, dan jejak audit",
          slug: "whatsapp/webhooks-and-audits",
          icon: RocketLaunch,
        },
      ],
    }
  }

  if (
    routePath.startsWith("/console/billing") ||
    routePath.startsWith("/portal/billing")
  ) {
    return {
      titleEn: "Billing & Subscriptions",
      titleId: "Penagihan & Saldo Organisasi",
      descriptionEn:
        "Deposit balances, QRIS top-ups, invoices, and service subscriptions",
      descriptionId:
        "Saldo deposit, top up QRIS, faktur invoice, dan langganan layanan",
      starterPromptsEn: [
        "How do I top up my organization balance via QRIS?",
        "How do automated subscription renewals work?",
        "How do promo vouchers and discounts apply to invoices?",
      ],
      starterPromptsId: [
        "Bagaimana cara isi ulang saldo deposit via QRIS?",
        "Bagaimana sistem perpanjangan langganan otomatis bekerja?",
        "Bagaimana cara menggunakan voucher promo dan diskon?",
      ],
      relatedDocs: [
        {
          titleEn: "Billing & Balance Overview",
          titleId: "Penagihan & Saldo Console",
          descriptionEn: "Deposit balance management and top-up guides",
          descriptionId: "Panduan saldo deposit dan pengisian saldo",
          slug: "billing",
          icon: CreditCard,
        },
        {
          titleEn: "Balance & Quota Alerts",
          titleId: "Peringatan Saldo & Kuota",
          descriptionEn:
            "Configure low-balance email and webhook notifications",
          descriptionId: "Konfigurasi notifikasi saat saldo deposit menipis",
          slug: "billing/alerts",
          icon: Sparkle,
        },
        {
          titleEn: "Vouchers & Promotions",
          titleId: "Voucher Promo & Diskon",
          descriptionEn: "Redeem promotional codes and invoice credits",
          descriptionId: "Klaim kode promosi dan diskon invoice",
          slug: "billing/vouchers",
          icon: BookOpen,
        },
        {
          titleEn: "Transaction & Balance History",
          titleId: "Riwayat Transaksi & Saldo",
          descriptionEn:
            "Audit deposits, deductions, and downloadable PDF invoices",
          descriptionId: "Jejak mutasi saldo deposit dan unduh PDF invoice",
          slug: "billing/transactions",
          icon: CreditCard,
        },
      ],
    }
  }

  if (
    routePath.startsWith("/console/app") ||
    routePath.startsWith("/portal/app")
  ) {
    return {
      titleEn: "Applications & Deployments",
      titleId: "Aplikasi & Deployment",
      descriptionEn:
        "Container deployment, custom domains, and environment secrets",
      descriptionId:
        "Deploy container Docker, custom domain, dan konfigurasi secrets",
      starterPromptsEn: [
        "How do I deploy an application to this cluster?",
        "How do custom domains and automated SSL work?",
        "How do I configure environment variables and secrets?",
      ],
      starterPromptsId: [
        "Bagaimana cara deploy aplikasi baru?",
        "Bagaimana cara setting custom domain dan SSL?",
        "Bagaimana cara mengelola environment variables dan secret?",
      ],
      relatedDocs: [
        {
          titleEn: "Application Deployment Guide",
          titleId: "Panduan Deploy Aplikasi",
          descriptionEn: "Step-by-step container deployment and configuration",
          descriptionId: "Panduan langkah demi langkah deploy container",
          slug: "app/deployment",
          icon: RocketLaunch,
        },
        {
          titleEn: "Custom Domains & SSL",
          titleId: "Custom Domain & SSL",
          descriptionEn:
            "Configure custom domains and automated SSL certificates",
          descriptionId:
            "Konfigurasi custom domain dan sertifikat SSL otomatis",
          slug: "app/domains",
          icon: Key,
        },
      ],
    }
  }

  if (routePath.startsWith("/console/support-tickets")) {
    return {
      titleEn: "Support Tickets",
      titleId: "Tiket Bantuan",
      descriptionEn:
        "Submit inquiries, report incidents, and monitor support responses",
      descriptionId:
        "Kirim pertanyaan, laporkan kendala, dan pantau respons teknis",
      starterPromptsEn: [
        "How do I submit a high-priority support ticket?",
        "What is the typical response SLA for technical tickets?",
        "How can I track the progress of my open tickets?",
      ],
      starterPromptsId: [
        "Bagaimana cara membuat tiket bantuan baru?",
        "Berapa estimasi waktu respons bantuan teknis?",
        "Bagaimana cara memantau status penyelesaian tiket?",
      ],
      relatedDocs: [
        {
          titleEn: "Billing & Invoice Support",
          titleId: "Bantuan Penagihan & Faktur",
          descriptionEn: "Top-up issues, failed invoices, and refund workflows",
          descriptionId: "Kendala top-up saldo, invoice gagal, dan mutasi",
          slug: "billing",
          icon: CreditCard,
        },
        {
          titleEn: "WhatsApp Integration Guides",
          titleId: "Panduan Integrasi WhatsApp",
          descriptionEn: "Troubleshooting Meta templates and webhook issues",
          descriptionId: "Panduan kendala template Meta dan webhook",
          slug: "whatsapp",
          icon: ChatCircleDots,
        },
      ],
    }
  }

  // Default: Console Overview
  return {
    titleEn: "Console Overview",
    titleId: "Ringkasan Konsol",
    descriptionEn:
      "Platform overview, billing balances, and service quickstarts",
    descriptionId:
      "Ringkasan status platform, saldo akun, dan panduan mulai cepat",
    starterPromptsEn: [
      "How do I top up my organization balance?",
      "How do I connect and configure a WhatsApp number?",
      "What services and features are available on PFNApp?",
    ],
    starterPromptsId: [
      "Bagaimana cara isi ulang saldo deposit organisasi?",
      "Bagaimana cara menghubungkan dan setting nomor WhatsApp?",
      "Apa saja fitur dan layanan yang tersedia di PFNApp?",
    ],
    relatedDocs: [
      {
        titleEn: "Top Up Balance & Invoices",
        titleId: "Isi Saldo & Faktur Invoice",
        descriptionEn: "Deposit top-up guide, QRIS payments, and PDF receipts",
        descriptionId:
          "Panduan isi deposit, pembayaran QRIS, dan unduh invoice",
        slug: "billing",
        icon: CreditCard,
      },
      {
        titleEn: "WhatsApp Business Quickstart",
        titleId: "Mulai Cepat WhatsApp Business",
        descriptionEn: "Cloud API dashboard, QR connection, and devices",
        descriptionId: "Dasbor Cloud API, koneksi QR, dan perangkat",
        slug: "whatsapp",
        icon: ChatCircleDots,
      },
      {
        titleEn: "Message Templates Approval",
        titleId: "Persetujuan Template Pesan",
        descriptionEn: "Create and register official templates with Meta",
        descriptionId: "Buat dan daftarkan template resmi ke Meta",
        slug: "whatsapp/templates",
        icon: BookOpen,
      },
      {
        titleEn: "Developer API Reference",
        titleId: "Referensi API & Pengembang",
        descriptionEn: "REST API endpoints, OpenAPI specs, and SDKs",
        descriptionId: "Endpoint REST API, spesifikasi OpenAPI, dan SDK",
        slug: "whatsapp/developer-api",
        icon: RocketLaunch,
      },
    ],
  }
}

export function ThunderAiHelpDrawer() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { locale, pathnameWithoutLocale } = getLocaleFromPathname(pathname)
  const activeLocale = locale === "id" ? "id" : "en"
  const isId = activeLocale === "id"
  const routePath = pathnameWithoutLocale || "/console"
  const domainScope = getDomainScope(routePath)
  const chatStorageKey = getChatStorageKey(domainScope)
  const sessionStorageKey = getSessionStorageKey(domainScope)

  const routeContext = useMemo(() => getRouteContext(routePath), [routePath])
  const [docState, setDocState] = useState<DocRequestState>({ status: "idle" })
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = sessionStorage.getItem(chatStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
      const legacy = sessionStorage.getItem("pfn_tanya_p_chat")
      if (legacy) {
        const parsed = JSON.parse(legacy)
        if (Array.isArray(parsed) && parsed.length > 0) {
          sessionStorage.setItem(chatStorageKey, legacy)
          return parsed
        }
      }
    } catch {
      return []
    }
    return []
  })
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window === "undefined") return ""
    try {
      const saved = sessionStorage.getItem("pfn_tanya_p_session_id")
      if (saved) return saved
      const nextId = `sess_${crypto.randomUUID()}`
      sessionStorage.setItem("pfn_tanya_p_session_id", nextId)
      return nextId
    } catch {
      return `sess_${Date.now()}`
    }
  })
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [activeEntity, setActiveEntity] = useState<ActiveEntityContext>()
  const [openCitations, setOpenCitations] = useState<Record<string, boolean>>(
    {}
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sendChatMessageRef = useRef<(text: string) => Promise<void>>(
    async () => {}
  )
  // URL & open state checking
  const [drawerOpenOverride, setDrawerOpenOverride] = useState<boolean | null>(
    null
  )
  const isDocOpen = searchParams.get(DOC_QUERY_KEY) === ACTIVE_VALUE
  const isKbOpen = searchParams.get(KB_QUERY_KEY) === ACTIVE_VALUE
  const isOpen =
    drawerOpenOverride !== null ? drawerOpenOverride : isDocOpen || isKbOpen
  const activeTab = isDocOpen ? "docs" : "chat"
  // Persist chat on messages update
  useEffect(() => {
    try {
      if (messages.length > 0) {
        const entityKey = activeEntity?.entityId
          ? `${chatStorageKey}:${activeEntity.entityId}`
          : chatStorageKey
        sessionStorage.setItem(entityKey, JSON.stringify(messages))
      }
    } catch {
      // Ignore sessionStorage error
    }
  }, [messages, chatStorageKey, activeEntity?.entityId])
  const clearChatHistory = () => {
    setMessages([])
    try {
      const entityKey = activeEntity?.entityId
        ? `${chatStorageKey}:${activeEntity.entityId}`
        : chatStorageKey
      sessionStorage.removeItem(entityKey)
      sessionStorage.removeItem("pfn_tanya_p_chat")
      const nextSessionId = `sess_${crypto.randomUUID()}`
      sessionStorage.setItem(sessionStorageKey, nextSessionId)
      setSessionId(nextSessionId)
    } catch {
      // Ignore
    }
  }
  // Scroll to bottom on messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Auto-focus input when chat drawer opens
  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [isOpen, activeTab])

  useEffect(() => {
    if (!isOpen || activeTab !== "docs") {
      return
    }

    let isActive = true
    const controller = new AbortController()

    const loadDoc = async () => {
      setDocState({ status: "loading" })

      try {
        const response = await fetch(
          `/api/knowledge/docs?path=${encodeURIComponent(routePath)}`,
          {
            signal: controller.signal,
          }
        )

        const payload = (await response.json().catch(() => null)) as
          UiDocSuccessResponse | UiDocErrorResponse | null

        if (!isActive) {
          return
        }

        if (!response.ok || !payload || payload.ok !== true) {
          setDocState({
            status: "error",
            message: getErrorMessage(
              payload as UiDocErrorResponse | null,
              isId
            ),
            code: (payload as UiDocErrorResponse | null)?.error,
          })
          return
        }

        setDocState({ status: "success", data: payload })
      } catch (error) {
        if (!isActive || controller.signal.aborted) {
          return
        }

        const message =
          error instanceof Error ? error.message : getErrorMessage(null, isId)

        setDocState({
          status: "error",
          message,
        })
      }
    }

    void loadDoc()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [routePath, isOpen, activeTab, isId])

  const openDrawer = (tab: "chat" | "docs" = "chat") => {
    const next = new URLSearchParams(searchParams.toString())
    if (tab === "chat") {
      next.set(KB_QUERY_KEY, ACTIVE_VALUE)
      next.delete(DOC_QUERY_KEY)
    } else {
      next.set(DOC_QUERY_KEY, ACTIVE_VALUE)
      next.delete(KB_QUERY_KEY)
    }
    setDrawerOpenOverride(true)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const closeDrawer = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete(DOC_QUERY_KEY)
    next.delete(KB_QUERY_KEY)
    setDrawerOpenOverride(false)

    const query = next.toString()
    const destination = query ? `${pathname}?${query}` : pathname

    router.replace(destination, { scroll: false })
  }

  const handleTabChange = (tab: "chat" | "docs") => {
    openDrawer(tab)
  }

  const normalizedMessages = useMemo(
    () =>
      messages
        .filter((message) => Boolean(message.content && message.content.trim()))
        .map((message) => ({
          role: message.role,
          content: message.content.trim(),
        })),
    [messages]
  )

  const sendChatMessage = async (text: string) => {
    if (isSending) {
      return
    }
    const trimmedInput = text.trim()
    if (!trimmedInput) {
      return
    }

    setIsSending(true)
    setChatError(null)
    setInput("")

    const userMessage: ChatMessage = {
      id: toMessageId(),
      role: "user",
      content: trimmedInput,
    }
    const assistantMessageId = toMessageId()

    // Prepare assistant message ID & live streaming container
    let liveAnswer = ""
    setMessages((current) => [
      ...current,
      userMessage,
      {
        id: assistantMessageId,
        role: "assistant" as const,
        content: "",
      },
    ])

    try {
      const response = await fetch("/api/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          messages: [
            ...normalizedMessages,
            { role: "user", content: trimmedInput },
          ],
          routePath,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string
          error?: string
          banInfo?: {
            isPermanent?: boolean
            blockedUntil?: string
            reason?: string
          }
        } | null

        if (response.status === 403 && payload?.banInfo) {
          const banMsg = payload.banInfo.isPermanent
            ? isId
              ? "Akses AI Anda telah diblokir permanen karena pelanggaran keamanan berulang."
              : "Your access to AI services has been permanently banned due to security violations."
            : isId
              ? `Akses AI Anda ditangguhkan hingga ${payload.banInfo.blockedUntil ? new Date(payload.banInfo.blockedUntil).toLocaleTimeString() : "sementara"} karena pelanggaran berulang.`
              : `Your access to AI services is suspended until ${payload.banInfo.blockedUntil ? new Date(payload.banInfo.blockedUntil).toLocaleTimeString() : "temporarily"} due to repeated violations.`

          setChatError(payload.message || banMsg)
        } else {
          setChatError(
            payload?.message ??
              (isId
                ? "Tidak dapat mengirim pesan ke asisten AI."
                : "Unable to send message to AI assistant.")
          )
        }

        setMessages((current) =>
          current.filter((message) => message.id !== assistantMessageId)
        )
        return
      }

      const stream = response.body

      if (!stream) {
        setChatError(
          isId
            ? "Tidak ada respons stream dari knowledge chat."
            : "No response body from knowledge chat."
        )
        setMessages((current) =>
          current.filter((message) => message.id !== assistantMessageId)
        )
        return
      }

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let finalAnswer: string | null = null
      let finalCitations: KnowledgeCitation[] = []
      let finalActionCards: AgentPActionCard[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const frame = JSON.parse(line) as KnowledgeChatStreamFrame
            if (frame.type === "delta") {
              liveAnswer += frame.text
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessageId
                    ? { ...message, content: liveAnswer }
                    : message
                )
              )
              continue
            }
            if (frame.type === "done") {
              finalAnswer = frame.answer
              finalCitations = frame.citations
              finalActionCards =
                (
                  frame as typeof frame & {
                    actionCards?: AgentPActionCard[]
                  }
                ).actionCards ?? []
              continue
            }
            if (frame.type === "error") setChatError(frame.message)
          } catch {
            // Ignore partial NDJSON split across chunk boundaries
          }
        }
      }

      // Finalize and commit final message state at the end
      setMessages((current) => {
        const updated = current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content: finalAnswer ?? liveAnswer,
                citations: finalCitations.length
                  ? finalCitations
                  : message.citations,
                actionCards: finalActionCards.length
                  ? finalActionCards
                  : message.actionCards,
              }
            : message
        )
        try {
          const entityKey = activeEntity?.entityId
            ? `${chatStorageKey}:${activeEntity.entityId}`
            : chatStorageKey
          sessionStorage.setItem(entityKey, JSON.stringify(updated))
        } catch {
          // Ignore storage error
        }
        return updated
      })
    } catch {
      setChatError(
        isId
          ? "Terjadi kesalahan jaringan saat menghubungi asisten AI."
          : "Network error while contacting AI assistant."
      )
      setMessages((current) =>
        current.filter((message) => message.id !== assistantMessageId)
      )
    } finally {
      setIsSending(false)
    }
  }
  useEffect(() => {
    sendChatMessageRef.current = sendChatMessage
  })

  useEffect(() => {
    const handleTrigger = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          query?: string
          prompt?: string
          autoSend?: boolean
          contextPayload?: Record<string, unknown>
          context?: ActiveEntityContext
          domain?: string
        }>
      ).detail
      const prompt = (detail?.query ?? detail?.prompt)?.trim()
      const contextPayload = detail?.contextPayload ?? detail?.context

      // If triggered with a new entity context or autoSend, clear previous chat immediately
      if (contextPayload) {
        setActiveEntity(contextPayload as ActiveEntityContext)
        if (detail?.autoSend) {
          setMessages([])
          setChatError(null)
          try {
            const targetId = (contextPayload as ActiveEntityContext).entityId
            const key = targetId
              ? `${chatStorageKey}:${targetId}`
              : chatStorageKey
            sessionStorage.removeItem(key)
          } catch {
            // Ignore
          }
        }
      }

      const nextParams = new URLSearchParams(searchParams?.toString() ?? "")
      nextParams.set(KB_QUERY_KEY, ACTIVE_VALUE)
      nextParams.delete(DOC_QUERY_KEY)
      setDrawerOpenOverride(true)
      router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false })

      if (prompt) {
        if (detail?.autoSend) {
          // Immediate dispatch after state update
          setTimeout(() => void sendChatMessageRef.current(prompt), 100)
        } else {
          setInput(prompt)
        }
      }
    }
    window.addEventListener("agent_p_trigger", handleTrigger)
    window.addEventListener("ask_p_query", handleTrigger)
    return () => {
      window.removeEventListener("agent_p_trigger", handleTrigger)
      window.removeEventListener("ask_p_query", handleTrigger)
    }
  }, [pathname, router, searchParams, chatStorageKey])

  const handleActionCard = (card: AgentPActionCard) => {
    if (card.actionType) {
      window.dispatchEvent(
        new CustomEvent("agent_p_action", {
          detail: { actionType: card.actionType, payload: card.payload },
        })
      )
    } else if (card.eventName) {
      window.dispatchEvent(
        new CustomEvent(card.eventName, { detail: card.eventDetail })
      )
    }
    if (card.href) router.push(card.href)
  }
  const starterPrompts = isId
    ? routeContext.starterPromptsId
    : routeContext.starterPromptsEn

  const pageTitle = isId ? routeContext.titleId : routeContext.titleEn
  const pageDescription = isId
    ? routeContext.descriptionId
    : routeContext.descriptionEn

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void sendChatMessage(input)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => openDrawer("chat")}
        data-tour="ai-helper"
        className="group relative flex h-8 items-center gap-2 rounded-xl border border-amber-500/30 bg-neutral-900/90 px-3 text-xs font-semibold text-zinc-100 shadow-sm shadow-amber-500/10 transition-all duration-200 hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-white hover:shadow-md hover:shadow-amber-500/20 active:scale-95"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 transition-transform group-hover:scale-110">
          <Sparkle
            size={12}
            weight="fill"
            className="animate-pulse fill-amber-400 text-amber-400"
          />
        </span>
        <span>{isId ? "Tanya P" : "Ask P"}</span>
      </Button>

      <Sheet
        open={isOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            openDrawer(activeTab)
            return
          }
          closeDrawer()
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col border-l border-white/[0.08] bg-neutral-950 p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b border-white/[0.06] p-6 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                <Sparkle size={15} weight="fill" className="animate-pulse" />
              </div>
              <SheetTitle className="text-lg font-bold text-white">
                {isId ? "Tanya P" : "Ask P"}
              </SheetTitle>
            </div>
            <SheetDescription className="mt-1 text-xs text-muted-foreground">
              {isId
                ? "Panduan & asisten cerdas untuk "
                : "Smart guidance & assistance for "}
              <span className="font-semibold text-zinc-200">{pageTitle}</span>
              {" • "}
              <span className="font-mono text-zinc-400">{routePath}</span>
            </SheetDescription>
          </SheetHeader>
          <p className="border-b border-border bg-card px-6 py-2 text-xs text-muted-foreground">
            {getRouteBreadcrumb(routePath, routeContext, isId, activeEntity)}
          </p>

          <div className="flex items-center justify-between border-b border-white/[0.06] bg-neutral-900/20 px-6 py-3">
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.05] bg-neutral-900/60 p-1 text-muted-foreground">
              <button
                type="button"
                onClick={() => handleTabChange("chat")}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === "chat"
                    ? "bg-neutral-800 text-white shadow-sm shadow-black/40"
                    : "hover:text-white"
                }`}
              >
                <Sparkle
                  size={14}
                  weight="fill"
                  className={
                    activeTab === "chat"
                      ? "animate-pulse fill-amber-500 text-amber-500"
                      : ""
                  }
                />
                {isId ? "Tanya P" : "Ask P"}
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("docs")}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === "docs"
                    ? "bg-neutral-800 text-white shadow-sm shadow-black/40"
                    : "hover:text-white"
                }`}
              >
                <BookOpen
                  size={14}
                  className={activeTab === "docs" ? "text-primary" : ""}
                />
                {isId ? "Artikel Panduan" : "Page Guides"}
              </button>
            </div>

            {activeTab === "chat" && messages.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChatHistory}
                className="h-7 gap-1 px-2 text-[11px] text-zinc-400 hover:bg-neutral-800 hover:text-red-400"
                title={isId ? "Hapus riwayat percakapan" : "Clear conversation"}
              >
                <Trash size={13} />
                <span>{isId ? "Bersihkan" : "Clear"}</span>
              </Button>
            ) : null}
          </div>

          {/* Content Area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {activeTab === "docs" ? (
              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                {docState.status === "idle" || docState.status === "loading" ? (
                  <div className="space-y-4">
                    <div className="h-6 w-1/3 animate-pulse rounded-md bg-neutral-900" />
                    <div className="h-20 w-full animate-pulse rounded-md bg-neutral-900" />
                    <div className="h-32 w-full animate-pulse rounded-md bg-neutral-900" />
                  </div>
                ) : null}

                {docState.status === "error" &&
                docState.code === "DOC_NOT_FOUND" ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/[0.08] bg-neutral-900/30 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            {pageTitle}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {pageDescription}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTabChange("chat")}
                          className="gap-1.5 text-xs"
                        >
                          <Lightning
                            size={14}
                            className="animate-pulse fill-amber-500 text-amber-500"
                          />
                          {isId ? "Tanya AI" : "Ask AI"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : docState.status === "error" ? (
                  <p className="text-sm text-destructive">{docState.message}</p>
                ) : null}

                {docState.status === "success" ? (
                  <div className="space-y-6">
                    <section className="space-y-2">
                      <h3 className="text-base font-bold tracking-tight text-white">
                        {docState.data.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-zinc-300">
                        {docState.data.purpose}
                      </p>
                    </section>

                    <section className="space-y-3">
                      <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        {isId ? "Cara Menggunakan" : "How To Use"}
                      </h4>
                      <ol className="list-decimal space-y-2 pl-4 text-sm text-zinc-300">
                        {docState.data.howTo.map((item, idx) => (
                          <li key={idx} className="pl-1 leading-relaxed">
                            {item}
                          </li>
                        ))}
                      </ol>
                    </section>

                    {docState.data.notes?.length ? (
                      <section className="space-y-3">
                        <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          {isId ? "Catatan Penting" : "Notes"}
                        </h4>
                        <ul className="list-disc space-y-2 pl-4 text-sm text-zinc-300">
                          {docState.data.notes.map((note, idx) => (
                            <li key={idx} className="pl-1 leading-relaxed">
                              {note}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </div>
                ) : null}

                {/* Related Public Docs Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
                    <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      {isId
                        ? "📖 Panduan Terkait dari Dokumentasi"
                        : "📖 Related Guides from Documentation"}
                    </h4>
                  </div>

                  <div className="grid gap-2">
                    {routeContext.relatedDocs.map((doc, idx) => {
                      const IconComponent = doc.icon
                      const docTitle = isId ? doc.titleId : doc.titleEn
                      const docDesc = isId
                        ? doc.descriptionId
                        : doc.descriptionEn
                      const docUrl = `/${activeLocale}/docs/${doc.slug}`

                      return (
                        <Link
                          key={idx}
                          href={docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-neutral-900/40 p-3 transition-all duration-200 hover:border-amber-500/30 hover:bg-neutral-900/80"
                        >
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-neutral-950 text-amber-500 group-hover:border-amber-500/30">
                            <IconComponent size={15} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-semibold text-white group-hover:text-amber-400">
                                {docTitle}
                              </p>
                              <ArrowSquareOut
                                size={13}
                                className="text-zinc-500 opacity-0 transition-opacity group-hover:text-amber-400 group-hover:opacity-100"
                              />
                            </div>
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                              {docDesc}
                            </p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>

                {/* Bottom Full Docs Link */}
                <div className="border-t border-white/[0.06] pt-4">
                  <Link
                    href={`/${activeLocale}/docs`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-neutral-900/60 px-4 py-2.5 text-xs font-medium text-zinc-300 transition-all hover:border-white/[0.15] hover:bg-neutral-800 hover:text-white"
                  >
                    <BookOpen size={15} className="text-primary" />
                    <span>
                      {isId
                        ? "Buka Seluruh Pusat Dokumentasi (/docs) ↗"
                        : "Browse Full Documentation Portal (/docs) ↗"}
                    </span>
                  </Link>
                </div>
              </div>
            ) : (
              // Chat Interface
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 space-y-4 overflow-y-auto p-6">
                  {messages.length === 0 ? (
                    <div className="space-y-6 py-4">
                      <div className="space-y-2 text-center">
                        <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-md shadow-amber-500/10">
                          <Sparkle
                            size={24}
                            weight="fill"
                            className="animate-pulse"
                          />
                        </div>
                        <h3 className="text-sm font-semibold text-white">
                          {isId
                            ? "Tanya P — Asisten Cerdas PFNApp"
                            : "Ask P — PFNApp Smart Assistant"}
                        </h3>
                        <p className="mx-auto max-w-sm text-xs text-muted-foreground">
                          {isId
                            ? `Tanyakan apa saja ke P seputar panduan, fitur, atau alur sistem untuk ${pageTitle}.`
                            : `Ask P anything about guides, features, or workflows for ${pageTitle}.`}
                        </p>
                      </div>
                      <div className="mx-auto max-w-md space-y-2">
                        <p className="mb-1 text-center text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          {isId ? "Pertanyaan Populer" : "Suggested Questions"}
                        </p>
                        {starterPrompts.map((prompt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => sendChatMessage(prompt)}
                            className="w-full rounded-xl border border-white/[0.06] bg-neutral-900/30 px-4 py-2.5 text-left text-xs text-zinc-300 transition-all duration-200 hover:border-amber-500/20 hover:bg-amber-500/[0.02] hover:text-white"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>

                      {/* Related Quick Links in Chat initial view */}
                      <div className="mx-auto max-w-md border-t border-white/[0.06] pt-4">
                        <p className="mb-2 text-center text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          {isId
                            ? "Panduan Populer Terkait"
                            : "Popular Related Guides"}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {routeContext.relatedDocs
                            .slice(0, 2)
                            .map((doc, idx) => {
                              const docTitle = isId ? doc.titleId : doc.titleEn
                              const docUrl = `/${activeLocale}/docs/${doc.slug}`
                              return (
                                <Link
                                  key={idx}
                                  href={docUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-neutral-900/20 p-2 text-[11px] text-zinc-400 transition-colors hover:border-white/[0.1] hover:text-white"
                                >
                                  <span className="truncate">{docTitle}</span>
                                  <ArrowSquareOut
                                    size={12}
                                    className="ml-1 shrink-0"
                                  />
                                </Link>
                              )
                            })}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={
                          message.role === "user"
                            ? "max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-xs text-white shadow-lg"
                            : "max-w-[95%] space-y-3 rounded-2xl border border-white/[0.06] bg-neutral-900/40 px-4 py-3 text-xs text-zinc-200"
                        }
                      >
                        {message.role === "user" ? (
                          <p className="leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </p>
                        ) : message.content ? (
                          <ChatMarkdown
                            content={message.content}
                            activeLocale={activeLocale}
                          />
                        ) : (
                          <div className="flex items-center gap-2 py-1 text-zinc-400">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                            </span>
                            <span className="text-xs italic">
                              {isId
                                ? "Sedang menganalisis data & menyusun rangkuman..."
                                : "Analyzing data & generating response..."}
                            </span>
                          </div>
                        )}
                        {message.role === "assistant" &&
                        (message.actionCard || message.actionCards?.length) ? (
                          <div className="space-y-2 rounded-xl border border-border bg-card p-3">
                            {(message.actionCard
                              ? [message.actionCard]
                              : (message.actionCards ?? [])
                            ).map((card, index) => (
                              <div
                                key={card.id ?? `${message.id}-action-${index}`}
                                className="space-y-2"
                              >
                                <p className="font-semibold text-foreground">
                                  {card.title}
                                </p>
                                {card.description ? (
                                  <p className="text-muted-foreground">
                                    {card.description}
                                  </p>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleActionCard(card)}
                                  className="bg-green-600 text-white hover:bg-green-700"
                                >
                                  {card.actionLabel ??
                                    card.ctaLabel ??
                                    (isId ? "Lanjutkan" : "Continue")}
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {message.role === "assistant" &&
                        message.citations?.length ? (
                          <div className="flex flex-col gap-1.5 border-t border-white/[0.05] pt-2">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenCitations((prev) => ({
                                  ...prev,
                                  [message.id]: !prev[message.id],
                                }))
                              }
                              className="inline-flex w-fit items-center gap-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <span>
                                {isId
                                  ? `Lihat Sumber & Rujukan (${message.citations.length})`
                                  : `View Sources (${message.citations.length})`}
                              </span>
                              <span className="text-[9px] opacity-70">
                                {openCitations[message.id] ? "▲" : "▼"}
                              </span>
                            </button>
                            {openCitations[message.id] ? (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {message.citations.map((citation) => {
                                  const normalizedPath =
                                    citation.path.startsWith("/")
                                      ? citation.path
                                      : `/${citation.path}`
                                  const citationUrl = normalizedPath.startsWith(
                                    "/docs"
                                  )
                                    ? `/${activeLocale}${normalizedPath}`
                                    : `/${activeLocale}/docs${normalizedPath}`
                                  return (
                                    <Link
                                      key={citation.id}
                                      href={citationUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group inline-flex items-center gap-1 rounded-md border border-white/10 bg-neutral-900 px-2 py-1 text-[10px] font-medium text-amber-300 transition-all hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-200"
                                      title={`Buka ${citation.title} • Path: ${citation.path}`}
                                    >
                                      <span>{citation.title}</span>
                                      <ArrowSquareOut
                                        size={10}
                                        className="opacity-70 group-hover:opacity-100"
                                      />
                                    </Link>
                                  )
                                })}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {chatError ? (
                  <p className="border-y border-destructive/10 bg-destructive/5 px-6 py-2 text-xs text-destructive">
                    {chatError}
                  </p>
                ) : null}

                {/* High-affordance chat form */}
                <div className="border-t border-white/10 bg-neutral-900/90 p-4 shadow-2xl backdrop-blur-md">
                  <form
                    className="flex items-center gap-2 rounded-2xl border border-white/15 bg-neutral-950/80 p-1.5 transition-all duration-200 focus-within:border-amber-500/80 focus-within:ring-2 focus-within:ring-amber-500/20 hover:border-white/25"
                    onSubmit={onSubmit}
                  >
                    <div className="pl-2.5 text-amber-500/70">
                      <Sparkle size={16} weight="fill" />
                    </div>
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder={
                        isId
                          ? "Tanyakan sesuatu ke P seputar halaman ini..."
                          : "Ask P anything about this page or workflows..."
                      }
                      disabled={isSending}
                      className="h-9 flex-1 border-0 bg-transparent px-2 text-xs text-white placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Button
                      type="submit"
                      disabled={isSending || !input.trim()}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-0 transition-all duration-200 ${
                        input.trim()
                          ? "bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/30 hover:bg-amber-400"
                          : "bg-neutral-800 text-zinc-400 hover:bg-neutral-700 hover:text-white"
                      }`}
                    >
                      <PaperPlane size={15} weight="bold" />
                    </Button>
                  </form>
                  <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
                    <span>
                      {isId
                        ? "Tekan Enter untuk mengirim pesan"
                        : "Press Enter to send message"}
                    </span>
                    <span>
                      {isId
                        ? "Asisten Tanya P • Pin Point Docs AI"
                        : "Ask P Assistant • Pin Point Docs AI"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

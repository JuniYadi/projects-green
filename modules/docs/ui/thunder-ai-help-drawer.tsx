"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Lightning, BookOpen, PaperPlane } from "@phosphor-icons/react"

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
}

const DOC_QUERY_KEY = "doc"
const KB_QUERY_KEY = "kb"
const ACTIVE_VALUE = "1"

const toMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`

const getErrorMessage = (payload: UiDocErrorResponse | null) => {
  if (payload?.message) {
    return payload.message
  }
  return "Unable to load documentation right now."
}

export function ThunderAiHelpDrawer() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [docState, setDocState] = useState<DocRequestState>({ status: "idle" })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { pathnameWithoutLocale } = getLocaleFromPathname(pathname)
  const routePath = pathnameWithoutLocale || "/console"

  // URL state checking
  const isDocOpen = searchParams.get(DOC_QUERY_KEY) === ACTIVE_VALUE
  const isKbOpen = searchParams.get(KB_QUERY_KEY) === ACTIVE_VALUE
  const isOpen = isDocOpen || isKbOpen

  const activeTab = isKbOpen ? "chat" : "docs"

  // Scroll to bottom on messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load Page Documentation when "docs" is active and drawer is open
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
          `/api/docs?path=${encodeURIComponent(routePath)}`,
          {
            signal: controller.signal,
          }
        )

        const payload = (await response.json().catch(() => null)) as
          | UiDocSuccessResponse
          | UiDocErrorResponse
          | null

        if (!isActive) {
          return
        }

        if (!response.ok || !payload || payload.ok !== true) {
          setDocState({
            status: "error",
            message: getErrorMessage(payload as UiDocErrorResponse | null),
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
          error instanceof Error
            ? error.message
            : "Unable to load documentation right now."

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
  }, [routePath, isOpen, activeTab])

  const openDrawer = (tab: "chat" | "docs" = "docs") => {
    const next = new URLSearchParams(searchParams.toString())
    if (tab === "chat") {
      next.set(KB_QUERY_KEY, ACTIVE_VALUE)
      next.delete(DOC_QUERY_KEY)
    } else {
      next.set(DOC_QUERY_KEY, ACTIVE_VALUE)
      next.delete(KB_QUERY_KEY)
    }

    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const closeDrawer = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete(DOC_QUERY_KEY)
    next.delete(KB_QUERY_KEY)

    const query = next.toString()
    const destination = query ? `${pathname}?${query}` : pathname

    router.replace(destination, { scroll: false })
  }

  const handleTabChange = (tab: "chat" | "docs") => {
    openDrawer(tab)
  }

  const normalizedMessages = useMemo(
    () =>
      messages.map((message) => ({
        role: message.role,
        content: message.content,
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

    const nextMessages = [
      ...messages,
      userMessage,
      {
        id: assistantMessageId,
        role: "assistant" as const,
        content: "",
      },
    ]

    setMessages(nextMessages)

    try {
      const response = await fetch("/api/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...normalizedMessages, { role: "user", content: trimmedInput }],
          routePath,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null

        setChatError(payload?.message ?? "Unable to send message.")
        setMessages((current) =>
          current.filter((message) => message.id !== assistantMessageId)
        )
        return
      }

      const stream = response.body

      if (!stream) {
        setChatError("No response body from knowledge chat.")
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

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) {
            continue
          }

          const frame = JSON.parse(line) as KnowledgeChatStreamFrame

          if (frame.type === "delta") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: `${message.content}${frame.text}` }
                  : message
              )
            )
            continue
          }

          if (frame.type === "done") {
            finalAnswer = frame.answer
            finalCitations = frame.citations
            continue
          }

          if (frame.type === "error") {
            setChatError(frame.message)
            setMessages((current) =>
              current.filter((message) => message.id !== assistantMessageId)
            )
          }
        }
      }

      if (finalAnswer) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: finalAnswer ?? message.content,
                  citations: finalCitations,
                }
              : message
          )
        )
      }
    } catch {
      setChatError("Network error while contacting knowledge chat.")
      setMessages((current) =>
        current.filter((message) => message.id !== assistantMessageId)
      )
    } finally {
      setIsSending(false)
    }
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendChatMessage(input)
  }

  const starterPrompts = [
    `Tell me about ${routePath === "/console" ? "the Console Overview" : routePath.split("/").pop() || "this page"}`,
    "What are some common tasks I can do here?",
    "How does deployment work in this cluster?",
  ]

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => openDrawer("docs")}
        className="gap-2 transition-all duration-200 border-white/[0.08] hover:border-amber-500/30 hover:bg-neutral-900/60"
      >
        <Lightning size={15} className="text-amber-500 fill-amber-500 animate-pulse" />
        <span>AI Help</span>
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
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0 bg-neutral-950 border-l border-white/[0.08]">
          <SheetHeader className="p-6 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Lightning size={20} className="text-amber-500 fill-amber-500 animate-pulse" />
              <SheetTitle className="text-lg font-bold text-white">Thunder AI Help</SheetTitle>
            </div>
            <SheetDescription className="text-xs text-muted-foreground mt-1">
              Contextual guidance and intelligence for <span className="font-mono text-zinc-300">{routePath}</span>
            </SheetDescription>
          </SheetHeader>

          {/* Mode Switcher */}
          <div className="px-6 py-3 border-b border-white/[0.06] bg-neutral-900/20">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-900/60 p-1 text-muted-foreground border border-white/[0.05]">
              <button
                type="button"
                onClick={() => handleTabChange("chat")}
                className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === "chat"
                    ? "bg-neutral-800 text-white shadow-sm shadow-black/40"
                    : "hover:text-white"
                }`}
              >
                <Lightning size={14} className={activeTab === "chat" ? "text-amber-500 fill-amber-500 animate-pulse" : ""} />
                Thunder AI Chat
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("docs")}
                className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === "docs"
                    ? "bg-neutral-800 text-white shadow-sm shadow-black/40"
                    : "hover:text-white"
                }`}
              >
                <BookOpen size={14} className={activeTab === "docs" ? "text-primary" : ""} />
                Page Guides
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === "docs" ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {docState.status === "idle" || docState.status === "loading" ? (
                  <div className="space-y-4">
                    <div className="h-6 w-1/3 bg-neutral-900 rounded-md animate-pulse" />
                    <div className="h-20 w-full bg-neutral-900 rounded-md animate-pulse" />
                    <div className="h-32 w-full bg-neutral-900 rounded-md animate-pulse" />
                  </div>
                ) : null}

                {docState.status === "error" && docState.code === "DOC_NOT_FOUND" ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-xl border border-dashed border-white/[0.08] bg-neutral-900/10">
                    <BookOpen size={48} className="text-zinc-600 mb-4" />
                    <h3 className="text-sm font-semibold text-white mb-2">No Published Guide</h3>
                    <p className="text-xs text-muted-foreground max-w-xs mb-6">
                      There is no official documentation guide published for this page path yet.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => handleTabChange("chat")}
                      className="gap-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs"
                    >
                      <Lightning size={14} className="text-amber-500 fill-amber-500 animate-pulse" />
                      Ask Thunder AI instead
                    </Button>
                  </div>
                ) : docState.status === "error" ? (
                  <p className="text-sm text-destructive">{docState.message}</p>
                ) : null}

                {docState.status === "success" ? (
                  <div className="space-y-6">
                    <section className="space-y-2">
                      <h3 className="text-base font-bold text-white tracking-tight">{docState.data.title}</h3>
                      <p className="text-sm text-zinc-300 leading-relaxed">
                        {docState.data.purpose}
                      </p>
                    </section>

                    <section className="space-y-3">
                      <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        How To Use
                      </h4>
                      <ol className="list-decimal space-y-2 pl-4 text-sm text-zinc-300">
                        {docState.data.howTo.map((item, idx) => (
                          <li key={idx} className="pl-1 leading-relaxed">{item}</li>
                        ))}
                      </ol>
                    </section>

                    {docState.data.notes?.length ? (
                      <section className="space-y-3">
                        <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          Notes
                        </h4>
                        <ul className="list-disc space-y-2 pl-4 text-sm text-zinc-300">
                          {docState.data.notes.map((note, idx) => (
                            <li key={idx} className="pl-1 leading-relaxed">{note}</li>
                          ))}
                        </ul>
                      </section>
                    ) : null}

                    <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Documentation Registry</span>
                      <span>Updated: {docState.data.updatedAt}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              // Chat Interface
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.length === 0 ? (
                    <div className="space-y-6 py-6">
                      <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-900 border border-white/[0.06] mb-2">
                          <Lightning size={24} className="text-amber-500 fill-amber-500 animate-pulse" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">Thunder AI Assistant</h3>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                          Ask questions about console pages, deployment guidelines, or internal workflows.
                        </p>
                      </div>

                      <div className="space-y-2 max-w-md mx-auto">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center mb-1">
                          Suggested Questions
                        </p>
                        {starterPrompts.map((prompt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => sendChatMessage(prompt)}
                            className="w-full text-left px-4 py-2.5 rounded-xl border border-white/[0.06] bg-neutral-900/30 text-xs text-zinc-300 hover:border-amber-500/20 hover:bg-amber-500/[0.02] hover:text-white transition-all duration-200"
                          >
                            {prompt}
                          </button>
                        ))}
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
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {message.content || "Thinking..."}
                        </p>

                        {message.role === "assistant" && message.citations?.length ? (
                          <div className="flex flex-col gap-1.5 border-t border-white/[0.05] pt-2">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Citations</span>
                            <div className="flex flex-wrap gap-1.5">
                              {message.citations.map((citation) => (
                                <span
                                  key={citation.id}
                                  className="inline-flex rounded-md border border-white/[0.05] bg-neutral-900/80 px-2 py-0.5 text-[10px] text-zinc-400 font-medium"
                                  title={`Path: ${citation.path} • Updated: ${citation.updatedAt}`}
                                >
                                  {citation.title}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {chatError ? (
                  <p className="text-xs text-destructive px-6 py-2 bg-destructive/5 border-y border-destructive/10">{chatError}</p>
                ) : null}

                {/* Form input */}
                <form className="p-4 border-t border-white/[0.06] flex items-center gap-2 bg-neutral-900/20" onSubmit={onSubmit}>
                  <Input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask about this page or system workflows..."
                    disabled={isSending}
                    className="flex-1 bg-neutral-950 border-white/[0.08] text-xs h-9 rounded-xl placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-amber-500/50"
                  />
                  <Button
                    type="submit"
                    disabled={isSending || !input.trim()}
                    className="h-9 w-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-black flex items-center justify-center p-0 shrink-0 disabled:bg-neutral-800 disabled:text-zinc-600 transition-colors"
                  >
                    <PaperPlane size={15} weight="bold" />
                  </Button>
                </form>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

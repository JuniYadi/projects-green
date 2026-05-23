"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

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
  KnowledgeChatMessage,
  KnowledgeCitation,
  KnowledgeChatStreamFrame,
} from "@/modules/docs/docs.types"

type ChatMessage = KnowledgeChatMessage & {
  id: string
  citations?: KnowledgeCitation[]
}

const KB_QUERY_KEY = "kb"
const KB_QUERY_VALUE = "1"

const toMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`

export function DashboardKnowledgeChatSheet() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { pathnameWithoutLocale } = getLocaleFromPathname(pathname)
  const routePath = pathnameWithoutLocale || "/console"
  const isOpen = searchParams.get(KB_QUERY_KEY) === KB_QUERY_VALUE

  const normalizedMessages = useMemo(
    () =>
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    [messages]
  )

  const openSheet = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.set(KB_QUERY_KEY, KB_QUERY_VALUE)

    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const closeSheet = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete(KB_QUERY_KEY)

    const query = next.toString()
    const destination = query ? `${pathname}?${query}` : pathname

    router.replace(destination, { scroll: false })
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSending) {
      return
    }

    const trimmedInput = input.trim()

    if (!trimmedInput) {
      return
    }

    setIsSending(true)
    setErrorMessage(null)
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

        setErrorMessage(payload?.message ?? "Unable to send message.")
        setMessages((current) =>
          current.filter((message) => message.id !== assistantMessageId)
        )
        return
      }

      const stream = response.body

      if (!stream) {
        setErrorMessage("No response body from knowledge chat.")
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
            setErrorMessage(frame.message)
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
      setErrorMessage("Network error while contacting knowledge chat.")
      setMessages((current) =>
        current.filter((message) => message.id !== assistantMessageId)
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          openSheet()
          return
        }

        closeSheet()
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Knowledge Chat</SheetTitle>
          <SheetDescription>
            Ask questions from the internal knowledgebase.
          </SheetDescription>
        </SheetHeader>

        <div className="flex h-full flex-col gap-4 px-4 pb-4">
          <p className="text-xs text-muted-foreground">
            Using current page context: <span className="font-mono">{routePath}</span>
          </p>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-md border p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ask about this console page, workflows, or documented procedures.
              </p>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[85%] rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "max-w-[95%] space-y-2 rounded-md border bg-background px-3 py-2 text-sm"
                }
              >
                <p className="whitespace-pre-wrap">{message.content || "..."}</p>

                {message.role === "assistant" && message.citations?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {message.citations.map((citation) => (
                      <span
                        key={citation.id}
                        className="rounded-full border px-2 py-1 text-xs text-muted-foreground"
                      >
                        {citation.title} • {citation.path} • {citation.updatedAt}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}

          <form className="flex items-center gap-2" onSubmit={onSubmit}>
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask from knowledgebase..."
              disabled={isSending}
            />
            <Button type="submit" disabled={isSending}>
              {isSending ? "Sending..." : "Send"}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}

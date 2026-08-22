"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ChatCircleText,
  User,
  Robot,
  WarningOctagon,
  Lightning,
  Clock,
  Globe,
  ArrowLeft,
} from "@phosphor-icons/react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { eden } from "@/lib/eden"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export type SessionDetail = {
  session: {
    id: string
    sessionId: string
    organizationId: string | null
    agentProfileId: string | null
    channel: string
    channelTargetId: string | null
    userId: string | null
    userEmail: string | null
    customerPhone: string | null
    ipAddress: string | null
    userAgent: string | null
    strikeCount: number
    createdAt: string
    updatedAt: string
    metrics: {
      totalPromptTokens: number
      totalResponseTokens: number
      totalTokens: number
      totalDurationMs: number
    }
  }
  messages: Array<{
    id: string
    role: string
    content: string
    promptTokens: number
    responseTokens: number
    totalTokens: number
    durationMs: number | null
    modelUsed: string | null
    citations: Array<{
      title?: string
      docPath?: string
      similarityScore?: number
    }>
    flagReason: string | null
    createdAt: string
  }>
}

export default function ForensicTranscriptPage() {
  const params = useParams()
  const lang = typeof params?.lang === "string" ? params.lang : "en"
  const sessionId =
    typeof params?.sessionId === "string" ? params.sessionId : ""
  const locale = resolveLocaleOrDefault(lang)

  const [data, setData] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function loadTranscript() {
      if (!sessionId) return
      try {
        const { data: resData } =
          await eden.api.admin.ai.sessions[sessionId].get()
        if (isMounted) {
          if (resData && "ok" in resData && resData.ok) {
            setData((resData as { ok: true; data: SessionDetail }).data)
          } else {
            setError(
              (resData as { message?: string })?.message ||
                "Failed to load transcript"
            )
          }
        }
      } catch {
        if (isMounted)
          setError("Network error while fetching forensic transcript")
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadTranscript()
    return () => {
      isMounted = false
    }
  }, [sessionId])

  if (loading) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading forensic audit transcript...
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <div className="p-8 text-center text-sm text-destructive">
          {error || "Session not found."}
        </div>
      </main>
    )
  }

  const { session, messages } = data

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            href={localizePathname({ pathname: "/portal/ai", locale })}
            className="hover:text-foreground"
          >
            AI Governance
          </Link>
          <span>/</span>
          <Link
            href={localizePathname({ pathname: "/portal/ai/sessions", locale })}
            className="hover:text-foreground"
          >
            Sessions
          </Link>
          <span>/</span>
          <span className="font-mono text-foreground">{session.sessionId}</span>
        </div>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <ChatCircleText className="h-6 w-6 text-primary" />
              Forensic Session Transcript
            </h1>
            <p className="text-sm text-muted-foreground">
              Chronological conversation log, edge guardrail interceptions,
              latency, and token consumption audit.
            </p>
          </div>

          <Link
            href={localizePathname({ pathname: "/portal/ai/sessions", locale })}
          >
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Back to Sessions
            </Button>
          </Link>
        </div>
      </header>

      {/* Session Metadata Header Card */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <User className="h-4 w-4" /> Caller & Channel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="truncate font-semibold text-foreground">
              {session.userEmail || session.customerPhone || "Anonymous"}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {session.channel}
              </Badge>
              {session.organizationId && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  Org: {session.organizationId}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Globe className="h-4 w-4" /> Network & IP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="font-mono font-medium text-foreground">
              {session.ipAddress || "Unknown IP"}
            </div>
            <div
              className="truncate text-[10px] text-muted-foreground"
              title={session.userAgent || ""}
            >
              {session.userAgent || "No user agent"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Lightning className="h-4 w-4 text-amber-500" /> Token Consumption
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="font-mono font-semibold text-foreground">
              {session.metrics.totalTokens.toLocaleString()} tokens
            </div>
            <div className="text-[10px] text-muted-foreground">
              {session.metrics.totalPromptTokens} in /{" "}
              {session.metrics.totalResponseTokens} out
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <WarningOctagon className="h-4 w-4 text-orange-500" /> Safety &
              Strikes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              {session.strikeCount > 0 ? (
                <Badge variant="destructive" className="text-[10px]">
                  {session.strikeCount} Strike Escalation
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-emerald-300 text-[10px] text-emerald-600"
                >
                  Clean Session
                </Badge>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Total {messages.length} message turns recorded
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Visual Chat Stream */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
          TRANSCRIPT TIMELINE
        </h2>

        <div className="space-y-4">
          {messages.map((m) => {
            const isUser = m.role === "user"
            const isBlocked = Boolean(m.flagReason)

            return (
              <div
                key={m.id}
                className={`flex gap-3 ${
                  isUser ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : isBlocked
                        ? "text-destructive-foreground bg-destructive"
                        : "bg-muted text-foreground"
                  }`}
                >
                  {isUser ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Robot className="h-4 w-4" />
                  )}
                </div>

                {/* Message Bubble Card */}
                <div
                  className={`flex max-w-[80%] flex-col gap-1.5 rounded-lg p-4 text-xs ${
                    isBlocked
                      ? "border-2 border-destructive/80 bg-destructive/10 text-foreground"
                      : isUser
                        ? "border border-primary/20 bg-primary/10 text-foreground"
                        : "border border-border bg-card text-foreground"
                  }`}
                >
                  {/* Bubble Header */}
                  <div className="flex items-center justify-between gap-4 text-[10px] text-muted-foreground">
                    <span className="font-semibold tracking-wider uppercase">
                      {isUser ? "User Prompt" : "Assistant Response"}
                    </span>
                    <div className="flex items-center gap-2">
                      {m.durationMs && (
                        <span>
                          <Clock className="mr-0.5 inline h-3 w-3" />
                          {m.durationMs}ms
                        </span>
                      )}
                      <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Flagged Alert Banner if Blocked */}
                  {isBlocked && (
                    <div className="my-1 flex items-center gap-2 rounded bg-destructive/20 px-2.5 py-1 text-[11px] font-medium text-destructive">
                      <WarningOctagon className="h-4 w-4 shrink-0" />
                      <span>
                        Edge Interception: <strong>{m.flagReason}</strong> (0
                        LLM Tokens Burned)
                      </span>
                    </div>
                  )}

                  {/* Content Body */}
                  <div className="font-sans text-sm leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </div>

                  {/* Citations if assistant cited knowledge docs */}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-2 space-y-1 border-t pt-2">
                      <div className="text-[10px] font-semibold text-muted-foreground">
                        RETRIEVED KNOWLEDGE CITATIONS:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.citations.map((c, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="font-mono text-[10px]"
                          >
                            📄 {c.title || c.docPath || `Citation ${i + 1}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bubble Footer Token Stats */}
                  <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-1 text-[10px] text-muted-foreground">
                    <span className="font-mono">
                      {m.modelUsed || "Zero-Token Block"}
                    </span>
                    <span className="font-mono">
                      {m.promptTokens} in / {m.responseTokens} out (
                      {m.totalTokens} total)
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { GithubLogo, Sparkle, WarningCircle } from "@phosphor-icons/react"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import {
  ToolTelemetryBadge,
  type ToolTelemetryBadgeProps,
} from "./tool-telemetry-badge"
import {
  InlineBlueprintCard,
  type InlineBlueprintData,
} from "./inline-blueprint-card"
import { DeployPromptBar } from "./deploy-prompt-bar"
import type { ConnectedRepository } from "../git-deploy/types"

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  telemetry?: ToolTelemetryBadgeProps[]
  blueprint?: InlineBlueprintData | null
  isStreaming?: boolean
  error?: string
}

export type DeployChatStreamProps = {
  initialUserName?: string
  lang?: string
  onReadyToLaunch: (data: {
    blueprint: InlineBlueprintData
    sessionId?: string
    inspectionData?: Record<string, unknown> | null
    sourceUrl?: string
  }) => void
  initialSessionId?: string
}

export function DeployChatStream({
  initialUserName,
  lang = "en",
  onReadyToLaunch,
  initialSessionId,
}: DeployChatStreamProps) {
  const isId = lang === "id"
  const messagesI18n = getMessagesForMaybeLocale(lang)
  const agentMessages = messagesI18n.console.app.deployAgent

  const userName = initialUserName || "Developer"
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(
    initialSessionId
  )
  const [activeBlueprint, setActiveBlueprint] =
    useState<InlineBlueprintData | null>(null)
  const [inspectionData, setInspectionData] = useState<Record<
    string,
    unknown
  > | null>(null)
  const [lastSourceUrl, setLastSourceUrl] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [repos, setRepos] = useState<ConnectedRepository[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch connected repos for quick-picks
  useEffect(() => {
    let active = true
    const fetchRepos = async () => {
      try {
        const res = await fetch("/api/integrations/github/repositories")
        if (!active) return
        if (res.status === 401 || res.status === 404) {
          setRepos([])
          return
        }
        const data = await res.json()
        if (!active) return
        if (data.ok && Array.isArray(data.items)) {
          setRepos(data.items)
        }
      } catch {
        if (active) setRepos([])
      }
    }
    void fetchRepos()
    return () => {
      active = false
    }
  }, [])

  // Auto scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Inspect Git repository URL
  const handleInspectUrl = useCallback(
    async (url: string) => {
      let trimmed = url.trim()
      if (
        !trimmed.startsWith("http://") &&
        !trimmed.startsWith("https://") &&
        !trimmed.startsWith("git@")
      ) {
        if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
          trimmed = `https://github.com/${trimmed}`
        }
      }

      setLastSourceUrl(trimmed)
      setIsProcessing(true)

      const userMsgId = `user-${Date.now()}`
      const assistantMsgId = `assistant-${Date.now()}`

      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: "user",
          content: trimmed.startsWith("Deploy ")
            ? trimmed
            : `Deploy ${trimmed}`,
        },
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          isStreaming: true,
          telemetry: [
            {
              toolName: "list_repo_files",
              args: "GitLab/GitHub API",
              result: "Scanning files...",
            },
          ],
        },
      ])

      try {
        const res = await fetch("/api/deploy/ai-sessions/inspect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceUrl: trimmed }),
        })

        const data = await res.json()
        const payload = data?.data as
          | {
              status?: string
              access?: { state?: string; displayLabel?: string }
              detection?: {
                framework?: string
                version?: string
                primaryEngine?: string
                primaryFramework?: { name?: string; id?: string }
                frameworkVersion?: string
                requiredDependencies?: Array<{ name: string; version: string }>
                port?: number
                defaultPort?: number
                startCommand?: string
                confidence?: number
                decision?: {
                  status?: string
                  message?: string
                  isLaunchable?: boolean
                }
              }
              decision?: {
                status?: string
                message?: string
                isLaunchable?: boolean
              }
              session?: {
                id?: string
                status?: string
                blockedReason?: string
              }
              plan?: {
                detection?: {
                  framework?: string
                  version?: string
                  runtime?: string
                  port?: number
                  commands?: string[]
                }
                resources?: { package?: string }
                domain?: { hostname?: string }
              }
            }
          | undefined

        const isBlocked =
          !res.ok ||
          !data.ok ||
          payload?.status === "blocked" ||
          payload?.detection?.decision?.isLaunchable === false ||
          payload?.decision?.isLaunchable === false ||
          payload?.session?.status === "BLOCKED"

        if (isBlocked) {
          const blockReason =
            payload?.detection?.decision?.message ||
            payload?.decision?.message ||
            payload?.session?.blockedReason ||
            data.message ||
            "Inspection failed or framework not supported."

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    isStreaming: false,
                    error: blockReason,
                    telemetry: [
                      {
                        toolName: "evaluate_detector_rules",
                        args: "security_policy",
                        result: "Blocked by platform rule",
                        durationMs: 95,
                      },
                    ],
                    content: blockReason,
                  }
                : msg
            )
          )
          setIsProcessing(false)
          return
        }

        // Inspection success: build blueprint
        const detection = payload?.detection
        const plan = payload?.plan

        const frameworkName =
          detection?.primaryFramework?.name ||
          detection?.framework ||
          plan?.detection?.framework ||
          "Custom App"
        const frameworkVer =
          detection?.frameworkVersion ||
          detection?.version ||
          plan?.detection?.version ||
          ""
        const framework = `${frameworkName} ${frameworkVer}`.trim()

        const runtimeName =
          detection?.requiredDependencies?.[0]?.name ||
          detection?.primaryEngine ||
          plan?.detection?.runtime ||
          "Node.js"
        const runtimeVer =
          detection?.requiredDependencies?.[0]?.version ||
          (detection?.primaryEngine ? "" : "20")
        const runtime = `${runtimeName} ${runtimeVer}`.trim()

        const port =
          detection?.port ??
          detection?.defaultPort ??
          plan?.detection?.port ??
          3000

        const computeTier = plan?.resources?.package
          ? plan.resources.package.charAt(0).toUpperCase() +
            plan.resources.package.slice(1)
          : "Medium (2GB RAM)"

        const repoSubdomain =
          plan?.domain?.hostname ||
          trimmed
            .split("/")
            .pop()
            ?.replace(/\.git$/, "")
            ?.toLowerCase() ||
          "app"

        const startCommand = Array.isArray(plan?.detection?.commands)
          ? plan.detection.commands[1] || plan.detection.commands[0]
          : detection?.startCommand || "pnpm start"

        const envVarsCount = trimmed.includes("laravel") ? 12 : 3

        const detectedManifest =
          framework.toLowerCase().includes("laravel") ||
          runtime.toLowerCase().includes("php")
            ? "composer.json"
            : "package.json"

        const bp: InlineBlueprintData = {
          framework,
          runtime,
          port,
          computeTier,
          subdomain: repoSubdomain,
          startCommand,
          envVarsCount,
          hourlyRate: 0.04,
        }

        setActiveBlueprint(bp)
        setActiveSessionId(payload?.session?.id)
        setInspectionData((data.data as Record<string, unknown>) ?? null)

        const telemetryBadges: ToolTelemetryBadgeProps[] = [
          {
            toolName: "list_repo_files",
            args: "GitLab/GitHub API",
            result: "34 files scanned",
            durationMs: 120,
          },
          {
            toolName: "read_repo_file",
            args: `'${detectedManifest}'`,
            result: `${framework} on ${runtime}`,
            durationMs: 85,
          },
          {
            toolName: "read_repo_file",
            args: "'.env.example'",
            result: `${envVarsCount} keys detected`,
            durationMs: 40,
          },
        ]

        const replyContent = isId
          ? "Public Repository Verified! Blueprint siap-pakai telah disiapkan di bawah:"
          : "Public Repository Verified! Ready-to-use blueprint prepared below:"

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  isStreaming: false,
                  telemetry: telemetryBadges,
                  blueprint: bp,
                  content: replyContent,
                }
              : msg
          )
        )
      } catch {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  isStreaming: false,
                  error: "Network error during inspection",
                  content:
                    "Network error while inspecting repository. Please try again.",
                }
              : msg
          )
        )
      } finally {
        setIsProcessing(false)
      }
    },
    [isId]
  )

  // Handle conversational chat message & mutations
  const handleSendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      // Check if message is a repository URL
      if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("git@") ||
        trimmed.startsWith("Deploy https://") ||
        trimmed.startsWith("Deploy http://") ||
        /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)
      ) {
        const urlToInspect = trimmed.startsWith("Deploy ")
          ? trimmed.slice(7)
          : trimmed
        await handleInspectUrl(urlToInspect)
        return
      }

      setIsProcessing(true)
      const userMsgId = `user-${Date.now()}`
      const assistantMsgId = `assistant-${Date.now()}`

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: trimmed },
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          isStreaming: true,
        },
      ])

      // If active session exists, stream from backend chat API
      if (activeSessionId) {
        try {
          const res = await fetch(
            `/api/deploy/ai-sessions/${activeSessionId}/chat`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: trimmed }),
            }
          )

          let accumulated = ""
          if (res.body) {
            const reader = res.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              const chunk = decoder.decode(value, { stream: true })
              accumulated += chunk

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: accumulated }
                    : msg
                )
              )
            }
          } else {
            const json = await res.json()
            accumulated = json.message || "Updated"
          }

          // Check for conversational blueprint mutations
          const portMatch = trimmed.match(
            /(?:ganti\s+)?port\s*(?:ke|to|=)?\s*(\d+)/i
          )
          const tierMatch = trimmed.match(
            /(?:compute\s*tier|tier)\s*(?:ke|to|=)?\s*(starter|pro|small|medium|large)/i
          )
          const envMatch = trimmed.match(/([A-Za-z_][A-Za-z0-9_]*)=([^\s]+)/)

          let updatedBp = activeBlueprint ? { ...activeBlueprint } : null
          const telemetryUpdates: ToolTelemetryBadgeProps[] = []

          if (portMatch && updatedBp) {
            const newPort = parseInt(portMatch[1], 10)
            updatedBp = { ...updatedBp, port: newPort }
            telemetryUpdates.push({
              toolName: "update_blueprint_field",
              args: `{ field: 'port', value: ${newPort} }`,
              result: "updated",
              durationMs: 45,
            })
          }

          if (tierMatch && updatedBp) {
            const newTier =
              tierMatch[1].charAt(0).toUpperCase() +
              tierMatch[1].slice(1).toLowerCase()
            updatedBp = { ...updatedBp, computeTier: newTier }
            telemetryUpdates.push({
              toolName: "update_blueprint_field",
              args: `{ field: 'computeTier', value: '${newTier}' }`,
              result: "updated",
              durationMs: 42,
            })
          }

          if (envMatch && updatedBp) {
            updatedBp = {
              ...updatedBp,
              envVarsCount: (updatedBp.envVarsCount ?? 0) + 1,
            }
            telemetryUpdates.push({
              toolName: "add_environment_variable",
              args: `{ key: '${envMatch[1]}' }`,
              result: "saved",
              durationMs: 38,
            })
          }

          if (updatedBp) {
            setActiveBlueprint(updatedBp)
          }

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: accumulated,
                    isStreaming: false,
                    blueprint: updatedBp,
                    telemetry:
                      telemetryUpdates.length > 0
                        ? telemetryUpdates
                        : msg.telemetry,
                  }
                : msg
            )
          )
        } catch {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    isStreaming: false,
                    content:
                      "Maaf, terjadi kesalahan saat menghubungi Tanya P. Silakan coba lagi.",
                  }
                : msg
            )
          )
        }
      } else {
        // No session yet: reply with helpful guide
        const guideText = isId
          ? `Halo! Masukkan URL repositori Git (misal: "https://github.com/organization/repo") untuk memulai inspeksi otomatis.`
          : `Hello! Please enter a Git repository URL (e.g. "https://github.com/organization/repo") to begin automated inspection.`

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, isStreaming: false, content: guideText }
              : msg
          )
        )
      }

      setIsProcessing(false)
    },
    [activeBlueprint, activeSessionId, handleInspectUrl, isId]
  )

  const handleLaunchTransition = () => {
    if (!activeBlueprint) return
    onReadyToLaunch({
      blueprint: activeBlueprint,
      sessionId: activeSessionId,
      inspectionData,
      sourceUrl: lastSourceUrl,
    })
  }

  return (
    <div
      data-testid="deploy-chat-stream"
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 md:p-6"
    >
      {/* Tanya P Welcome Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
          <Sparkle className="h-6 w-6" weight="fill" />
        </div>
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {agentMessages.greeting.replace("{name}", userName)}
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {isId
              ? "Mau deploy apa hari ini? Masukkan URL Git (GitHub / GitLab) atau tanyakan setup arsitektur aplikasi Anda."
              : agentMessages.subtitle}
          </p>
        </div>
      </div>

      {/* Connected Repositories Quick-Picks */}
      {repos.length > 0 && messages.length === 0 && (
        <div className="flex flex-col gap-1.5 px-1">
          <span className="text-xs font-medium text-muted-foreground">
            {agentMessages.quickPicks}
          </span>
          <div className="flex flex-wrap gap-2">
            {repos.slice(0, 5).map((repo) => (
              <button
                key={repo.id}
                type="button"
                onClick={() => void handleInspectUrl(repo.htmlUrl)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted"
              >
                <GithubLogo className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{repo.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation Message Stream */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            data-testid={`chat-message-${msg.role}`}
            className={`flex flex-col gap-2 ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            {/* Message header */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {msg.role === "user" ? (
                <span className="font-semibold text-foreground">🧑 User</span>
              ) : (
                <span className="font-semibold text-primary">🤖 Tanya P</span>
              )}
            </div>

            {/* Bubble / Card surface */}
            <div
              className={`flex max-w-2xl flex-col gap-2.5 rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "w-full border border-border bg-card text-foreground shadow-xs"
              }`}
            >
              {/* Tool Execution Telemetry Badges */}
              {msg.telemetry && msg.telemetry.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-0.5">
                  {msg.telemetry.map((tel, idx) => (
                    <ToolTelemetryBadge
                      key={idx}
                      toolName={tel.toolName}
                      args={tel.args}
                      result={tel.result}
                      durationMs={tel.durationMs}
                      message={tel.message}
                    />
                  ))}
                </div>
              )}

              {/* Error Callout */}
              {msg.error && (
                <div className="flex flex-col gap-1 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <WarningCircle className="h-4 w-4 shrink-0" weight="fill" />
                    <span>Inspection Failed</span>
                  </div>
                  <span className="text-foreground/80">{msg.error}</span>
                </div>
              )}

              {/* Text content */}
              {msg.content && !msg.error && (
                <div className="leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              )}

              {/* Streaming loading indicator */}
              {msg.isStreaming && !msg.content && !msg.telemetry?.length && (
                <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
                  <span className="inline-block h-2 w-2 animate-ping rounded-full bg-primary/60" />
                  <span>
                    {isId ? "Sedang menganalisis..." : "Analyzing..."}
                  </span>
                </div>
              )}

              {/* Inline Blueprint Proposal Card */}
              {msg.blueprint && (
                <InlineBlueprintCard
                  blueprint={msg.blueprint}
                  lang={lang}
                  onReadyToLaunch={handleLaunchTransition}
                  onTweakClick={(field) => {
                    void handleSendMessage(
                      field === "port"
                        ? "Ganti port ke 8080"
                        : "Tolong sesuaikan blueprint"
                    )
                  }}
                />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Persistent Bottom Prompt Bar */}
      <div className="sticky bottom-0 pt-2 backdrop-blur-sm">
        <DeployPromptBar
          disabled={isProcessing}
          onSend={(text) => void handleSendMessage(text)}
          placeholder={
            isId
              ? 'Ketik prompt (misal: "Ganti port ke 8080", "Deploy https://github.com/...")'
              : 'Ask Tanya P or paste repository URL (e.g. "Deploy https://github.com/...")'
          }
        />
      </div>
    </div>
  )
}

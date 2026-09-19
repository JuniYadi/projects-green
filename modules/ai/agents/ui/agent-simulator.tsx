"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowSquareOut,
  ArrowsClockwise,
  CaretDown,
  CaretUp,
  ChatCircleDots,
  Clock,
  Coins,
  Cpu,
  PaperPlaneRight,
  Robot,
  Sparkle,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type SimulatorAgent = {
  id: string
  name: string
  description?: string | null
  isActive?: boolean
}

export type InteractiveButton = {
  type: "reply" | "cta_url"
  title: string
  payload?: string
  url?: string
}

export type TracedToolCall = {
  toolName: string
  args: unknown
  output: unknown
  status: "SUCCESS" | "ERROR" | "NOT_FOUND"
  durationMs: number
}

export type SimulationUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  latencyMs: number
}

export type SimulatorChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  interactiveButtons?: InteractiveButton[]
  rawText?: string
  toolCalls?: TracedToolCall[]
  usage?: SimulationUsage
}

export type AgentSimulatorProps = {
  agents: SimulatorAgent[]
  selectedAgentId?: string | null
  onAgentChange?: (agentId: string) => void
  lang?: string
}

let messageCounter = 0

function generateMessageId(prefix: "user" | "asst"): string {
  messageCounter += 1
  return `${prefix}-${Date.now()}-${messageCounter}`
}

function getCurrentTimestamp(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatJson(val: unknown): string {
  if (val === undefined) return "undefined"
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}

export default function AgentSimulator({
  agents,
  selectedAgentId,
  onAgentChange,
  lang = "id",
}: AgentSimulatorProps) {
  const messages = getMessagesForMaybeLocale(lang).console.aiAgents
  const sim = messages.simulator

  const [currentAgentId, setCurrentAgentId] = useState<string>(() => {
    if (selectedAgentId) return selectedAgentId
    return agents[0]?.id || ""
  })
  const [prevSelectedAgentId, setPrevSelectedAgentId] =
    useState(selectedAgentId)

  if (selectedAgentId !== prevSelectedAgentId) {
    setPrevSelectedAgentId(selectedAgentId)
    if (selectedAgentId) {
      setCurrentAgentId(selectedAgentId)
    }
  }

  const currentAgent = useMemo(
    () => agents.find((a) => a.id === currentAgentId) || agents[0],
    [agents, currentAgentId]
  )

  const [chatMessages, setChatMessages] = useState<SimulatorChatMessage[]>([])
  const [inputText, setInputText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null)
  const [expandedTools, setExpandedTools] = useState<
    Record<number, boolean>
  >({})

  // Find the assistant message whose trace should be displayed in inspector
  const activeAssistantTurn = useMemo(() => {
    if (selectedTurnId) {
      const found = chatMessages.find(
        (m) => m.id === selectedTurnId && m.role === "assistant"
      )
      if (found) return found
    }
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      if (chatMessages[i].role === "assistant") {
        return chatMessages[i]
      }
    }
    return null
  }, [chatMessages, selectedTurnId])

  const handleAgentSelect = (id: string) => {
    setCurrentAgentId(id)
    onAgentChange?.(id)
  }

  const handleClearChat = () => {
    setChatMessages([])
    setSelectedTurnId(null)
    setExpandedTools({})
  }

  const toggleToolExpanded = (idx: number) => {
    setExpandedTools((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }))
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim()
    if (!text || isLoading || !currentAgentId) return

    const nowIso = getCurrentTimestamp()

    const userMessage: SimulatorChatMessage = {
      id: generateMessageId("user"),
      role: "user",
      content: text,
      timestamp: nowIso,
    }

    const updatedMessages = [...chatMessages, userMessage]
    setChatMessages(updatedMessages)
    if (!textToSend) {
      setInputText("")
    }
    setIsLoading(true)

    try {
      const historyPayload = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await eden.api.console.ai.simulate.post({
        agentProfileId: currentAgentId,
        message: text,
        conversationHistory: historyPayload,
      })

      if (res.data && res.data.ok && "data" in res.data) {
        const payload = res.data.data
        const assistantMessage: SimulatorChatMessage = {
          id: generateMessageId("asst"),
          role: "assistant",
          content: payload.replyText,
          rawText: payload.rawText,
          interactiveButtons: payload.interactiveButtons || [],
          toolCalls: payload.toolCalls || [],
          usage: payload.usage,
          timestamp: getCurrentTimestamp(),
        }
        setChatMessages([...updatedMessages, assistantMessage])
        setSelectedTurnId(assistantMessage.id)
      } else {
        const errorMsg =
          res.data &&
          "message" in res.data &&
          typeof res.data.message === "string"
            ? res.data.message
            : sim.errorMessage
        toast.error(errorMsg)
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : sim.errorMessage
      toast.error(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Card: Agent Selector & Status */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div
            className={
              "flex flex-col gap-4 sm:flex-row " +
              "sm:items-center sm:justify-between"
            }
          >
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <Robot size={22} className="text-emerald-500" />
                <span>{sim.title}</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {sim.subtitle}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="simulator-agent-select" className="text-xs">
                  {sim.selectAgentLabel}
                </Label>
                <Select
                  value={currentAgentId}
                  onValueChange={handleAgentSelect}
                  disabled={agents.length === 0}
                >
                  <SelectTrigger
                    id="simulator-agent-select"
                    className="h-8 w-[200px] text-xs"
                  >
                    <SelectValue placeholder={sim.selectAgentPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((ag) => (
                      <SelectItem key={ag.id} value={ag.id} className="text-xs">
                        {ag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleClearChat}
                disabled={chatMessages.length === 0 && !selectedTurnId}
                className={
                  "h-8 gap-1.5 text-xs text-muted-foreground " +
                  "hover:text-foreground"
                }
              >
                <ArrowsClockwise size={14} />
                <span>{sim.clearChatButton}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Split View */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Pane: WhatsApp Chat Simulator */}
        <div className="flex flex-col lg:col-span-7">
          <div
            className={
              "flex flex-1 flex-col overflow-hidden rounded-xl " +
              "border border-border bg-card shadow-xs"
            }
          >
            {/* WhatsApp Header Bar */}
            <div
              className={
                "flex items-center justify-between border-b " +
                "border-border bg-muted/40 px-4 py-3"
              }
            >
              <div className="flex items-center gap-3">
                <div
                  className={
                    "flex h-9 w-9 items-center justify-center " +
                    "rounded-full bg-emerald-500/10 text-emerald-500"
                  }
                >
                  <Robot size={20} weight="fill" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold leading-tight">
                    {currentAgent?.name || sim.noAgentsAvailable}
                  </h4>
                  <p
                    className={
                      "flex items-center gap-1.5 text-[11px] " +
                      "text-muted-foreground"
                    }
                  >
                    <span
                      className={
                        "inline-block h-2 w-2 rounded-full bg-emerald-500"
                      }
                    />
                    <span>{sim.sandboxBadge}</span>
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  "border-emerald-500/30 bg-emerald-500/5 text-[10px] " +
                  "text-emerald-600 dark:text-emerald-400"
                }
              >
                {sim.badgeApiVersion}
              </Badge>
            </div>

            {/* Chat Messages Body */}
            <div
              className={
                "flex min-h-[420px] max-h-[560px] flex-1 flex-col " +
                "gap-3 overflow-y-auto bg-muted/20 p-4"
              }
            >
              {chatMessages.length === 0 ? (
                <div
                  className={
                    "flex flex-1 flex-col items-center justify-center " +
                    "p-6 text-center text-muted-foreground"
                  }
                >
                  <ChatCircleDots
                    size={36}
                    className="mb-2 text-emerald-500"
                    weight="duotone"
                  />
                  <p className="text-sm font-medium text-foreground">
                    {sim.emptyChatTitle}
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    {sim.emptyChatSubtitle}
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isUser = msg.role === "user"
                  const isTurnActive =
                    !isUser && activeAssistantTurn?.id === msg.id

                  const bubbleStyle = isUser
                    ? "rounded-tr-none bg-[#d9fdd3] text-zinc-900 " +
                      "dark:bg-emerald-950/70 dark:text-zinc-100"
                    : isTurnActive
                    ? "rounded-tl-none border border-emerald-500/50 " +
                      "bg-card text-foreground ring-1 ring-emerald-500/30"
                    : "rounded-tl-none border border-border bg-card " +
                      "text-foreground hover:border-border/80"

                  return (
                    <div
                      key={msg.id}
                      className={`flex w-full ${
                        isUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        onClick={() => {
                          if (!isUser) setSelectedTurnId(msg.id)
                        }}
                        className={
                          `group relative max-w-[85%] rounded-lg p-3 text-xs ` +
                          `shadow-xs transition-shadow ${bubbleStyle} ` +
                          `${!isUser ? "cursor-pointer" : ""}`
                        }
                      >
                        {/* Text Content */}
                        <div
                          className={
                            "whitespace-pre-wrap leading-relaxed " +
                            "break-words font-sans"
                          }
                        >
                          {msg.content}
                        </div>

                        {/* WhatsApp Interactive Buttons */}
                        {msg.interactiveButtons &&
                          msg.interactiveButtons.length > 0 && (
                            <div
                              className={
                                "mt-2.5 flex flex-col gap-1.5 " +
                                "border-t border-border/40 pt-2"
                              }
                            >
                              {msg.interactiveButtons.map((btn, btnIdx) => {
                                if (btn.type === "cta_url" && btn.url) {
                                  return (
                                    <a
                                      key={btnIdx}
                                      href={btn.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={
                                        "flex items-center justify-center " +
                                        "gap-1.5 rounded-md border " +
                                        "border-border/60 bg-muted/60 " +
                                        "px-3 py-1.5 text-xs font-medium " +
                                        "text-emerald-600 transition-colors " +
                                        "hover:bg-muted dark:text-emerald-400"
                                      }
                                    >
                                      <ArrowSquareOut size={13} weight="bold" />
                                      <span>{btn.title}</span>
                                    </a>
                                  )
                                }
                                return (
                                  <button
                                    key={btnIdx}
                                    type="button"
                                    disabled={isLoading}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void handleSendMessage(btn.title)
                                    }}
                                    className={
                                      "flex items-center justify-center " +
                                      "gap-1.5 rounded-md border " +
                                      "border-border/60 bg-muted/60 " +
                                      "px-3 py-1.5 text-xs font-medium " +
                                      "text-emerald-600 transition-colors " +
                                      "hover:bg-muted disabled:opacity-50 " +
                                      "dark:text-emerald-400"
                                    }
                                  >
                                    <ChatCircleDots size={13} weight="bold" />
                                    <span>{btn.title}</span>
                                  </button>
                                )
                              })}
                            </div>
                          )}

                        {/* Metadata Footer */}
                        <div
                          className={
                            "mt-1 flex items-center justify-end gap-1 " +
                            "text-[10px] text-muted-foreground/70"
                          }
                        >
                          {!isUser &&
                            msg.toolCalls &&
                            msg.toolCalls.length > 0 && (
                              <span
                                className={
                                  "mr-1 inline-flex items-center gap-0.5 " +
                                  "rounded bg-muted px-1 text-[9px] " +
                                  "font-mono text-muted-foreground"
                                }
                              >
                                <Cpu size={10} />
                                {msg.toolCalls.length}{" "}
                                {sim.toolCountSuffix}
                              </span>
                            )}
                          <span>{msg.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              {/* Loading Thinking Indicator */}
              {isLoading && (
                <div className="flex w-full justify-start">
                  <div
                    className={
                      "flex items-center gap-2 rounded-lg rounded-tl-none " +
                      "border border-border bg-card p-3 text-xs " +
                      "text-muted-foreground shadow-xs"
                    }
                  >
                    <Sparkle
                      size={14}
                      className="animate-spin text-emerald-500"
                      weight="fill"
                    />
                    <span>{sim.thinking}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Message Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleSendMessage()
              }}
              className={
                "flex items-center gap-2 border-t border-border " +
                "bg-card p-3"
              }
            >
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={sim.inputPlaceholder}
                disabled={isLoading || !currentAgentId}
                className="h-9 text-xs"
              />
              <Button
                type="submit"
                onClick={(e) => {
                  e.preventDefault()
                  void handleSendMessage()
                }}
                disabled={!inputText.trim() || isLoading || !currentAgentId}
                className={
                  "h-9 gap-1.5 bg-emerald-600 px-4 text-xs " +
                  "text-white hover:bg-emerald-700"
                }
              >
                <PaperPlaneRight size={14} weight="bold" />
                <span>{sim.sendButton}</span>
              </Button>
            </form>
          </div>
        </div>

        {/* Right Pane: Execution Inspector */}
        <div className="flex flex-col lg:col-span-5">
          <Card className="flex flex-1 flex-col border-border bg-card">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {sim.inspectorTitle}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {sim.inspectorSubtitle}
                  </CardDescription>
                </div>
                {activeAssistantTurn && (
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {`${sim.turnLabel} ${activeAssistantTurn.timestamp}`}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-4 pt-4">
              {!activeAssistantTurn ? (
                <div
                  className={
                    "flex flex-1 flex-col items-center justify-center " +
                    "p-6 text-center text-muted-foreground"
                  }
                >
                  <Cpu
                    size={32}
                    className="mb-2 text-muted-foreground/60"
                    weight="duotone"
                  />
                  <p className="text-xs font-medium text-foreground">
                    {sim.emptyInspectorTitle}
                  </p>
                  <p className="mt-1 max-w-xs text-[11px]">
                    {sim.emptyInspectorSubtitle}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Telemetry Metrics Summary */}
                  <div>
                    <Label
                      className={
                        "text-[11px] font-semibold text-muted-foreground"
                      }
                    >
                      {sim.metricsTitle}
                    </Label>
                    <div
                      className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4"
                    >
                      <div
                        className={
                          "rounded-lg border border-border bg-muted/40 " +
                          "p-2 text-center"
                        }
                      >
                        <div
                          className={
                            "flex items-center justify-center gap-1 " +
                            "text-[10px] text-muted-foreground"
                          }
                        >
                          <Coins size={12} />
                          <span>{sim.totalTokens}</span>
                        </div>
                        <div className="mt-0.5 font-mono text-sm font-semibold">
                          {activeAssistantTurn.usage?.totalTokens ?? 0}
                        </div>
                      </div>

                      <div
                        className={
                          "rounded-lg border border-border bg-muted/40 " +
                          "p-2 text-center"
                        }
                      >
                        <div className="text-[10px] text-muted-foreground">
                          {sim.promptTokens}
                        </div>
                        <div className="mt-0.5 font-mono text-sm font-semibold">
                          {activeAssistantTurn.usage?.promptTokens ?? 0}
                        </div>
                      </div>

                      <div
                        className={
                          "rounded-lg border border-border bg-muted/40 " +
                          "p-2 text-center"
                        }
                      >
                        <div className="text-[10px] text-muted-foreground">
                          {sim.completionTokens}
                        </div>
                        <div className="mt-0.5 font-mono text-sm font-semibold">
                          {activeAssistantTurn.usage?.completionTokens ?? 0}
                        </div>
                      </div>

                      <div
                        className={
                          "rounded-lg border border-border bg-muted/40 " +
                          "p-2 text-center"
                        }
                      >
                        <div
                          className={
                            "flex items-center justify-center gap-1 " +
                            "text-[10px] text-muted-foreground"
                          }
                        >
                          <Clock size={12} />
                          <span>{sim.latency}</span>
                        </div>
                        <div
                          className={
                            "mt-0.5 font-mono text-sm font-semibold " +
                            "text-emerald-600 dark:text-emerald-400"
                          }
                        >
                          {`${activeAssistantTurn.usage?.latencyMs ?? 0}ms`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tabs: Tools Trace vs Response Comparison */}
                  <Tabs defaultValue="trace" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="trace" className="text-xs">
                        {sim.toolTraceTitle} (
                        {activeAssistantTurn.toolCalls?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="comparison" className="text-xs">
                        {sim.responseComparisonTitle}
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab 1: Tools Execution Trace */}
                    <TabsContent value="trace" className="mt-3 space-y-2">
                      {(!activeAssistantTurn.toolCalls ||
                        activeAssistantTurn.toolCalls.length === 0) ? (
                        <div
                          className={
                            "rounded-lg border border-dashed border-border " +
                            "p-4 text-center text-xs text-muted-foreground"
                          }
                        >
                          {sim.noToolsExecuted}
                        </div>
                      ) : (
                        activeAssistantTurn.toolCalls.map((tool, tIdx) => {
                          const isExpanded = Boolean(expandedTools[tIdx])
                          const statusVariant =
                            tool.status === "SUCCESS"
                              ? "border-emerald-500/30 bg-emerald-500/10 " +
                                "text-emerald-600 dark:text-emerald-400"
                              : tool.status === "NOT_FOUND"
                              ? "border-amber-500/30 bg-amber-500/10 " +
                                "text-amber-600 dark:text-amber-400"
                              : "border-destructive/30 bg-destructive/10 " +
                                "text-destructive"

                          return (
                            <div
                              key={tIdx}
                              className={
                                "rounded-lg border border-border " +
                                "bg-muted/30 text-xs"
                              }
                            >
                              <button
                                type="button"
                                onClick={() => toggleToolExpanded(tIdx)}
                                className={
                                  "flex w-full items-center justify-between " +
                                  "p-2.5 text-left font-medium " +
                                  "transition-colors hover:bg-muted/50"
                                }
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold">
                                    {tool.toolName}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] ${statusVariant}`}
                                  >
                                    {tool.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={
                                      "font-mono text-[10px] " +
                                      "text-muted-foreground"
                                    }
                                  >
                                    {`${tool.durationMs}ms`}
                                  </span>
                                  {isExpanded ? (
                                    <CaretUp size={12} />
                                  ) : (
                                    <CaretDown size={12} />
                                  )}
                                </div>
                              </button>

                              {isExpanded && (
                                <div
                                  className={
                                    "space-y-2 border-t border-border/60 " +
                                    "bg-background/50 p-2.5"
                                  }
                                >
                                  <div>
                                    <span
                                      className={
                                        "text-[10px] font-semibold " +
                                        "text-muted-foreground"
                                      }
                                    >
                                      {sim.toolArgs}:
                                    </span>
                                    <pre
                                      className={
                                        "mt-1 max-h-36 overflow-auto " +
                                        "rounded border border-border/60 " +
                                        "bg-muted/60 p-2 font-mono " +
                                        "text-[11px] text-foreground"
                                      }
                                    >
                                      {formatJson(tool.args)}
                                    </pre>
                                  </div>
                                  <div>
                                    <span
                                      className={
                                        "text-[10px] font-semibold " +
                                        "text-muted-foreground"
                                      }
                                    >
                                      {sim.toolOutput}:
                                    </span>
                                    <pre
                                      className={
                                        "mt-1 max-h-48 overflow-auto " +
                                        "rounded border border-border/60 " +
                                        "bg-muted/60 p-2 font-mono " +
                                        "text-[11px] text-foreground"
                                      }
                                    >
                                      {formatJson(tool.output)}
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </TabsContent>

                    {/* Tab 2: Response Comparison */}
                    <TabsContent value="comparison" className="mt-3 space-y-3">
                      <div>
                        <div className="flex items-center justify-between pb-1">
                          <Label
                            className={
                              "text-[11px] font-semibold text-muted-foreground"
                            }
                          >
                            {sim.tabCleanOutput}
                          </Label>
                          <Badge variant="outline" className="text-[9px]">
                            {sim.cleanOutputBadge}
                          </Badge>
                        </div>
                        <div
                          className={
                            "rounded-lg border border-border bg-muted/30 " +
                            "p-2.5 font-sans text-xs leading-relaxed " +
                            "text-foreground"
                          }
                        >
                          {activeAssistantTurn.content || sim.noData}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between pb-1">
                          <Label
                            className={
                              "text-[11px] font-semibold text-muted-foreground"
                            }
                          >
                            {sim.tabRawOutput}
                          </Label>
                          <Badge variant="outline" className="text-[9px]">
                            {sim.rawOutputBadge}
                          </Badge>
                        </div>
                        <pre
                          className={
                            "max-h-56 overflow-auto rounded-lg border " +
                            "border-border bg-muted/50 p-2.5 font-mono " +
                            "text-[11px] text-muted-foreground"
                          }
                        >
                          {activeAssistantTurn.rawText ||
                            activeAssistantTurn.content ||
                            sim.noData}
                        </pre>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export { AgentSimulator }

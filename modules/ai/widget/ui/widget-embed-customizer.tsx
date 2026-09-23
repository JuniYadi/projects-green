"use client"

import { useState, useId } from "react"
import { toast } from "sonner"
import {
  Globe,
  Check,
  Copy,
  ChatCircleDots,
  PaperPlaneRight,
  Sparkle,
  X,
  ArrowSquareOut,
  WarningCircle,
} from "@phosphor-icons/react"
import { eden } from "@/lib/eden"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type WidgetCustomizerAgent = {
  id: string
  name: string
  widgetColor?: string | null
  widgetPosition?: string | null
  welcomeMessage?: string | null
  allowedDomains?: string[]
}

export type WidgetEmbedCustomizerProps = {
  agents: WidgetCustomizerAgent[]
  selectedAgentId?: string | null
  onAgentChange?: (agentId: string) => void
  onAgentUpdated?: (agent: WidgetCustomizerAgent) => void
  lang?: string
}

export const COLOR_PRESETS = [
  { label: "Emerald", hex: "#10B981" },
  { label: "Blue", hex: "#2563EB" },
  { label: "Violet", hex: "#7C3AED" },
  { label: "Amber", hex: "#D97706" },
  { label: "Dark", hex: "#18181B" },
] as const

export function normalizeDomainPattern(pattern: string): string {
  return (
    pattern
      .trim()
      .toLowerCase()
      .replace(/^[a-zA-Z]+:\/\//, "")
      .split("/")[0]
      ?.trim() || ""
  )
}

export function isValidDomainPattern(pattern: string): boolean {
  const clean = normalizeDomainPattern(pattern)
  if (!clean) return false
  if (clean === "*") return true
  if (
    clean === "localhost" ||
    clean.startsWith("localhost:") ||
    clean.startsWith("127.0.0.1:")
  ) {
    return true
  }
  const regex =
    /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9-]{2,}/
  if (!regex.test(clean)) return false
  const portPart = clean.split(":")[1]
  if (portPart && !/^\d+$/.test(portPart)) return false
  return true
}

export default function WidgetEmbedCustomizer({
  agents,
  selectedAgentId,
  onAgentChange,
  onAgentUpdated,
  lang = "id",
}: WidgetEmbedCustomizerProps) {
  const messages = getMessagesForMaybeLocale(lang).console.aiAgents.widgetEmbed
  const selectId = useId()
  const colorInputId = useId()
  const welcomeInputId = useId()
  const domainsInputId = useId()

  const currentAgent =
    agents.find((a) => a.id === selectedAgentId) || agents[0] || null

  const safePosition =
    currentAgent?.widgetPosition === "bottom-left"
      ? "bottom-left"
      : "bottom-right"

  const presetLabels: Record<string, string> = {
    Emerald: messages.colorPresetEmerald,
    Blue: messages.colorPresetBlue,
    Violet: messages.colorPresetViolet,
    Amber: messages.colorPresetAmber,
    Dark: messages.colorPresetDark,
  }

  const [prevAgentId, setPrevAgentId] = useState(currentAgent?.id)
  const [color, setColor] = useState(currentAgent?.widgetColor || "#10B981")
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">(
    safePosition
  )
  const [welcomeMessage, setWelcomeMessage] = useState(
    currentAgent?.welcomeMessage || messages.welcomeMessagePlaceholder
  )
  const [domainsText, setDomainsText] = useState(
    currentAgent?.allowedDomains ? currentAgent.allowedDomains.join("\n") : ""
  )
  const [activeSnippetTab, setActiveSnippetTab] = useState("html")
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)
  const [isPreviewChatOpen, setIsPreviewChatOpen] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Sync state when agent changes during render
  if (currentAgent && currentAgent.id !== prevAgentId) {
    setPrevAgentId(currentAgent.id)
    setColor(currentAgent.widgetColor || "#10B981")
    setPosition(
      currentAgent.widgetPosition === "bottom-left"
        ? "bottom-left"
        : "bottom-right"
    )
    setWelcomeMessage(
      currentAgent.welcomeMessage || messages.welcomeMessagePlaceholder
    )
    setDomainsText(
      currentAgent.allowedDomains ? currentAgent.allowedDomains.join("\n") : ""
    )
  }

  // Parse and validate domains
  const parsedDomains = domainsText
    .split(/[\n,]+/)
    .map((d) => normalizeDomainPattern(d))
    .filter(Boolean)

  const invalidDomains = parsedDomains.filter((d) => !isValidDomainPattern(d))
  const isDomainsValid = invalidDomains.length === 0

  const agentId = currentAgent?.id || "your-agent-id"

  const htmlSnippet =
    `<script src="https://app.pfnapp.com/widget.js" ` +
    `data-agent-id="${agentId}" ` +
    `data-color="${color}" ` +
    `data-position="${position}" defer></script>`

  const nextjsSnippet = `import Script from "next/script"

<Script
  src="https://app.pfnapp.com/widget.js"
  data-agent-id="${agentId}"
  data-color="${color}"
  data-position="${position}"
  strategy="lazyOnload"
/>`

  const shareLink = `https://chat.pfnapp.com/a/${agentId}`

  const handleCopy = async (text: string, snippetKey: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
      setCopiedSnippet(snippetKey)
      setTimeout(() => {
        setCopiedSnippet((prev) => (prev === snippetKey ? null : prev))
      }, 2000)
      toast.success(messages.copiedButton)
    } catch {
      toast.error(messages.copyFailed)
    }
  }

  const handleSave = async () => {
    if (!currentAgent) return
    if (!isDomainsValid) {
      toast.error(`${messages.invalidDomainError} ${invalidDomains.join(", ")}`)
      return
    }

    setIsSaving(true)
    try {
      const res = await eden.api.console.ai.agents[currentAgent.id].put({
        allowedDomains: parsedDomains,
        widgetColor: color,
        widgetPosition: position,
        welcomeMessage: welcomeMessage.trim(),
      })

      if (res.data && res.data.ok) {
        toast.success(messages.saveSuccess)
        if (onAgentUpdated) {
          onAgentUpdated({
            ...currentAgent,
            allowedDomains: parsedDomains,
            widgetColor: color,
            widgetPosition: position,
            welcomeMessage: welcomeMessage.trim(),
          })
        }
      } else {
        toast.error(messages.saveError)
      }
    } catch (err) {
      console.error("[widget-embed] save error:", err)
      toast.error(messages.saveError)
    } finally {
      setIsSaving(false)
    }
  }

  if (!currentAgent && agents.length === 0) {
    return (
      <Card className="border-dashed p-8 text-center">
        <Globe size={36} className="mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">{messages.noAgentSelected}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header & Agent Selector */}
      <div
        className={
          "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        }
      >
        <div>
          <h2 className="text-xl font-bold tracking-tight">{messages.title}</h2>
          <p className="text-xs text-muted-foreground">{messages.subtitle}</p>
        </div>

        {agents.length > 1 && (
          <div className="flex items-center gap-2">
            <Label
              htmlFor={selectId}
              className="text-xs font-medium text-muted-foreground"
            >
              {messages.agentSelectLabel}:
            </Label>
            <Select
              value={currentAgent?.id || ""}
              onValueChange={(val) => onAgentChange && onAgentChange(val)}
            >
              <SelectTrigger id={selectId} className="h-8 w-48 text-xs">
                <SelectValue placeholder={messages.agentSelectPlaceholder} />
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
        )}
      </div>

      {/* Main Grid: Customizer Controls + Live Mockup Preview */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Customizer Controls (6 cols) */}
        <div className="space-y-6 lg:col-span-6">
          <Card className="border-border">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Sparkle size={16} weight="fill" className="text-emerald-500" />
                <span>{messages.customizerCardTitle}</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {messages.customizerCardDesc}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Color Picker & Presets */}
              <div className="space-y-2.5">
                <Label htmlFor={colorInputId} className="text-xs font-medium">
                  {messages.colorLabel}
                </Label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      id={colorInputId}
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      aria-label={messages.colorLabel}
                      className={
                        "h-8 w-9 cursor-pointer rounded border border-border " +
                        "bg-background p-0.5"
                      }
                    />
                    <Input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="#10B981"
                      className="h-8 w-24 font-mono text-xs uppercase"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {COLOR_PRESETS.map((preset) => {
                      const label = presetLabels[preset.label] || preset.label
                      return (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setColor(preset.hex)}
                          title={label}
                          className={
                            "flex h-7 items-center gap-1.5 rounded-md " +
                            "border border-border/60 px-2 text-[11px] " +
                            "font-medium transition-colors hover:bg-muted"
                          }
                        >
                          <span
                            className={
                              "h-3 w-3 rounded-full border border-black/10"
                            }
                            style={{ backgroundColor: preset.hex }}
                          />
                          <span>{label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Launcher Position */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  {messages.positionLabel}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPosition("bottom-right")}
                    className={
                      "flex items-center justify-center gap-2 rounded-lg " +
                      "border p-2.5 text-xs font-medium transition-colors " +
                      (position === "bottom-right"
                        ? "border-emerald-500 bg-emerald-500/10 " +
                          "text-emerald-600 dark:text-emerald-400"
                        : "border-border bg-card text-muted-foreground " +
                          "hover:bg-muted/50")
                    }
                  >
                    <span>↘</span>
                    <span>{messages.positionBottomRight}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosition("bottom-left")}
                    className={
                      "flex items-center justify-center gap-2 rounded-lg " +
                      "border p-2.5 text-xs font-medium transition-colors " +
                      (position === "bottom-left"
                        ? "border-emerald-500 bg-emerald-500/10 " +
                          "text-emerald-600 dark:text-emerald-400"
                        : "border-border bg-card text-muted-foreground " +
                          "hover:bg-muted/50")
                    }
                  >
                    <span>↙</span>
                    <span>{messages.positionBottomLeft}</span>
                  </button>
                </div>
              </div>

              {/* Welcome Message */}
              <div className="space-y-2">
                <Label htmlFor={welcomeInputId} className="text-xs font-medium">
                  {messages.welcomeMessageLabel}
                </Label>
                <Input
                  id={welcomeInputId}
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder={messages.welcomeMessagePlaceholder}
                  className="text-xs"
                />
              </div>

              {/* Allowed Domains */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor={domainsInputId}
                    className="text-xs font-medium"
                  >
                    {messages.allowedDomainsLabel}
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    {messages.domainCount.replace(
                      "{count}",
                      String(parsedDomains.length)
                    )}
                  </span>
                </div>
                <Textarea
                  id={domainsInputId}
                  value={domainsText}
                  onChange={(e) => setDomainsText(e.target.value)}
                  placeholder={messages.allowedDomainsPlaceholder}
                  rows={3}
                  className={
                    "font-mono text-xs " +
                    (!isDomainsValid
                      ? "border-red-500 focus-visible:ring-red-500"
                      : "")
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  {messages.allowedDomainsHint}
                </p>

                {/* Validation message if invalid */}
                {!isDomainsValid && (
                  <div
                    className={"flex items-center gap-1.5 text-xs text-red-500"}
                  >
                    <WarningCircle size={14} />
                    <span>
                      {messages.invalidDomainError} {invalidDomains.join(", ")}
                    </span>
                  </div>
                )}

                {/* Domain badges preview */}
                {parsedDomains.length > 0 && isDomainsValid && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {parsedDomains.map((domain) => (
                      <Badge
                        key={domain}
                        variant="secondary"
                        className={
                          "border border-border/80 bg-muted/60 font-mono " +
                          "text-[10px] text-foreground"
                        }
                      >
                        🌐 {domain}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Save CTA */}
              <div className="pt-2">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !isDomainsValid}
                  className={
                    "w-full bg-emerald-600 text-white hover:bg-emerald-700 " +
                    "disabled:opacity-50"
                  }
                >
                  {isSaving ? messages.savingButton : messages.saveButton}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Mockup Preview (6 cols) */}
        <div className="space-y-6 lg:col-span-6">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    {messages.previewTitle}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {messages.previewMockSub}
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={
                    "font-mono text-[10px] text-muted-foreground uppercase"
                  }
                >
                  {messages.livePreviewBadge}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {/* Simulated Browser Frame */}
              <div
                className={
                  "relative flex min-h-[380px] flex-col overflow-hidden " +
                  "rounded-xl border border-border bg-background shadow-sm"
                }
              >
                {/* Mock Browser Title Bar */}
                <div
                  className={
                    "flex items-center gap-2 border-b border-border " +
                    "bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div
                    className={
                      "mx-auto flex w-3/5 items-center justify-center " +
                      "gap-1 rounded bg-background/80 py-0.5 text-[11px] " +
                      "font-mono text-muted-foreground shadow-xs"
                    }
                  >
                    🔒{" "}
                    {parsedDomains[0]
                      ? `https://${parsedDomains[0].replace(/^\*\./, "")}`
                      : "https://toko-official.com"}
                  </div>
                </div>

                {/* Mock Webpage Body Content */}
                <div className="flex-1 p-4">
                  {/* Mock Navbar */}
                  <div
                    className={
                      "mb-4 flex items-center justify-between border-b " +
                      "border-border/40 pb-2"
                    }
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded bg-muted-foreground/30" />
                      <span className="text-xs font-bold tracking-tight">
                        {currentAgent?.name || messages.defaultStoreName}
                      </span>
                    </div>
                    <div
                      className={"flex gap-2 text-[10px] text-muted-foreground"}
                    >
                      <span>{messages.navHome}</span>
                      <span>{messages.navCatalog}</span>
                      <span>{messages.navContact}</span>
                    </div>
                  </div>

                  {/* Mock Hero Section */}
                  <div
                    className={
                      "rounded-lg border border-border/40 bg-muted/20 p-4 " +
                      "text-left"
                    }
                  >
                    <span
                      className={
                        "rounded bg-muted px-1.5 py-0.5 text-[10px] " +
                        "font-medium text-muted-foreground"
                      }
                    >
                      {messages.promoSpecial}
                    </span>
                    <h3 className="mt-1.5 text-xs font-semibold">
                      {messages.welcomeHeading}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {messages.welcomeDescription}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <div className="h-6 w-16 rounded bg-muted-foreground/20" />
                      <div className="h-6 w-20 rounded bg-muted-foreground/10" />
                    </div>
                  </div>

                  {/* Mock Cards */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div
                      className={
                        "h-14 rounded border border-border/30 bg-muted/10 p-2"
                      }
                    >
                      <div className="h-2 w-12 rounded bg-muted-foreground/20" />
                      <div
                        className={
                          "mt-1.5 h-2 w-16 rounded bg-muted-foreground/10"
                        }
                      />
                    </div>
                    <div
                      className={
                        "h-14 rounded border border-border/30 bg-muted/10 p-2"
                      }
                    >
                      <div className="h-2 w-10 rounded bg-muted-foreground/20" />
                      <div
                        className={
                          "mt-1.5 h-2 w-14 rounded bg-muted-foreground/10"
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Simulated Floating Chat Drawer (Openable) */}
                {isPreviewChatOpen && (
                  <div
                    className={
                      "absolute bottom-16 z-10 w-64 rounded-xl border " +
                      "border-border bg-card shadow-lg transition-all " +
                      (position === "bottom-right" ? "right-4" : "left-4")
                    }
                  >
                    {/* Drawer Header */}
                    <div
                      className={
                        "flex items-center justify-between rounded-t-xl " +
                        "px-3 py-2.5 text-white"
                      }
                      style={{ backgroundColor: color }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={
                            "flex h-6 w-6 items-center justify-center " +
                            "rounded-full bg-white/20"
                          }
                        >
                          <ChatCircleDots size={14} weight="fill" />
                        </div>
                        <div className="text-left leading-tight">
                          <p className="text-xs font-medium">
                            {currentAgent?.name ||
                              messages.defaultAssistantName}
                          </p>
                          <span className="text-[10px] opacity-80">
                            {messages.onlineStatus}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPreviewChatOpen(false)}
                        className="rounded p-1 text-white/80 hover:bg-white/10"
                        aria-label={messages.closePreviewAria}
                      >
                        <X size={13} weight="bold" />
                      </button>
                    </div>

                    {/* Drawer Messages Area */}
                    <div className="space-y-2.5 p-3 text-xs">
                      {/* Bot Welcome Message */}
                      <div className="flex items-start gap-1.5">
                        <div
                          className={
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center " +
                            "justify-center rounded-full text-white"
                          }
                          style={{ backgroundColor: color }}
                        >
                          <Sparkle size={10} weight="fill" />
                        </div>
                        <div
                          className={
                            "max-w-[85%] rounded-lg rounded-tl-none " +
                            "bg-muted/80 p-2 text-[11px] leading-relaxed " +
                            "text-foreground shadow-2xs"
                          }
                        >
                          {welcomeMessage || messages.defaultWelcomeMessage}
                        </div>
                      </div>
                    </div>

                    {/* Drawer Mock Input */}
                    <div
                      className={
                        "flex items-center gap-1.5 border-t border-border p-2"
                      }
                    >
                      <div
                        className={
                          "flex-1 rounded-md bg-muted/50 px-2 py-1 " +
                          "text-[10px] text-muted-foreground"
                        }
                      >
                        {messages.previewInputPlaceholder}
                      </div>
                      <div
                        className={
                          "flex h-6 w-6 items-center justify-center " +
                          "rounded-md text-white"
                        }
                        style={{ backgroundColor: color }}
                      >
                        <PaperPlaneRight size={11} weight="fill" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Floating Launcher Button */}
                <div
                  className={
                    "absolute bottom-4 z-10 transition-all " +
                    (position === "bottom-right" ? "right-4" : "left-4")
                  }
                >
                  <button
                    type="button"
                    onClick={() => setIsPreviewChatOpen(!isPreviewChatOpen)}
                    style={{ backgroundColor: color }}
                    aria-label={messages.togglePreviewAria}
                    className={
                      "flex h-11 w-11 items-center justify-center " +
                      "rounded-full text-white shadow-md " +
                      "transition-transform hover:scale-105 active:scale-95"
                    }
                  >
                    {isPreviewChatOpen ? (
                      <X size={20} weight="bold" />
                    ) : (
                      <ChatCircleDots size={22} weight="fill" />
                    )}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 1-Click Code Snippet Box */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Globe size={16} className="text-emerald-500" />
            <span>{messages.snippetTitle}</span>
          </CardTitle>
          <CardDescription className="text-xs">
            {messages.snippetSubtitle}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs
            value={activeSnippetTab}
            onValueChange={setActiveSnippetTab}
            className="w-full"
          >
            <div
              className={
                "flex items-center justify-between border-b border-border pb-2"
              }
            >
              <TabsList className="h-8">
                <TabsTrigger value="html" className="text-xs">
                  {messages.tabHtml}
                </TabsTrigger>
                <TabsTrigger value="nextjs" className="text-xs">
                  {messages.tabNextjs}
                </TabsTrigger>
                <TabsTrigger value="share" className="text-xs">
                  {messages.tabShareLink}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab 1: HTML Script */}
            <TabsContent value="html" className="mt-4 space-y-3">
              <div
                className={
                  "relative rounded-lg bg-zinc-950 p-4 text-zinc-100 " +
                  "dark:bg-zinc-900"
                }
              >
                <pre
                  className={
                    "overflow-x-auto font-mono text-xs leading-relaxed"
                  }
                >
                  <code>{htmlSnippet}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopy(htmlSnippet, "html")}
                  className="absolute top-3 right-3 h-7 gap-1.5 text-xs"
                >
                  {copiedSnippet === "html" ? (
                    <>
                      <Check size={13} className="text-emerald-500" />
                      <span>{messages.copiedButton}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>{messages.copyButton}</span>
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Tab 2: React / Next.js */}
            <TabsContent value="nextjs" className="mt-4 space-y-3">
              <div
                className={
                  "relative rounded-lg bg-zinc-950 p-4 text-zinc-100 " +
                  "dark:bg-zinc-900"
                }
              >
                <pre
                  className={
                    "overflow-x-auto font-mono text-xs leading-relaxed"
                  }
                >
                  <code>{nextjsSnippet}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopy(nextjsSnippet, "nextjs")}
                  className="absolute top-3 right-3 h-7 gap-1.5 text-xs"
                >
                  {copiedSnippet === "nextjs" ? (
                    <>
                      <Check size={13} className="text-emerald-500" />
                      <span>{messages.copiedButton}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>{messages.copyButton}</span>
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Tab 3: Standalone Share Link */}
            <TabsContent value="share" className="mt-4 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  readOnly
                  value={shareLink}
                  className="font-mono text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(shareLink, "share")}
                    className="h-9 shrink-0 gap-1.5 text-xs"
                  >
                    {copiedSnippet === "share" ? (
                      <>
                        <Check size={14} className="text-emerald-500" />
                        <span>{messages.copiedLinkButton}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>{messages.copyLinkButton}</span>
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    asChild
                    className="h-9 shrink-0 gap-1.5 text-xs"
                  >
                    <a
                      href={shareLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ArrowSquareOut size={14} />
                      <span>{messages.openLinkButton}</span>
                    </a>
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

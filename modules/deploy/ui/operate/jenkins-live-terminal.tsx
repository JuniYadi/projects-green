"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import {
  ArrowsIn,
  ArrowsOut,
  ArrowClockwise,
  Check,
  Copy,
  MagnifyingGlass,
  Terminal,
  WarningCircle,
  X,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { DeployStatus } from "@/modules/deploy/deploy.types"
import { cn } from "@/lib/utils"

export type LogSourceTab = "jenkins" | "gitops" | "app"

type JenkinsLiveTerminalProps = {
  slug: string
  deployId: string
  status: DeployStatus
  failureReason?: string | null
  onRetry?: () => void
  locale?: string
  className?: string
  initialTab?: LogSourceTab
  onTabChange?: (tab: LogSourceTab) => void
  /** When set, overrides the active tab (controlled from parent). */
  forceTab?: LogSourceTab
}

type AnsiSpan = {
  text: string
  className?: string
}

export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
}

export function parseAnsiLine(raw: string): AnsiSpan[] {
  // Regex to match ANSI escape sequences
  const ansiRegex = /\x1b\[([0-9;]*)m/g
  const spans: AnsiSpan[] = []

  let lastIndex = 0
  let currentClass = ""
  let match: RegExpExecArray | null

  while ((match = ansiRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      spans.push({
        text: raw.slice(lastIndex, match.index),
        className: currentClass || undefined,
      })
    }

    const code = match[1] || "0"
    const codes = code.split(";").map((c) => parseInt(c, 10))

    for (const c of codes) {
      if (c === 0) currentClass = ""
      else if (c === 1) currentClass += " font-semibold"
      else if (c === 2) currentClass += " opacity-60"
      else if (c === 31 || c === 91) currentClass += " text-red-400"
      else if (c === 32 || c === 92) currentClass += " text-emerald-400"
      else if (c === 33 || c === 93) currentClass += " text-amber-400"
      else if (c === 34 || c === 94) currentClass += " text-sky-400"
      else if (c === 35 || c === 95) currentClass += " text-purple-400"
      else if (c === 36 || c === 96) currentClass += " text-cyan-400"
      else if (c === 37 || c === 97) currentClass += " text-zinc-100"
      else if (c === 90) currentClass += " text-zinc-500"
    }

    lastIndex = ansiRegex.lastIndex
  }

  if (lastIndex < raw.length) {
    spans.push({
      text: raw.slice(lastIndex),
      className: currentClass || undefined,
    })
  }

  return spans.length > 0 ? spans : [{ text: raw }]
}

export function JenkinsLiveTerminal({
  slug,
  deployId,
  status,
  failureReason,
  onRetry,
  locale: localeProp,
  className,
  initialTab,
  onTabChange,
  forceTab,
}: JenkinsLiveTerminalProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(localeProp ?? params?.lang)
  const messages = getMessages(locale)
  const t = messages.console.app.timeline.terminal

  const defaultTab: LogSourceTab =
    initialTab ??
    (status === "deploying"
      ? "gitops"
      : status === "running"
        ? "app"
        : "jenkins")

  const [activeTab, setActiveTab] = useState<LogSourceTab>(defaultTab)

  const [jenkinsLogs, setJenkinsLogs] = useState<string>("")
  const [gitopsLogs, setGitopsLogs] = useState<string[]>([])
  const [appLogs, setAppLogs] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [autoScroll, setAutoScroll] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [copied, setCopied] = useState<boolean>(false)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [authFailed, setAuthFailed] = useState<boolean>(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const terminalEndRef = useRef<HTMLDivElement>(null)
  const terminalContainerRef = useRef<HTMLDivElement>(null)

  // Switch tab automatically if status transitions into deploying or running, unless user changed tab
  const userInteractedTabRef = useRef(false)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!userInteractedTabRef.current) {
      if (status === "deploying") setActiveTab("gitops")
      else if (status === "running") setActiveTab("app")
      else if (
        status === "building" ||
        status === "queued" ||
        status === "failed"
      ) {
        setActiveTab("jenkins")
      }
    }
  }, [status])

  // Respond to external tab override from the timeline step panel on the left.
  // Resets userInteractedTabRef so status-driven auto-switch can resume normally.
  useEffect(() => {
    if (!forceTab) return
    userInteractedTabRef.current = false
    setActiveTab(forceTab)
  }, [forceTab])

  // Fetch live Jenkins build logs
  const fetchJenkinsLogs = useCallback(async () => {
    if (!slug || !deployId) return
    try {
      const res = await fetch(
        `/api/deploy/apps/${encodeURIComponent(slug)}/deployments/${encodeURIComponent(deployId)}/jenkins-stream`
      )
      if (res.status === 401) {
        setAuthFailed(true)
        setIsStreaming(false)
        return
      }
      if (!res.ok) {
        setFetchError(`HTTP ${res.status}`)
        return
      }
      const data = (await res.json()) as {
        ok: boolean
        text?: string
        isBuilding?: boolean
        error?: string
      }
      if (data.error === "JENKINS_AUTH_FAILED") {
        setAuthFailed(true)
        setIsStreaming(false)
        return
      }
      if (data.ok && typeof data.text === "string") {
        setJenkinsLogs(data.text)
        setIsStreaming(Boolean(data.isBuilding))
        setFetchError(null)
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Fetch error")
    }
  }, [slug, deployId])

  // Fetch GitOps & App runtime logs from deploy APIs
  const fetchAuxLogs = useCallback(async () => {
    if (!deployId) return
    try {
      const [logsRes, eventsRes] = await Promise.all([
        fetch(`/api/deploy/logs/${encodeURIComponent(deployId)}`),
        fetch(`/api/deploy/events/${encodeURIComponent(deployId)}`),
      ])

      if (logsRes.ok) {
        const logsData = (await logsRes.json()) as {
          ok: boolean
          data?: Array<{ scope: string; message: string; timestamp?: string }>
        }
        if (logsData.ok && Array.isArray(logsData.data)) {
          const gitops: string[] = []
          const app: string[] = []
          for (const item of logsData.data) {
            const line = `[${item.scope.toUpperCase()}] ${item.message}`
            if (item.scope === "runtime") {
              app.push(line)
            } else {
              gitops.push(line)
            }
          }
          if (gitops.length > 0) setGitopsLogs(gitops)
          if (app.length > 0) setAppLogs(app)
        }
      }

      if (eventsRes.ok) {
        const eventsData = (await eventsRes.json()) as {
          ok: boolean
          events?: Array<{ label: string; message?: string; createdAt: string }>
        }
        if (eventsData.ok && Array.isArray(eventsData.events)) {
          const eventLines = eventsData.events.map(
            (e) =>
              `[${new Date(e.createdAt).toLocaleTimeString()}] ${e.label}${e.message ? `: ${e.message}` : ""}`
          )
          setGitopsLogs((prev) =>
            prev.length === 0 ? eventLines : [...prev, ...eventLines]
          )
        }
      }
    } catch {
      // Swallowed: best-effort polling
    }
  }, [deployId])

  // Initial and interval polling
  useEffect(() => {
    void fetchJenkinsLogs()
    void fetchAuxLogs()

    const shouldPoll =
      status === "queued" || status === "building" || status === "deploying"

    if (!shouldPoll) return

    const timer = setInterval(() => {
      void fetchJenkinsLogs()
      void fetchAuxLogs()
    }, 2500)

    return () => clearInterval(timer)
  }, [fetchJenkinsLogs, fetchAuxLogs, status])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Autoscroll logic
  useEffect(() => {
    if (autoScroll && terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop =
        terminalContainerRef.current.scrollHeight
    }
  }, [jenkinsLogs, gitopsLogs, appLogs, activeTab, autoScroll])

  // Handle escape to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen])

  // Current active raw lines
  const currentLines = useMemo(() => {
    if (activeTab === "jenkins") {
      return jenkinsLogs ? jenkinsLogs.split("\n") : []
    }
    if (activeTab === "gitops") {
      return gitopsLogs
    }
    return appLogs
  }, [activeTab, jenkinsLogs, gitopsLogs, appLogs])

  // Filtered lines with search query
  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return currentLines
    const q = searchQuery.toLowerCase()
    return currentLines.filter((l) => stripAnsi(l).toLowerCase().includes(q))
  }, [currentLines, searchQuery])

  // Copy full log
  const handleCopy = async () => {
    try {
      const plainText = currentLines.map(stripAnsi).join("\n")
      await navigator.clipboard.writeText(plainText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable
    }
  }

  // Diagnostic failure reason resolution
  const isFailed = status === "failed" || authFailed
  const effectiveFailureReason =
    failureReason ||
    (authFailed
      ? t.authFailedTip
      : messages.pDeployOperateAppMonitor.genericFailureReason)

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs",
        isFullscreen &&
          "fixed inset-0 z-50 rounded-none border-none bg-background p-4",
        className
      )}
    >
      {/* Tab bar header */}
      <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              userInteractedTabRef.current = true
              setActiveTab("jenkins")
              onTabChange?.("jenkins")
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeTab === "jenkins"
                ? "border border-border bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Terminal className="size-3.5" />
            <span>{t.tabJenkins}</span>
            {isStreaming && (
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              userInteractedTabRef.current = true
              setActiveTab("gitops")
              onTabChange?.("gitops")
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeTab === "gitops"
                ? "border border-border bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>{t.tabGitOps}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              userInteractedTabRef.current = true
              setActiveTab("app")
              onTabChange?.("app")
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeTab === "app"
                ? "border border-border bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>{t.tabRuntime}</span>
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {isStreaming && (
            <span className="hidden items-center gap-1 text-[11px] font-medium text-emerald-600 sm:inline-flex dark:text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              {t.liveStreaming}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAutoScroll((prev) => !prev)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="Toggle autoscroll"
          >
            {autoScroll ? t.autoscrollOn : t.autoscrollOff}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="Copy log to clipboard"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-500" />
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {t.copied}
                </span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>{t.copyLog}</span>
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            title={isFullscreen ? t.exitFullscreen : t.fullscreen}
          >
            {isFullscreen ? (
              <ArrowsIn className="size-3.5" />
            ) : (
              <ArrowsOut className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
        <div className="relative w-64">
          <MagnifyingGlass className="absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="h-6 bg-background pr-6 pl-7 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {searchQuery
            ? `${filteredLines.length} / ${currentLines.length} lines`
            : `${currentLines.length} lines`}
        </div>
      </div>

      {/* Failure diagnostic banner */}
      {isFailed && (
        <div className="border-b border-destructive/30 bg-destructive/10 p-3 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-destructive">
                <WarningCircle className="size-4" weight="fill" />
                <span>{t.diagnosticTitle}</span>
              </div>
              <p className="text-foreground">{effectiveFailureReason}</p>
              {authFailed && (
                <p className="pt-0.5 text-muted-foreground">
                  💡 {t.authFailedTip}
                </p>
              )}
              {!authFailed && effectiveFailureReason.includes("REGISTRY") && (
                <p className="pt-0.5 text-muted-foreground">
                  💡 {t.registryFailedTip}
                </p>
              )}
              {!authFailed && effectiveFailureReason.includes("timed out") && (
                <p className="pt-0.5 text-muted-foreground">
                  💡 {t.timeoutFailedTip}
                </p>
              )}
              {!authFailed &&
                effectiveFailureReason
                  .toLowerCase()
                  .includes("health check") && (
                  <p className="pt-0.5 text-muted-foreground">
                    💡{" "}
                    {locale.startsWith("id")
                      ? "Aplikasi gagal merespons health check pada port target. Pastikan server web mendengarkan pada port yang sesuai dan rute root (/) merespons dengan status 200 OK."
                      : "The application failed the readiness health check on the target port. Ensure your web server listens on the configured port and the root route (/) returns a 200 OK status."}
                  </p>
                )}
            </div>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="h-8 shrink-0 gap-1.5 border-destructive/40 text-xs hover:bg-destructive/10"
              >
                <ArrowClockwise className="size-3.5" />
                <span>{t.retryDeploy}</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Terminal black canvas body */}
      <div
        ref={terminalContainerRef}
        className={cn(
          "relative flex-1 overflow-y-auto bg-zinc-950 p-4 font-mono text-xs text-zinc-100 selection:bg-zinc-800",
          isFullscreen ? "h-full max-h-none" : "h-[420px]"
        )}
      >
        {fetchError && !authFailed && (
          <div className="mb-3 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-300">
            [Warning] Stream connection issue: {fetchError}
          </div>
        )}

        {filteredLines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-zinc-500">
            <p>
              {activeTab === "jenkins"
                ? isStreaming
                  ? t.waitingJenkins
                  : t.noLogs
                : activeTab === "app"
                  ? status !== "running"
                    ? t.waitingRuntime
                    : t.noLogs
                  : t.noLogs}
            </p>
            {isFailed && activeTab === "jenkins" && (
              <p className="text-[11px] text-zinc-400">
                {locale.startsWith("id")
                  ? "Coba periksa tab Log Rilis & GitOps atau Log Aplikasi untuk melihat rincian error."
                  : "Try checking the Release & GitOps or Application Log tabs for failure details."}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5 leading-relaxed">
            {filteredLines.map((line, idx) => {
              const spans = parseAnsiLine(line)
              return (
                <div
                  key={idx}
                  className="flex items-start hover:bg-zinc-900/60"
                >
                  <span className="w-9 shrink-0 pr-3 text-right text-zinc-600 select-none">
                    {idx + 1}
                  </span>
                  <div className="flex-1 break-all whitespace-pre-wrap">
                    {spans.map((s, sIdx) => (
                      <span key={sIdx} className={s.className}>
                        {s.text}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  )
}

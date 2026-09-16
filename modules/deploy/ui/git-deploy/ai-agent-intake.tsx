"use client"

import { useCallback, useEffect, useState } from "react"
import {
  GithubLogo,
  Globe,
  MagnifyingGlass,
  Sparkle,
  Spinner,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { AiAgentAccessChecker } from "./ai-agent-access-checker"
import type {
  ConnectedRepository,
  GitAccessState,
  GitSourceConfig,
} from "./types"

type AiAgentIntakeProps = {
  initialSource?: GitSourceConfig
  userName?: string
  lang?: string
  onSourceVerified: (
    source: GitSourceConfig,
    inspectionData?: Record<string, unknown> | null
  ) => void
}

export function AiAgentIntake({
  initialSource,
  userName,
  lang = "en",
  onSourceVerified,
}: AiAgentIntakeProps) {
  const messages = getMessagesForMaybeLocale(lang)
  const agentMessages = messages.console.app.deployAgent

  const [url, setUrl] = useState(initialSource?.url ?? "")
  const [accessState, setAccessState] = useState<GitAccessState>("idle")
  const [accessMessage, setAccessMessage] = useState<string>("")
  const [inspectionResult, setInspectionResult] = useState<Record<
    string,
    unknown
  > | null>(null)

  // Quick pick connected repositories
  const [repos, setRepos] = useState<ConnectedRepository[]>([])

  // Load connected repos on mount for quick picks
  useEffect(() => {
    let active = true
    const fetchInitialRepos = async () => {
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
        } else {
          setRepos([])
        }
      } catch {
        if (active) setRepos([])
      }
    }
    void fetchInitialRepos()
    return () => {
      active = false
    }
  }, [])

  // Inspect repository URL
  const handleInspectUrl = useCallback(
    async (targetUrl: string) => {
      let trimmed = targetUrl.trim()
      if (!trimmed) {
        toast.error("Please enter a valid Git repository URL.")
        return
      }

      // Support shorthand like owner/repo
      if (
        !trimmed.startsWith("http://") &&
        !trimmed.startsWith("https://") &&
        !trimmed.startsWith("git@")
      ) {
        if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
          trimmed = `https://github.com/${trimmed}`
          setUrl(trimmed)
        }
      }

      setAccessState("inspecting")
      setAccessMessage("")

      try {
        const res = await fetch("/api/deploy/ai-sessions/inspect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceUrl: trimmed,
          }),
        })

        const data = await res.json()
        if (!res.ok || !data.ok) {
          setAccessState("error")
          setAccessMessage(
            data.message || data.error || "Failed to inspect repository."
          )
          return
        }

        const payload = data.data as
          | {
              status?: string
              access?: { state?: string; displayLabel?: string }
              detection?: {
                primaryFramework?: { id?: string; name?: string }
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
                status?: string
                blockedReason?: string
              }
              source?: {
                ref?: string
                subdir?: string
              }
              [key: string]: unknown
            }
          | undefined
        setInspectionResult(payload ?? null)

        const isLaunchBlocked =
          payload?.detection?.decision?.isLaunchable === false ||
          payload?.decision?.isLaunchable === false ||
          payload?.session?.status === "BLOCKED" ||
          payload?.status === "blocked"

        if (isLaunchBlocked) {
          setAccessState("error")
          setAccessMessage(
            payload?.detection?.decision?.message ||
              payload?.decision?.message ||
              payload?.session?.blockedReason ||
              "Framework is not currently supported for automated deployment."
          )
          return
        }

        if (payload?.access?.state === "public") {
          setAccessState("public")
          setAccessMessage(agentMessages.publicDescription)
        } else if (payload?.access?.state === "connected") {
          setAccessState("connected")
          setAccessMessage(agentMessages.privateAuthorizedDescription)
        } else if (payload?.access?.state === "required") {
          setAccessState("required")
          setAccessMessage(agentMessages.privateRequiredDescription)
        } else if (payload?.access?.state === "denied") {
          setAccessState("denied")
          setAccessMessage(
            "GitHub access was denied for this repository. Please install or re-authorize the GitHub App."
          )
        } else if (payload?.status === "not_supported") {
          setAccessState("error")
          setAccessMessage(
            "Only valid Git / GitHub repository HTTPS URLs are supported."
          )
        } else {
          setAccessState("public")
          setAccessMessage("Repository access confirmed.")
        }
      } catch {
        setAccessState("error")
        setAccessMessage(
          "Network error while inspecting repository. Please try again."
        )
      }
    },
    [
      agentMessages.publicDescription,
      agentMessages.privateAuthorizedDescription,
      agentMessages.privateRequiredDescription,
    ]
  )

  const refreshRepos = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/github/repositories")
      const data = await res.json()
      if (data.ok && Array.isArray(data.items)) {
        setRepos(data.items)
      }
    } catch {
      // ignore
    }
  }, [])

  // Handle GitHub App install popup
  const openGithubInstall = () => {
    const nonce = crypto.randomUUID()
    const width = 640
    const height = 760
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      `/api/integrations/github/install/start?popup=1&popupNonce=${nonce}`,
      "github-install-popup",
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
    )

    if (!popup) {
      toast.error("Popup was blocked by your browser. Please allow popups.")
    }
  }

  // Listen for popup message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof window === "undefined") return
      if (event.origin !== window.location.origin) return
      if (event.data?.type === "github-install-complete") {
        if (event.data?.status === "connected") {
          toast.success("GitHub App installed successfully.")
          void refreshRepos()
          if (url.trim()) {
            void handleInspectUrl(url.trim())
          }
        } else {
          toast.error("GitHub App authorization failed or was canceled.")
        }
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [url, handleInspectUrl, refreshRepos])

  const handleContinue = () => {
    const detectedBranch =
      ((inspectionResult?.source as Record<string, unknown> | undefined)
        ?.ref as string | undefined) || "main"

    onSourceVerified(
      {
        url: url.trim(),
        branch: detectedBranch,
        rootDir: "./",
        isPrivate: accessState !== "public",
      },
      inspectionResult
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-10">
      {/* Centered AI Agent Helper Hero */}
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
          <Sparkle className="h-7 w-7" weight="fill" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {agentMessages.greeting.replace("{name}", userName || "Developer")}
        </h1>
        <p className="mt-2.5 max-w-md text-sm text-muted-foreground">
          {agentMessages.subtitle}
        </p>
      </div>

      {/* Streamlined Repository Intake Input */}
      <div className="flex flex-col gap-4">
        <div className="relative flex items-center rounded-2xl border border-border bg-card p-1.5 shadow-sm transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
          <div className="flex pr-2 pl-3 text-muted-foreground">
            <Globe className="h-5 w-5" />
          </div>
          <Input
            autoFocus
            type="text"
            placeholder={agentMessages.inputPlaceholder}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setAccessState("idle")
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim()) {
                void handleInspectUrl(url)
              }
            }}
            className="border-0 bg-transparent text-base shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
          />
          <Button
            size="default"
            disabled={!url.trim() || accessState === "inspecting"}
            onClick={() => handleInspectUrl(url)}
            className="shrink-0 gap-2 rounded-xl px-5"
          >
            {accessState === "inspecting" ? (
              <Spinner className="h-4 w-4 animate-spin" />
            ) : (
              <MagnifyingGlass className="h-4 w-4" />
            )}
            <span>{agentMessages.inspectButton}</span>
          </Button>
        </div>

        {/* Real-time Visibility Feedback & OAuth Recovery */}
        <AiAgentAccessChecker
          accessState={accessState}
          accessMessage={accessMessage}
          lang={lang}
          onInstallApp={openGithubInstall}
          onRetry={() => handleInspectUrl(url)}
          onContinue={handleContinue}
        />

        {/* Organization Repositories Quick-Picks */}
        {repos.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {agentMessages.quickPicks}
            </span>
            <div className="flex flex-wrap gap-2">
              {repos.slice(0, 5).map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => {
                    setUrl(repo.htmlUrl)
                    void handleInspectUrl(repo.htmlUrl)
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted"
                >
                  <GithubLogo className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{repo.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import {
  ArrowRight,
  CheckCircle,
  GitBranch,
  GithubLogo,
  Globe,
  LockKey,
  MagnifyingGlass,
  Spinner,
  WarningCircle,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type {
  ConnectedRepository,
  GitAccessState,
  GitSourceConfig,
} from "./types"

type GitSourceStepProps = {
  initialSource?: GitSourceConfig
  onSourceVerified: (source: GitSourceConfig, inspectionData?: unknown) => void
}

export function GitSourceStep({
  initialSource,
  onSourceVerified,
}: GitSourceStepProps) {
  const [tab, setTab] = useState<"url" | "connected">("url")
  const [url, setUrl] = useState(initialSource?.url ?? "")
  const [branch, setBranch] = useState(initialSource?.branch ?? "main")
  const [rootDir, setRootDir] = useState(initialSource?.rootDir ?? "./")
  const [accessState, setAccessState] = useState<GitAccessState>("idle")
  const [accessMessage, setAccessMessage] = useState<string>("")
  const [inspectionResult, setInspectionResult] = useState<unknown>(null)

  // Connected Repositories state
  const [repos, setRepos] = useState<ConnectedRepository[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [repoSearch, setRepoSearch] = useState("")
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null)

  // Load connected repos
  const loadConnectedRepos = async () => {
    setReposLoading(true)
    try {
      const res = await fetch("/api/integrations/github/repositories")
      if (res.status === 401 || res.status === 404) {
        setGithubConnected(false)
        setRepos([])
        return
      }
      const data = await res.json()
      if (data.ok && Array.isArray(data.items)) {
        setRepos(data.items)
        setGithubConnected(true)
      } else {
        setGithubConnected(false)
        setRepos([])
      }
    } catch {
      setGithubConnected(false)
      setRepos([])
    } finally {
      setReposLoading(false)
    }
  }

  // Inspect source URL to detect visibility (Public vs Private)
  const handleInspectUrl = async (targetUrl: string) => {
    const trimmed = targetUrl.trim()
    if (!trimmed) {
      toast.error("Please enter a valid Git repository URL.")
      return
    }

    setAccessState("inspecting")
    setAccessMessage("Evaluating repository visibility and access permissions…")

    try {
      const res = await fetch("/api/deploy/ai-sessions/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: trimmed,
          ref: branch || undefined,
          subdir: rootDir === "./" ? undefined : rootDir,
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

      const payload = data.data
      setInspectionResult(payload)

      // Evaluate visibility and access status
      if (payload.access?.state === "public") {
        setAccessState("public")
        setAccessMessage(
          "Public repository verified. No GitHub authentication or permissions required."
        )
      } else if (payload.access?.state === "connected") {
        setAccessState("connected")
        setAccessMessage(
          "Private repository verified with connected GitHub App installation."
        )
      } else if (payload.access?.state === "required") {
        setAccessState("required")
        setAccessMessage(
          "This repository is private. GitHub App credentials are required to read code and build."
        )
      } else if (payload.access?.state === "denied") {
        setAccessState("denied")
        setAccessMessage(
          "GitHub access was denied for this repository. Please install or re-authorize the GitHub App."
        )
      } else if (payload.status === "not_supported") {
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
  }

  // Listen for popup callback
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof window === "undefined") return
      if (event.origin !== window.location.origin) return
      if (event.data?.type === "github-install-complete") {
        if (event.data?.status === "connected") {
          toast.success("GitHub App installed successfully.")
          setGithubConnected(true)
          void loadConnectedRepos()
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, branch, rootDir])

  // Open GitHub App install popup
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

  const handleContinue = () => {
    onSourceVerified(
      {
        url: url.trim(),
        branch: branch.trim() || "main",
        rootDir: rootDir.trim() || "./",
        isPrivate: accessState !== "public",
      },
      inspectionResult
    )
  }

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      r.fullName.toLowerCase().includes(repoSearch.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Intake Method Toggle */}
      <div className="flex items-center gap-2 border-b border-border pb-4">
        <Button
          variant={tab === "url" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("url")}
        >
          <Globe className="mr-1.5 h-4 w-4" />
          Git Repository URL
        </Button>
        <Button
          variant={tab === "connected" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setTab("connected")
            if (githubConnected === null) {
              void loadConnectedRepos()
            }
          }}
        >
          <GithubLogo className="mr-1.5 h-4 w-4" />
          Connected Repositories
          {repos.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {repos.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Tab 1: Direct Git URL Intake */}
      {tab === "url" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Repository Source</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter any public or private GitHub repository URL. The system
              automatically detects whether credentials are required.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-12">
              <div className="md:col-span-6">
                <label className="text-xs font-medium text-muted-foreground uppercase">
                  Repository URL
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    placeholder="https://github.com/organization/repository"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value)
                      setAccessState("idle")
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleInspectUrl(url)
                    }}
                  />
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="text-xs font-medium text-muted-foreground uppercase">
                  Branch
                </label>
                <div className="mt-1 flex items-center">
                  <Input
                    placeholder="main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  />
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="text-xs font-medium text-muted-foreground uppercase">
                  Root Directory
                </label>
                <div className="mt-1 flex items-center">
                  <Input
                    placeholder="./"
                    value={rootDir}
                    onChange={(e) => setRootDir(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleInspectUrl(url)}
                disabled={!url.trim() || accessState === "inspecting"}
              >
                {accessState === "inspecting" ? (
                  <>
                    <Spinner className="mr-1.5 h-4 w-4 animate-spin" />
                    Inspecting Visibility…
                  </>
                ) : (
                  <>
                    <MagnifyingGlass className="mr-1.5 h-4 w-4" />
                    Inspect Repository
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Visibility & Access Detection Result Box */}
          {accessState === "inspecting" && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5">
              <Spinner className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">
                  Detecting repository visibility and access permissions…
                </p>
                <p className="text-xs text-muted-foreground">
                  Checking if repository is public or requires GitHub App
                  credentials.
                </p>
              </div>
            </div>
          )}

          {accessState === "public" && (
            <div className="flex flex-col gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        Public Repository Verified
                      </h3>
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-700"
                      >
                        Public Access
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {accessMessage}
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={handleContinue}>
                  Continue to Build Settings
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {accessState === "connected" && (
            <div className="flex flex-col gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        Private Repository Authorized
                      </h3>
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-700"
                      >
                        Authorized via GitHub App
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {accessMessage}
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={handleContinue}>
                  Continue to Build Settings
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {(accessState === "required" || accessState === "denied") && (
            <div className="flex flex-col gap-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
              <div className="flex items-start gap-3">
                <WarningCircle className="mt-0.5 h-5 w-5 text-amber-600" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      GitHub App Installation Required
                    </h3>
                    <Badge
                      variant="secondary"
                      className="bg-amber-500/10 text-amber-700"
                    >
                      Private Repository
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {accessMessage}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button size="sm" onClick={openGithubInstall}>
                  <GithubLogo className="mr-1.5 h-4 w-4" />
                  Install GitHub App
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleInspectUrl(url)}
                >
                  Re-check Access
                </Button>
              </div>
            </div>
          )}

          {accessState === "error" && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
              <WarningCircle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <h3 className="text-sm font-semibold text-destructive">
                  Inspection Failed
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {accessMessage}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => void handleInspectUrl(url)}
                >
                  Retry Inspection
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Connected Private Repositories */}
      {tab === "connected" && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-base font-semibold">
                Connected GitHub Repositories
              </h2>
              <p className="text-xs text-muted-foreground">
                Select a private or public repository authorized under your
                organization’s GitHub App.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={openGithubInstall}>
                <GithubLogo className="mr-1.5 h-4 w-4" />
                Configure Repositories
              </Button>
            </div>
          </div>

          {githubConnected === false && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
              <GithubLogo className="h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 text-sm font-semibold">
                GitHub App Not Connected
              </h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Connect your GitHub account or organization to grant read access
                to your private repositories.
              </p>
              <Button size="sm" className="mt-4" onClick={openGithubInstall}>
                <GithubLogo className="mr-1.5 h-4 w-4" />
                Connect GitHub
              </Button>
            </div>
          )}

          {githubConnected === true && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="relative">
                <MagnifyingGlass className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search repositories by name…"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                />
              </div>

              {reposLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRepos.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  {repoSearch
                    ? "No repositories matching your search."
                    : "No repositories found under this installation."}
                </p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {filteredRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between p-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-3">
                        {repo.isPrivate ? (
                          <LockKey className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Globe className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {repo.fullName || repo.name}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] uppercase"
                            >
                              {repo.isPrivate ? "Private" : "Public"}
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <GitBranch className="h-3 w-3" />
                            <span>{repo.defaultBranch || "main"}</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setUrl(repo.htmlUrl)
                          setBranch(repo.defaultBranch || "main")
                          setTab("url")
                          void handleInspectUrl(repo.htmlUrl)
                        }}
                      >
                        Import
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

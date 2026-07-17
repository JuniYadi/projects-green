/* eslint-disable no-restricted-globals */
"use client"

import { useEffect, useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { GithubLogo, Key, Spinner } from "@phosphor-icons/react"

type GithubAccount = {
  id: string
  accountLogin: string
  accountType: string
  targetType: string
  installedAt: string
}

type CloudflareCredential = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  maskedToken: string
}

export default function CredentialsPage() {
  const [githubAccounts, setGithubAccounts] = useState<GithubAccount[]>([])
  const [githubLoading, setGithubLoading] = useState(true)
  const [githubError, setGithubError] = useState<string | null>(null)

  const [cloudflareCredentials, setCloudflareCredentials] = useState<CloudflareCredential[]>([])
  const [cloudflareLoading, setCloudflareLoading] = useState(true)
  const [cloudflareError, setCloudflareError] = useState<string | null>(null)

  const [cfName, setCfName] = useState("")
  const [cfToken, setCfToken] = useState("")
  const [cfSaving, setCfSaving] = useState(false)
  const [cfDeleting, setCfDeleting] = useState<string | null>(null)

  useEffect(() => {
    async function loadGithub() {
      setGithubLoading(true)
      try {
        const res = await fetch("/api/integrations/github/accounts")
        const data = await res.json()
        if (data.ok) setGithubAccounts(data.accounts)
        else setGithubError(data.error ?? "Failed to load accounts")
      } catch {
        setGithubError("Network error")
      } finally {
        setGithubLoading(false)
      }
    }
    async function loadCloudflare() {
      setCloudflareLoading(true)
      try {
        const res = await fetch("/api/integrations/cloudflare/dns-token")
        const data = await res.json()
        if (data.ok) setCloudflareCredentials(data.credentials)
        else if (res.status === 403) setCloudflareError("No organization selected")
        else setCloudflareError(data.error ?? "Failed to load credentials")
      } catch {
        setCloudflareError("Network error")
      } finally {
        setCloudflareLoading(false)
      }
    }
    void Promise.all([loadGithub(), loadCloudflare()])
  }, [])

  const handleCloudflareSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cfName.trim() || !cfToken.trim()) return

    setCfSaving(true)
    try {
      const res = await fetch("/api/integrations/cloudflare/dns-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cfName.trim(), token: cfToken.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success("DNS token saved")
        setCfName("")
        setCfToken("")
        setCloudflareCredentials((prev) => [...prev, data.credential])
      } else {
        toast.error(data.error ?? "Failed to save token")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setCfSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setCfDeleting(id)
    try {
      const res = await fetch(`/api/integrations/cloudflare/dns-token?id=${id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (data.ok) {
        toast.success("Token deleted")
        setCloudflareCredentials((prev) => prev.filter((c) => c.id !== id))
      } else {
        toast.error(data.error ?? "Failed to delete")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setCfDeleting(null)
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Credentials</h1>
        <p className="text-sm text-muted-foreground">
          Manage connected integrations and API tokens for your application.
        </p>
      </header>

      {/* GitHub Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GithubLogo className="size-5" weight="duotone" />
            GitHub
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {githubLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4 animate-spin" />
              Loading accounts...
            </div>
          ) : githubError ? (
            <p className="text-sm text-destructive">{githubError}</p>
          ) : githubAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No GitHub accounts connected. Connect one to enable repository
              deployments.
            </p>
          ) : (
            <ul className="space-y-2">
              {githubAccounts.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{account.accountLogin}</span>
                    <span className="text-xs text-muted-foreground">
                      {account.accountType} · {account.targetType} · Connected{" "}
                      {new Date(account.installedAt).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/integrations/github/install/start?returnTo=/console/app/credentials">
                Connect GitHub
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cloudflare DNS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="size-5" weight="duotone" />
            Cloudflare DNS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cloudflareLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4 animate-spin" />
              Loading credentials...
            </div>
          ) : cloudflareError ? (
            <p className="text-sm text-destructive">{cloudflareError}</p>
          ) : cloudflareCredentials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No DNS tokens saved yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {cloudflareCredentials.map((cred) => (
                <li
                  key={cred.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{cred.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {cred.maskedToken}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete(cred.id)}
                    disabled={cfDeleting === cred.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {cfDeleting === cred.id ? "Deleting..." : "Delete"}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={(e) => void handleCloudflareSave(e)}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label
                htmlFor="cf-name"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Name
              </label>
              <Input
                id="cf-name"
                placeholder="e.g. Primary DNS"
                value={cfName}
                onChange={(e) => setCfName(e.target.value)}
                disabled={cfSaving}
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="cf-token"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                API Token
              </label>
              <Input
                id="cf-token"
                type="password"
                placeholder="Cloudflare API token"
                value={cfToken}
                onChange={(e) => setCfToken(e.target.value)}
                disabled={cfSaving}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={cfSaving || !cfName.trim() || !cfToken.trim()}
            >
              {cfSaving ? (
                <>
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save token"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

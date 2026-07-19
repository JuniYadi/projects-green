/* eslint-disable no-restricted-globals */
"use client"

import { useEffect, useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { GithubLogo, Key, Spinner } from "@phosphor-icons/react"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useParams } from "next/navigation"
import { LifecyclePageShell } from "@/modules/deploy/ui/lifecycle-page-shell"

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
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

  const [githubAccounts, setGithubAccounts] = useState<GithubAccount[]>([])
  const [githubLoading, setGithubLoading] = useState(true)
  const [githubError, setGithubError] = useState<string | null>(null)

  const [cloudflareCredentials, setCloudflareCredentials] = useState<
    CloudflareCredential[]
  >([])
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
        else
          setGithubError(
            data.error ?? messages.console.app.credentials.github.loadError
          )
      } catch {
        setGithubError(messages.console.app.credentials.github.loadError)
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
        else if (res.status === 403)
          setCloudflareError(
            messages.console.app.credentials.cloudflare.noOrganization
          )
        else
          setCloudflareError(
            data.error ?? messages.console.app.credentials.cloudflare.loadError
          )
      } catch {
        setCloudflareError(
          messages.console.app.credentials.cloudflare.networkError
        )
      } finally {
        setCloudflareLoading(false)
      }
    }
    void Promise.all([loadGithub(), loadCloudflare()])
  }, [messages])

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
        toast.success(messages.console.app.credentials.cloudflare.saved)
        setCfName("")
        setCfToken("")
        setCloudflareCredentials((prev) => [...prev, data.credential])
      } else {
        toast.error(
          data.error ?? messages.console.app.credentials.cloudflare.saveError
        )
      }
    } catch {
      toast.error(messages.console.app.credentials.cloudflare.networkError)
    } finally {
      setCfSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setCfDeleting(id)
    try {
      const res = await fetch(
        `/api/integrations/cloudflare/dns-token?id=${id}`,
        {
          method: "DELETE",
        }
      )
      const data = await res.json()
      if (data.ok) {
        toast.success(messages.console.app.credentials.cloudflare.deleted)
        setCloudflareCredentials((prev) => prev.filter((c) => c.id !== id))
      } else {
        toast.error(
          data.error ?? messages.console.app.credentials.cloudflare.deleteError
        )
      }
    } catch {
      toast.error(messages.console.app.credentials.cloudflare.networkError)
    } finally {
      setCfDeleting(null)
    }
  }

  return (
    <LifecyclePageShell
      title={messages.console.app.credentials.heading}
      description={messages.console.app.credentials.description}
    >
      {/* GitHub Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GithubLogo className="size-5" weight="duotone" />
            {messages.console.app.credentials.github.heading}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {githubLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4 animate-spin" />
              {messages.console.app.credentials.github.loading}
            </div>
          ) : githubError ? (
            <p className="text-sm text-destructive">{githubError}</p>
          ) : githubAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {messages.console.app.credentials.github.noAccounts}
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
                      {messages.console.app.credentials.github.accountType} ·{" "}
                      {messages.console.app.credentials.github.targetType} ·{" "}
                      {messages.console.app.credentials.github.connected}{" "}
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
                {messages.console.app.credentials.github.connect}
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
            {messages.console.app.credentials.cloudflare.heading}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cloudflareLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4 animate-spin" />
              {messages.console.app.credentials.cloudflare.loading}
            </div>
          ) : cloudflareError ? (
            <p className="text-sm text-destructive">{cloudflareError}</p>
          ) : cloudflareCredentials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {messages.console.app.credentials.cloudflare.noCredentials}
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
                    {cfDeleting === cred.id
                      ? messages.console.app.credentials.cloudflare.deleting
                      : messages.console.app.credentials.cloudflare.delete}
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
                {messages.console.app.credentials.cloudflare.name}
              </label>
              <Input
                id="cf-name"
                placeholder={
                  messages.console.app.credentials.cloudflare.namePlaceholder
                }
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
                {messages.console.app.credentials.cloudflare.apiToken}
              </label>
              <Input
                id="cf-token"
                type="password"
                placeholder={
                  messages.console.app.credentials.cloudflare
                    .apiTokenPlaceholder
                }
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
                  {messages.console.app.credentials.cloudflare.saving}
                </>
              ) : (
                messages.console.app.credentials.cloudflare.save
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </LifecyclePageShell>
  )
}

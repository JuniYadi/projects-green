"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Globe, LockKey, Plus } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export type CloudflareCredentialOption = {
  id: string
  name: string
  maskedPreview?: string
  type?: string
  status?: string
}

export type DomainManagementQuota = {
  used: number
  maxCustomDomains: number
  allowWildcardDomain: boolean
  allowCustomTls: boolean
}

export type DomainManagementProps = {
  quota: DomainManagementQuota
  cloudflareCredentials: CloudflareCredentialOption[]
  onAddDomain: (input: {
    hostname: string
    wildcard: boolean
    cloudflareCredentialId?: string
    customTls: boolean
  }) => Promise<void> | void
}

export function DomainManagement({
  quota,
  cloudflareCredentials,
  onAddDomain,
}: DomainManagementProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const activeCredentials = cloudflareCredentials.filter(
    (credential) =>
      (credential.type === undefined ||
        credential.type === "CLOUDFLARE_API_TOKEN") &&
      (credential.status === undefined || credential.status === "ACTIVE")
  )
  const [hostname, setHostname] = useState("")
  const [wildcard, setWildcard] = useState(false)
  const [customTls, setCustomTls] = useState(false)
  const [credentialId, setCredentialId] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const quotaReached = quota.used >= quota.maxCustomDomains
  const canSubmit =
    hostname.trim().length > 0 &&
    !quotaReached &&
    (!wildcard || Boolean(credentialId))

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await onAddDomain({
        hostname: hostname.trim(),
        wildcard,
        cloudflareCredentialId: credentialId,
        customTls,
      })
      setHostname("")
      setWildcard(false)
      setCustomTls(false)
      setCredentialId(undefined)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : messages.pDeployDomainsDomainManagement.addDomainError
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe size={20} /> {messages.pDeployDomainsDomainManagement.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          role="status"
          className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
        >
          <p className="font-medium">
            {messages.pDeployDomainsDomainManagement.quotaTitle}
          </p>
          <p className="text-muted-foreground">
            {messages.pDeployDomainsDomainManagement.quotaUsage
              .replace("{used}", String(quota.used))
              .replace("{max}", String(quota.maxCustomDomains))}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-domain-hostname">
              {messages.pDeployDomainsDomainManagement.hostnameLabel}
            </Label>
            <Input
              id="custom-domain-hostname"
              value={hostname}
              onChange={(event) => setHostname(event.target.value)}
              placeholder="app.example.com"
              disabled={submitting || quotaReached}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="custom-domain-wildcard">
                {messages.pDeployDomainsDomainManagement.wildcardLabel}
              </Label>
              <p className="text-xs text-muted-foreground">
                {messages.pDeployDomainsDomainManagement.wildcardDescription}
              </p>
            </div>
            <Switch
              id="custom-domain-wildcard"
              checked={wildcard}
              onCheckedChange={setWildcard}
              disabled={submitting || !quota.allowWildcardDomain}
            />
          </div>
          {wildcard && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label htmlFor="cloudflare-credential">
                {messages.pDeployDomainsDomainManagement.cloudflareTokenLabel}
              </Label>
              <Select value={credentialId} onValueChange={setCredentialId}>
                <SelectTrigger id="cloudflare-credential">
                  <SelectValue
                    placeholder={
                      messages.pDeployDomainsDomainManagement
                        .credentialPlaceholder
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {activeCredentials.map((credential) => (
                    <SelectItem key={credential.id} value={credential.id}>
                      {credential.name}
                      {credential.maskedPreview
                        ? ` (${credential.maskedPreview})`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeCredentials.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {messages.pDeployDomainsDomainManagement.noCredentialsHint}
                </p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <LockKey size={16} />
              <div>
                <Label htmlFor="custom-domain-tls">
                  {messages.pDeployDomainsDomainManagement.customTlsLabel}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {messages.pDeployDomainsDomainManagement.customTlsDescription}
                </p>
              </div>
            </div>
            <Switch
              id="custom-domain-tls"
              checked={customTls}
              onCheckedChange={setCustomTls}
              disabled={submitting || !quota.allowCustomTls}
            />
          </div>
          <Button type="submit" disabled={submitting || !canSubmit}>
            <Plus size={16} className="mr-2" />
            {messages.pDeployDomainsDomainManagement.addDomain}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

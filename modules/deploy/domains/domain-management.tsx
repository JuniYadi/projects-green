"use client"

import { useState } from "react"
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
      setError(cause instanceof Error ? cause.message : "Unable to add domain.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe size={20} /> Domain management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          role="status"
          className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
        >
          <p className="font-medium">Custom domain quota</p>
          <p className="text-muted-foreground">
            {quota.used} of {quota.maxCustomDomains} custom domains in use
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-domain-hostname">Hostname</Label>
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
              <Label htmlFor="custom-domain-wildcard">Wildcard domain</Label>
              <p className="text-xs text-muted-foreground">
                Route all subdomains through this application.
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
                Cloudflare API token
              </Label>
              <Select value={credentialId} onValueChange={setCredentialId}>
                <SelectTrigger id="cloudflare-credential">
                  <SelectValue placeholder="Select an active credential" />
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
                  Add an active Cloudflare API token credential before using a
                  wildcard domain.
                </p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <LockKey size={16} />
              <div>
                <Label htmlFor="custom-domain-tls">
                  Custom TLS certificate
                </Label>
                <p className="text-xs text-muted-foreground">
                  Use your own certificate for this hostname.
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
            Add domain
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from "react"
import {
  ArrowsLeftRight,
  CaretDown,
  Check,
  Copy,
  Globe,
  Info,
  Trash,
  Wrench,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type {
  CustomDomain,
  DomainAllowlistMode,
  TenantDomainDTO,
  K8sEnvironmentId,
} from "@/modules/deploy/operate.types"

export type TabDomainsApi = {
  onAddDomain: (hostname: string) => Promise<void>
  onDeleteDomain: (domainId: string) => Promise<void>
  onVerifyDomain: (domainId: string) => Promise<void>
  onUploadCertificate: (
    domainId: string,
    input: {
      certificatePem: string
      privateKeyPem: string
      chainPem: string
    }
  ) => Promise<void>
  onUpdateAllowlist: (
    domainId: string,
    mode: DomainAllowlistMode
  ) => Promise<void>
  onAddAllowlistEntry: (
    domainId: string,
    input: { cidr: string; label?: string }
  ) => Promise<void>
  onDeleteAllowlistEntry: (domainId: string, entryId: string) => Promise<void>
  onRetry: () => Promise<void>
}

type TabDomainsProps = {
  /** Legacy props remain for direct operate-tab tests. */
  selectedEnv?: K8sEnvironmentId
  domains?: Record<K8sEnvironmentId, CustomDomain[]>
  setDomains?: React.Dispatch<
    React.SetStateAction<Record<K8sEnvironmentId, CustomDomain[]>>
  >
  /** Persisted tenant domain records used by the settings page. */
  stackSlug?: string
  apiDomains?: TenantDomainDTO[]
  api?: TabDomainsApi
  domainsLoading?: boolean
  domainsError?: string | null
}

const displayValue = (value: string | null | undefined) =>
  value || "Not configured"

const certificateLabel = (domain: TenantDomainDTO) => {
  const certificate = domain.certificate
  if (!certificate) return "Not configured"
  const status = certificate.status || "unknown"
  const expiry = certificate.expiresAt
    ? ` · expires ${new Date(certificate.expiresAt).toLocaleDateString()}`
    : ""
  return `${certificate.source || "Unknown source"} · ${status}${expiry}`
}
const dnsCheckLabel = (domain: TenantDomainDTO) => {
  if (!domain.dnsLastCheckedAt) return "Not checked yet"
  const checkedAt = new Date(domain.dnsLastCheckedAt)
  return Number.isNaN(checkedAt.getTime())
    ? "Checked"
    : `Checked ${checkedAt.toLocaleString()}`
}

const dnsEvidenceLabel = (domain: TenantDomainDTO) => {
  const evidence = domain.dnsResolverEvidence ?? []
  if (evidence.length === 0) return null
  const providers = new Set(
    evidence
      .filter((item) => item.outcome === "MATCH")
      .map((item) => item.provider)
  )
  return providers.size > 0
    ? `Matched by ${Array.from(providers).join(" + ")}`
    : "No resolver matched the target"
}

export function TabDomains({
  selectedEnv = "prod",
  domains,
  setDomains,
  stackSlug,
  apiDomains = [],
  api,
  domainsLoading = false,
  domainsError = null,
}: TabDomainsProps) {
  const apiMode = Boolean(stackSlug && api)
  const legacyItems = domains?.[selectedEnv] ?? []
  const items = apiMode ? apiDomains : []
  const [newDomain, setNewDomain] = useState("")
  const [trustProxy, setTrustProxy] = useState(false)
  const [proxyOpen, setProxyOpen] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [certificateForm, setCertificateForm] = useState<
    Record<
      string,
      { certificatePem: string; privateKeyPem: string; chainPem: string }
    >
  >({})
  const [allowlistInput, setAllowlistInput] = useState<Record<string, string>>(
    {}
  )

  const runAction = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save domain settings."
      )
    } finally {
      setBusyKey(null)
    }
  }

  const handleCopy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleLegacyAdd = (event: React.FormEvent) => {
    event.preventDefault()
    if (!newDomain.trim() || !setDomains) return
    setDomains((previous) => ({
      ...previous,
      [selectedEnv]: [
        ...previous[selectedEnv],
        {
          id: `legacy-${Date.now()}`,
          domain: newDomain.trim(),
          isPrimary: previous[selectedEnv].length === 0,
          tlsStatus: "pending",
          dnsStatus: "unverified",
          expiresAt: "",
        },
      ],
    }))
    setNewDomain("")
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formValue = new FormData(event.currentTarget).get("hostname")
    const hostname = String(formValue ?? newDomain).trim()
    if (!hostname) return
    if (!apiMode || !api) {
      handleLegacyAdd(event)
      return
    }
    void runAction("add", async () => {
      await api.onAddDomain(hostname)
      setNewDomain("")
    })
  }

  const removeLegacy = (id: string) => {
    if (!setDomains) return
    setDomains((previous) => ({
      ...previous,
      [selectedEnv]: previous[selectedEnv].filter((domain) => domain.id !== id),
    }))
  }

  const renderCopyButton = (value: string, key: string) => (
    <Button
      type="button"
      onClick={() => void handleCopy(value, key)}
      variant="ghost"
      size="xs"
      aria-label="Copy"
      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
    >
      {copiedKey === key ? (
        <Check size={12} className="text-emerald-400" />
      ) : (
        <Copy size={12} />
      )}
    </Button>
  )

  const renderDns = (domain: TenantDomainDTO) => {
    const endpoint = domain.endpoint
    const cname = domain.expectedCnameTarget || endpoint?.cnameTarget
    const ipv4 = endpoint?.ipv4Addresses ?? []
    const ipv6 = endpoint?.ipv6Addresses ?? []
    const records = [
      ...(cname ? [{ type: "CNAME", host: "@", value: cname }] : []),
      ...ipv4.map((value) => ({ type: "A", host: "@", value })),
      ...ipv6.map((value) => ({ type: "AAAA", host: "@", value })),
    ]
    return (
      <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
          DNS targets
        </p>
        {records.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No DNS target published.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">
              Add these records at your domain registrar (GoDaddy, Cloudflare,
              Namecheap, etc.), then click Verify above.
            </p>
            {records.map((record, index) => (
              <div
                key={`${domain.id}-${record.type}-${record.value}-${index}`}
                className="grid grid-cols-[64px_1fr_auto] items-center gap-2 font-mono text-[11px]"
              >
                <span className="font-bold text-emerald-400">
                  {record.type}
                </span>
                <span className="truncate text-foreground">{record.value}</span>
                {renderCopyButton(
                  record.value,
                  `${domain.id}-${record.type}-${index}`
                )}
              </div>
            ))}
          </>
        )}
      </div>
    )
  }

  const updateCertificateField = (
    domainId: string,
    field: "certificatePem" | "privateKeyPem" | "chainPem",
    value: string
  ) => {
    setCertificateForm((previous) => ({
      ...previous,
      [domainId]: {
        ...previous[domainId],
        certificatePem: "",
        privateKeyPem: "",
        chainPem: "",
        [field]: value,
      },
    }))
  }

  const renderApiDomain = (domain: TenantDomainDTO) => {
    const certificate = certificateForm[domain.id] ?? {
      certificatePem: "",
      privateKeyPem: "",
      chainPem: "",
    }
    const allowlistEntry = allowlistInput[domain.id] ?? ""
    const isManaged = domain.kind === "MANAGED"
    return (
      <div
        key={domain.id}
        className="space-y-3 border-b border-border p-4 last:border-b-0"
      >
        <div className="grid gap-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_1.4fr_auto] md:items-start">
          <div className="font-semibold text-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span>{domain.hostname}</span>
              {domain.isPrimary && (
                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary uppercase">
                  Primary
                </span>
              )}
              <span className="rounded-md border border-border px-2 py-0.5 text-[9px] font-bold text-muted-foreground uppercase">
                {domain.kind}
              </span>
            </div>
            <p className="mt-1 text-[11px] font-normal text-muted-foreground">
              {domain.cluster
                ? `${domain.cluster.name} · ${domain.cluster.region}`
                : "Cluster not assigned"}
            </p>
          </div>
          {isManaged ? (
            <div className="md:col-span-2">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Status
              </p>
              <p className="text-xs text-foreground">
                Included by default and already reachable. You usually
                don&apos;t need to manage DNS or SSL for it.
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  DNS
                </p>
                <p className="text-xs text-foreground">{domain.dnsStatus}</p>
                <p className="text-[10px] text-muted-foreground">
                  {dnsCheckLabel(domain)}
                </p>
                {domain.dnsVerificationReason && (
                  <p className="text-[10px] text-muted-foreground">
                    {domain.dnsVerificationReason}
                  </p>
                )}
                {dnsEvidenceLabel(domain) && (
                  <p className="text-[10px] text-muted-foreground">
                    {dnsEvidenceLabel(domain)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Certificate
                </p>
                <p className="text-xs text-foreground">
                  {certificateLabel(domain)}
                </p>
                {domain.certificate?.validationError && (
                  <p className="text-[11px] text-rose-400">
                    {domain.certificate.validationError}
                  </p>
                )}
              </div>
            </>
          )}
          <div className="text-xs text-muted-foreground">
            <p>{displayValue(domain.endpoint?.managedBaseDomain)}</p>
            <p className="text-[11px]">{domain.cluster?.code || ""}</p>
          </div>
          <div className="flex gap-1 md:justify-end">
            {!isManaged && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busyKey !== null}
                onClick={() =>
                  void runAction(`verify-${domain.id}`, () =>
                    api!.onVerifyDomain(domain.id)
                  )
                }
              >
                Verify
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busyKey !== null}
              onClick={() =>
                void runAction(`delete-${domain.id}`, () =>
                  api!.onDeleteDomain(domain.id)
                )
              }
              aria-label={`Delete domain ${domain.hostname}`}
            >
              <Trash size={14} />
            </Button>
          </div>
        </div>
        {!isManaged && renderDns(domain)}
        {!isManaged && (
          <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 md:grid-cols-3">
            <p className="text-[11px] text-muted-foreground md:col-span-3">
              Only needed if you want to use your own SSL certificate for this
              domain.
            </p>
            {(["certificatePem", "privateKeyPem", "chainPem"] as const).map(
              (field) => (
                <label
                  key={field}
                  className="space-y-1 text-[10px] font-semibold text-muted-foreground"
                >
                  {field === "certificatePem"
                    ? "Certificate PEM"
                    : field === "privateKeyPem"
                      ? "Private key PEM"
                      : "Chain PEM"}
                  <textarea
                    className="min-h-20 w-full rounded-md border border-border bg-background p-2 font-mono text-[10px] text-foreground"
                    value={certificate[field]}
                    onChange={(event) =>
                      updateCertificateField(
                        domain.id,
                        field,
                        event.target.value
                      )
                    }
                    placeholder="Write-only secret material"
                  />
                </label>
              )
            )}
            <Button
              type="button"
              size="sm"
              className="md:col-span-3 md:w-fit"
              disabled={
                busyKey !== null ||
                !certificate.certificatePem ||
                !certificate.privateKeyPem
              }
              onClick={() =>
                void runAction(`certificate-${domain.id}`, async () => {
                  await api!.onUploadCertificate(domain.id, certificate)
                  setCertificateForm((previous) => ({
                    ...previous,
                    [domain.id]: {
                      certificatePem: "",
                      privateKeyPem: "",
                      chainPem: "",
                    },
                  }))
                })
              }
            >
              Save certificate
            </Button>
          </div>
        )}
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
              Allowlist
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center text-muted-foreground hover:text-foreground focus:outline-hidden"
                      aria-label="What does Allowlist do?"
                    >
                      <Info size={12} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px]">
                    Open lets anyone reach this domain. Allowlist only blocks
                    every visitor except the IP ranges you add below.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
            <Select
              value={domain.allowlistMode}
              onValueChange={(value) =>
                void runAction(`allowlist-mode-${domain.id}`, () =>
                  api!.onUpdateAllowlist(
                    domain.id,
                    value as DomainAllowlistMode
                  )
                )
              }
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="ALLOWLIST_ONLY">Allowlist only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              value={allowlistEntry}
              onChange={(event) =>
                setAllowlistInput((previous) => ({
                  ...previous,
                  [domain.id]: event.target.value,
                }))
              }
              placeholder="CIDR, e.g. 203.0.113.0/24"
              className="h-8 max-w-xs text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyKey !== null || !allowlistEntry.trim()}
              onClick={() =>
                void runAction(`allowlist-add-${domain.id}`, async () => {
                  await api!.onAddAllowlistEntry(domain.id, {
                    cidr: allowlistEntry.trim(),
                  })
                  setAllowlistInput((previous) => ({
                    ...previous,
                    [domain.id]: "",
                  }))
                })
              }
            >
              Add entry
            </Button>
          </div>
          {domain.allowlistEntries.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {domain.allowlistEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    {entry.cidr}
                    {entry.label || entry.description
                      ? ` · ${entry.label || entry.description}`
                      : ""}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-rose-400"
                    disabled={busyKey !== null}
                    onClick={() =>
                      void runAction(`allowlist-delete-${entry.id}`, () =>
                        api!.onDeleteAllowlistEntry(domain.id, entry.id)
                      )
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card size="sm" className="border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold text-foreground">
            Custom Domain Settings
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Point a domain you own (e.g. shop.acme.com) to this app, or use the
            free address included below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(domainsError || error) && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
            >
              <span>{domainsError || error}</span>
              {api && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void runAction("retry", api.onRetry)}
                >
                  Retry
                </Button>
              )}
            </div>
          )}
          {apiMode && (
            <form
              onSubmit={handleSubmit}
              className="flex gap-2 rounded-xl border border-border bg-muted/30 p-3"
            >
              <div className="relative flex-1">
                <Globe
                  size={16}
                  className="absolute top-2.5 left-3 text-muted-foreground"
                />
                <Input
                  name="hostname"
                  placeholder="e.g. shop.acme.com"
                  value={newDomain}
                  onChange={(event) => setNewDomain(event.target.value)}
                  className="h-9 pl-9 text-xs"
                />
              </div>
              <Button type="submit" size="sm" disabled={busyKey !== null}>
                Add Domain
              </Button>
            </form>
          )}
          {domainsLoading ? (
            <p className="p-6 text-sm text-muted-foreground">
              Loading domains…
            </p>
          ) : apiMode ? (
            <div className="overflow-hidden rounded-xl border border-border">
              {items.length ? (
                items.map(renderApiDomain)
              ) : (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  No domains mapped yet.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="p-3">Domain</th>
                    <th className="p-3">DNS</th>
                    <th className="p-3">TLS</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {legacyItems.map((item) => (
                    <tr key={item.id} className="border-b border-border">
                      <td className="p-3 font-semibold text-foreground">
                        {item.domain}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {item.dnsStatus}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {item.tlsStatus}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete domain ${item.domain}`}
                          onClick={() => removeLegacy(item.id)}
                        >
                          <Trash size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {legacyItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-xs text-muted-foreground"
                      >
                        No custom domains mapped yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <form
                onSubmit={handleSubmit}
                className="flex gap-2 border-t border-border p-3"
              >
                <Input
                  placeholder="e.g. shop.acme.com"
                  value={newDomain}
                  onChange={(event) => setNewDomain(event.target.value)}
                  className="h-9 text-xs"
                />
                <Button type="submit" size="sm">
                  Add Domain
                </Button>
              </form>
            </div>
          )}
          {apiMode && items.some((domain) => domain.kind === "CUSTOM") && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-xs">
              <span className="flex items-center gap-2 font-bold text-foreground">
                <Wrench size={15} className="text-primary" /> DNS configuration
              </span>
              <p className="text-[11px] text-muted-foreground">
                Use the exact records shown for each domain above. Targets are
                supplied by the selected cluster.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      {apiMode && (
        <Card size="sm" className="h-fit border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              Domain endpoint
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Region and ingress details are persisted by the selected
              application cluster.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-2.5">
              <span className="font-mono text-xs font-semibold text-primary">
                https://{items[0]?.hostname || `${stackSlug}.pfnapp.my.id`}
              </span>
              {renderCopyButton(
                `https://${items[0]?.hostname || `${stackSlug}.pfnapp.my.id`}`,
                "endpoint-url"
              )}
            </div>
            <p>
              Stack:{" "}
              <span className="font-mono text-foreground">{stackSlug}</span>
            </p>
            {items[0]?.cluster && (
              <p>
                Region:{" "}
                <span className="text-foreground">
                  {items[0].cluster.region}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <Card size="sm" className="border-border bg-card shadow-sm">
        <Collapsible open={proxyOpen} onOpenChange={setProxyOpen}>
          <CardHeader className="pb-2">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <ArrowsLeftRight size={18} className="text-primary" /> Reverse
                  Proxy Ingress
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Advanced — only relevant if you sit behind Cloudflare, an ALB,
                  or another proxy
                </CardDescription>
              </div>
              <CaretDown
                size={16}
                className={cn(
                  "shrink-0 text-muted-foreground transition-transform",
                  proxyOpen && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="flex flex-col gap-4 text-xs leading-relaxed">
              <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    Trust Forwarded Headers
                  </span>
                  <Switch
                    checked={trustProxy}
                    onCheckedChange={setTrustProxy}
                    aria-label="Trust Forwarded Headers"
                  />
                </div>
                <p className="text-[11px] leading-normal text-muted-foreground">
                  Configures nginx and the application setting{" "}
                  <code className="rounded border border-border/50 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                    TRUST_PROXIES=*
                  </code>
                  .
                </p>
              </div>

              <div className="flex flex-col gap-2 border-l-2 border-blue-500/40 pl-3">
                <h4 className="text-xs leading-tight font-bold text-foreground">
                  User IP Resolution
                </h4>
                <p className="text-[11px] leading-normal text-muted-foreground">
                  When deployed behind Cloudflare, an ALB, or an Ingress, client
                  requests can otherwise show internal cluster IPs in
                  application logs.
                </p>
                <p className="text-[11px] leading-normal font-medium text-muted-foreground">
                  Trusting forwarded headers lets the application read the
                  client&apos;s{" "}
                  <code className="font-mono text-foreground">
                    X-Forwarded-For
                  </code>{" "}
                  value.
                </p>
                {trustProxy ? (
                  <span className="text-[11px] font-semibold text-emerald-400">
                    Trust proxies is active. Real client IPs will be available
                    to application code.
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Off by default. Turn this on only if you&apos;re behind a
                    proxy and need real client IPs in your app.
                  </span>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}

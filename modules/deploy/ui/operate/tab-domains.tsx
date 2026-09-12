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
import type { AppMessages } from "@/lib/i18n/messages/types"
import type {
  CustomDomain,
  DomainAllowlistMode,
  TenantDomainDTO,
  K8sEnvironmentId,
} from "@/modules/deploy/operate.types"

export type DomainsPanelMessages =
  AppMessages["console"]["app"]["settings"]["domainsPanel"]

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
  messages: DomainsPanelMessages
}

const displayValue = (
  t: DomainsPanelMessages,
  value: string | null | undefined
) => value || t.notConfigured

const certificateLabel = (t: DomainsPanelMessages, domain: TenantDomainDTO) => {
  const certificate = domain.certificate
  if (!certificate) return t.notConfigured
  const status = certificate.status || t.certificateUnknownStatus
  const expiry = certificate.expiresAt
    ? `${t.certificateExpiresPrefix}${new Date(certificate.expiresAt).toLocaleDateString()}`
    : ""
  return `${certificate.source || t.unknownSource} · ${status}${expiry}`
}
const dnsCheckLabel = (t: DomainsPanelMessages, domain: TenantDomainDTO) => {
  if (!domain.dnsLastCheckedAt) return t.notCheckedYet
  const checkedAt = new Date(domain.dnsLastCheckedAt)
  return Number.isNaN(checkedAt.getTime())
    ? t.checkedFallback
    : t.checkedAt.replace("{value}", checkedAt.toLocaleString())
}

const dnsEvidenceLabel = (t: DomainsPanelMessages, domain: TenantDomainDTO) => {
  const evidence = domain.dnsResolverEvidence ?? []
  if (evidence.length === 0) return null
  const providers = new Set(
    evidence
      .filter((item) => item.outcome === "MATCH")
      .map((item) => item.provider)
  )
  return providers.size > 0
    ? t.matchedBy.replace("{value}", Array.from(providers).join(" + "))
    : t.noResolverMatch
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
  messages: t,
}: TabDomainsProps) {
  const apiMode = Boolean(stackSlug && api)
  const legacyItems = domains?.[selectedEnv] ?? []
  const items = apiMode ? apiDomains : []
  const primaryDomain = items.find((domain) => domain.isPrimary) ?? items[0]
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
      setError(cause instanceof Error ? cause.message : t.saveError)
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
      aria-label={t.copyAria}
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
          {t.dnsTargetsLabel}
        </p>
        {records.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.dnsTargetsEmpty}</p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">
              {t.dnsTargetsHint}
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
                  {t.primaryBadge}
                </span>
              )}
              <span className="rounded-md border border-border px-2 py-0.5 text-[9px] font-bold text-muted-foreground uppercase">
                {isManaged ? t.kindManaged : t.kindCustom}
              </span>
            </div>
            <p className="mt-1 text-[11px] font-normal text-muted-foreground">
              {domain.cluster
                ? `${domain.cluster.name} · ${domain.cluster.region}`
                : t.clusterNotAssigned}
            </p>
          </div>
          {isManaged ? (
            <div className="md:col-span-2">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                {t.managedStatusLabel}
              </p>
              <p className="text-xs text-foreground">{t.managedStatusText}</p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  {t.dnsLabel}
                </p>
                <p className="text-xs text-foreground">{domain.dnsStatus}</p>
                <p className="text-[10px] text-muted-foreground">
                  {dnsCheckLabel(t, domain)}
                </p>
                {domain.dnsVerificationReason && (
                  <p className="text-[10px] text-muted-foreground">
                    {domain.dnsVerificationReason}
                  </p>
                )}
                {dnsEvidenceLabel(t, domain) && (
                  <p className="text-[10px] text-muted-foreground">
                    {dnsEvidenceLabel(t, domain)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  {t.certificateHeading}
                </p>
                <p className="text-xs text-foreground">
                  {certificateLabel(t, domain)}
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
            <p>{displayValue(t, domain.endpoint?.managedBaseDomain)}</p>
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
                {t.verify}
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
              aria-label={t.deleteAria.replace("{hostname}", domain.hostname)}
            >
              <Trash size={14} />
            </Button>
          </div>
        </div>
        {!isManaged && renderDns(domain)}
        {!isManaged && (
          <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 md:grid-cols-3">
            <p className="text-[11px] text-muted-foreground md:col-span-3">
              {t.certificateHint}
            </p>
            {(["certificatePem", "privateKeyPem", "chainPem"] as const).map(
              (field) => (
                <label
                  key={field}
                  className="space-y-1 text-[10px] font-semibold text-muted-foreground"
                >
                  {field === "certificatePem"
                    ? t.certificatePemLabel
                    : field === "privateKeyPem"
                      ? t.privateKeyPemLabel
                      : t.chainPemLabel}
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
                    placeholder={t.pemPlaceholder}
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
              {t.saveCertificate}
            </Button>
          </div>
        )}
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
              {t.allowlistLabel}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center text-muted-foreground hover:text-foreground focus:outline-hidden"
                      aria-label={t.allowlistTooltipAria}
                    >
                      <Info size={12} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px]">
                    {t.allowlistTooltipContent}
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
                <SelectItem value="OPEN">{t.allowlistOpen}</SelectItem>
                <SelectItem value="ALLOWLIST_ONLY">
                  {t.allowlistRestricted}
                </SelectItem>
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
              placeholder={t.cidrPlaceholder}
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
              {t.addEntry}
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
                    {t.removeEntry}
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
            {t.cardTitle}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {t.cardDescription}
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
                  {t.retry}
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
                  placeholder={t.addPlaceholder}
                  value={newDomain}
                  onChange={(event) => setNewDomain(event.target.value)}
                  className="h-9 pl-9 text-xs"
                />
              </div>
              <Button type="submit" size="sm" disabled={busyKey !== null}>
                {t.addButton}
              </Button>
            </form>
          )}
          {domainsLoading ? (
            <p className="p-6 text-sm text-muted-foreground">{t.loading}</p>
          ) : apiMode ? (
            <div className="overflow-hidden rounded-xl border border-border">
              {items.length ? (
                items.map(renderApiDomain)
              ) : (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  {t.empty}
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
                <Wrench size={15} className="text-primary" /> {t.dnsConfigTitle}
              </span>
              <p className="text-[11px] text-muted-foreground">
                {t.dnsConfigDescription}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      {apiMode && (
        <Card size="sm" className="h-fit border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              {t.primaryUrlTitle}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {t.primaryUrlDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-2.5">
              <span className="font-mono text-xs font-semibold text-primary">
                https://
                {primaryDomain?.hostname || `${stackSlug}.pfnapp.my.id`}
              </span>
              {renderCopyButton(
                `https://${primaryDomain?.hostname || `${stackSlug}.pfnapp.my.id`}`,
                "endpoint-url"
              )}
            </div>
            <p>
              {t.stackLabel}{" "}
              <span className="font-mono text-foreground">{stackSlug}</span>
            </p>
            {primaryDomain?.cluster && (
              <p>
                {t.regionLabel}{" "}
                <span className="text-foreground">
                  {primaryDomain.cluster.region}
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
                  <ArrowsLeftRight size={18} className="text-primary" />{" "}
                  {t.proxyTitle}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {t.proxyDescription}
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
                    {t.trustHeadersLabel}
                  </span>
                  <Switch
                    checked={trustProxy}
                    onCheckedChange={setTrustProxy}
                    aria-label={t.trustHeadersLabel}
                  />
                </div>
                <p className="text-[11px] leading-normal text-muted-foreground">
                  {t.trustHeadersHintPrefix}
                  <code className="rounded border border-border/50 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                    TRUST_PROXIES=*
                  </code>
                  {t.trustHeadersHintSuffix}
                </p>
              </div>

              <div className="flex flex-col gap-2 border-l-2 border-blue-500/40 pl-3">
                <h4 className="text-xs leading-tight font-bold text-foreground">
                  {t.ipResolutionTitle}
                </h4>
                <p className="text-[11px] leading-normal text-muted-foreground">
                  {t.ipResolutionBody1}
                </p>
                <p className="text-[11px] leading-normal font-medium text-muted-foreground">
                  {t.ipResolutionBody2Prefix}
                  <code className="font-mono text-foreground">
                    X-Forwarded-For
                  </code>
                  {t.ipResolutionBody2Suffix}
                </p>
                {trustProxy ? (
                  <span className="text-[11px] font-semibold text-emerald-400">
                    {t.trustActive}
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t.trustInactive}
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

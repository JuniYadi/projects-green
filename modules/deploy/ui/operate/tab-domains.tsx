"use client"

import { useState } from "react"
import {
  Globe,
  Trash,
  CheckCircle,
  Warning,
  ShieldCheck,
  ShieldWarning,
  ArrowClockwise,
  Wrench,
  Copy,
  Check,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type {
  K8sEnvironmentId,
  CustomDomain,
} from "@/modules/deploy/operate.types"

type TabDomainsProps = {
  selectedEnv: K8sEnvironmentId
  domains: Record<K8sEnvironmentId, CustomDomain[]>
  setDomains: React.Dispatch<
    React.SetStateAction<Record<K8sEnvironmentId, CustomDomain[]>>
  >
}

export function TabDomains({
  selectedEnv,
  domains,
  setDomains,
}: TabDomainsProps) {
  const [newDomain, setNewDomain] = useState("")
  const [newDomainTls, setNewDomainTls] = useState<
    "active" | "expired" | "pending"
  >("active")

  const [cloudflareProxied, setCloudflareProxied] = useState(true)
  const [cloudflareSslMode, setCloudflareSslMode] = useState<
    "flexible" | "full" | "strict"
  >("flexible")

  // Copy state helper
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDomain.trim()) return

    const newObj: CustomDomain = {
      id: `dom-${Date.now()}`,
      domain: newDomain.trim(),
      isPrimary: domains[selectedEnv].length === 0,
      tlsStatus: newDomainTls,
      dnsStatus: "unverified",
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    }

    setDomains((prev) => ({
      ...prev,
      [selectedEnv]: [...prev[selectedEnv], newObj],
    }))
    setNewDomain("")
  }

  const handleDeleteDomain = (id: string) => {
    setDomains((prev) => {
      const currentDomains = prev[selectedEnv]
      const removedDomain = currentDomains.find((domain) => domain.id === id)
      const remainingDomains = currentDomains.filter(
        (domain) => domain.id !== id
      )

      return {
        ...prev,
        [selectedEnv]: removedDomain?.isPrimary
          ? remainingDomains.map((domain, index) => ({
              ...domain,
              isPrimary: index === 0,
            }))
          : remainingDomains,
      }
    })
  }

  const handleForceSSL = (id: string) => {
    setDomains((prev) => ({
      ...prev,
      [selectedEnv]: prev[selectedEnv].map((d) => {
        if (d.id === id) {
          return {
            ...d,
            tlsStatus: "active" as const,
            dnsStatus: "verified" as const,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
          }
        }
        return d
      }),
    }))
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Custom Domains list */}
      <Card size="sm" className="col-span-2 border-white/[0.08] bg-[#0A0A0C]/50 shadow-xl backdrop-blur-md">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold text-white">
            Custom Domain Settings
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Bind domain endpoints to your ingress router and issue automated SSL certificates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Domain Input Form */}
          <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row gap-3 rounded-xl border border-white/[0.06] bg-neutral-900/35 p-3.5">
            <div className="relative flex-1">
              <Globe
                size={16}
                className="absolute top-3 left-3 text-muted-foreground"
              />
              <Input
                placeholder="e.g. shop.acme.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>
            <Select
              value={newDomainTls}
              onValueChange={(value) =>
                setNewDomainTls(value as "active" | "expired" | "pending")
              }
            >
              <SelectTrigger className="h-9 w-full sm:w-[180px] bg-black/50 text-xs rounded-xl border-white/[0.08]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active SSL</SelectItem>
                <SelectItem value="pending">Pending Verification</SelectItem>
                <SelectItem value="expired">
                  Expired SSL (Simulation)
                </SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" className="h-9 text-xs font-semibold rounded-xl px-4">
              Add Domain
            </Button>
          </form>

          {/* Domain Table */}
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/10">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                    <th className="p-3.5 px-4">Domain</th>
                    <th className="p-3.5 px-4">DNS Status</th>
                    <th className="p-3.5 px-4">TLS Certificate</th>
                    <th className="p-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {domains[selectedEnv].map((item) => (
                    <tr
                      key={item.id}
                      className="transition-all hover:bg-white/[0.01]"
                    >
                      <td className="p-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          {item.domain}
                          {item.isPrimary && (
                            <span className="py-0.5 rounded-md border border-primary/30 bg-primary/10 px-2 text-[9px] font-bold text-primary uppercase tracking-wide">
                              Primary
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 px-4">
                        {item.dnsStatus === "verified" ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                            <CheckCircle size={13} /> Target verified
                          </span>
                        ) : (
                          <span className="inline-flex animate-pulse items-center gap-1.5 font-semibold text-amber-400">
                            <Warning size={13} /> Pending propagation
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 px-4">
                        {item.tlsStatus === "active" && (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                            <ShieldCheck size={14} className="text-emerald-400" /> Active (expires{" "}
                            {item.expiresAt})
                          </span>
                        )}
                        {item.tlsStatus === "expired" && (
                          <span className="inline-flex items-center gap-1.5 font-bold text-rose-400">
                            <ShieldWarning size={14} className="text-rose-400" /> EXPIRED ({item.expiresAt})
                          </span>
                        )}
                        {item.tlsStatus === "pending" && (
                          <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                            <ArrowClockwise size={14} className="animate-spin text-amber-400" />{" "}
                            Issuing certificate...
                          </span>
                        )}
                      </td>
                      <td className="space-x-2 p-3.5 px-4 text-right">
                        {item.tlsStatus === "expired" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleForceSSL(item.id)}
                            className="h-7 border-amber-500/30 px-3 text-[10px] text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/60 rounded-lg font-semibold"
                          >
                            Force Renew SSL
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteDomain(item.id)}
                          aria-label={`Delete domain ${item.domain}`}
                          title={`Delete domain ${item.domain}`}
                          className="h-7 w-7 p-0 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-lg transition-all"
                        >
                          <Trash size={13} />
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {domains[selectedEnv].length === 0 && (
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
            </div>
          </div>

          {/* DNS instructions card */}
          <div className="space-y-3.5 rounded-xl border border-white/[0.06] bg-neutral-900/35 p-4 text-xs">
            <div className="space-y-1">
              <span className="flex items-center gap-2 font-bold text-white">
                <Wrench size={15} className="text-primary" /> DNS Configuration Requirements
              </span>
              <p className="text-muted-foreground text-[11px]">
                Configure these DNS records in your domain registrar panel to map traffic to this application.
              </p>
            </div>

            <div className="grid gap-2.5 font-mono text-[11px] mt-2">
              <div className="grid grid-cols-4 items-center rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 font-sans font-bold text-muted-foreground text-[10px] uppercase tracking-wider">
                <span>Type</span>
                <span>Host</span>
                <span className="col-span-2">Value / Target</span>
              </div>
              <div className="grid grid-cols-4 items-center rounded-xl border border-white/[0.06] p-2.5 bg-black/20">
                <span className="font-bold text-emerald-400">A</span>
                <span className="text-white">@</span>
                <span className="col-span-2 flex items-center justify-between text-white truncate">
                  <span className="truncate pr-2">76.76.21.21</span>
                  <Button
                    type="button"
                    onClick={() => handleCopy("76.76.21.21", "a-record")}
                    variant="ghost"
                    size="xs"
                    aria-label="Copy"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-white"
                  >
                    {copiedKey === "a-record" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </Button>
                </span>
              </div>
              <div className="grid grid-cols-4 items-center rounded-xl border border-white/[0.06] p-2.5 bg-black/20">
                <span className="font-bold text-emerald-400">CNAME</span>
                <span className="text-white">www</span>
                <span className="col-span-2 flex items-center justify-between text-white truncate">
                  <span className="truncate pr-2">laravel-shop.projects-green.dev</span>
                  <Button
                    type="button"
                    onClick={() => handleCopy("laravel-shop.projects-green.dev", "cname-record")}
                    variant="ghost"
                    size="xs"
                    aria-label="Copy"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-white"
                  >
                    {copiedKey === "cname-record" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </Button>
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cloudflare Troubleshooting Guides */}
      <Card size="sm" className="border-white/[0.08] bg-[#0A0A0C]/50 shadow-xl backdrop-blur-md h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
            <Globe size={18} className="text-orange-500" /> Cloudflare Advisory
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Avoid issues when routing custom domains behind Cloudflare proxying
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs leading-relaxed">
          {/* Cloudflare config options simulator */}
          <div className="space-y-3 rounded-xl border border-white/[0.06] bg-neutral-900/35 p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">
                Proxy Status
              </span>
              <Button
                type="button"
                onClick={() => setCloudflareProxied(!cloudflareProxied)}
                variant="ghost"
                size="xs"
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  cloudflareProxied
                    ? "border border-orange-500/30 bg-orange-500/10 text-orange-400"
                    : "border border-white/10 bg-white/10 text-muted-foreground"
                }`}
              >
                {cloudflareProxied
                  ? "Proxied"
                  : "DNS Only"}
              </Button>
            </div>

            <div className="space-y-1.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                SSL/TLS Mode
              </span>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/[0.06] bg-black/60 p-0.5">
                {(["flexible", "full", "strict"] as const).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    onClick={() => setCloudflareSslMode(m)}
                    variant="ghost"
                    size="xs"
                    className={`rounded-md py-1 text-[10px] font-bold capitalize transition-all ${
                      cloudflareSslMode === m
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Questions explanation cards */}
          <div className="space-y-3">
            <div className="space-y-1.5 border-l-2 border-orange-500/40 pl-3">
              <h4 className="font-bold text-white leading-tight">
                SSL Failures Behind Proxy
              </h4>
              <p className="text-[11px] text-muted-foreground">
                If Cloudflare proxy is active before SSL is verified, automated HTTP challenge challenges might fail.
              </p>
              <p className="text-[11px] font-semibold text-primary">
                Tip: Switch to &quot;DNS Only&quot; until SSL is active, then re-enable proxy.
              </p>
            </div>

            <div className="space-y-1.5 border-l-2 border-rose-500/40 pl-3">
              <h4 className="font-bold text-white leading-tight">
                Redirect Loops (ERR_TOO_MANY_REDIRECTS)
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Flexible SSL mode forces Cloudflare to access cluster over HTTP. Redirection from HTTP to HTTPS creates an infinite loop.
              </p>
              <p
                className={`text-[11px] font-semibold ${cloudflareSslMode === "flexible" ? "text-amber-400 underline underline-offset-2" : "text-emerald-400"}`}
              >
                {cloudflareSslMode === "flexible"
                  ? "⚠️ Switch Cloudflare SSL setting to 'Full' or 'Full (strict)'."
                  : "✓ SSL mode Full/Strict prevents redirection loops."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

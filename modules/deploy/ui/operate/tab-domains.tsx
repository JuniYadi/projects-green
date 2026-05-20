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
    setDomains((prev) => ({
      ...prev,
      [selectedEnv]: prev[selectedEnv].filter((d) => d.id !== id),
    }))
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
      <Card className="col-span-2 border-white/[0.06] bg-black/25">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white">
            Custom Domain Settings
          </CardTitle>
          <CardDescription>
            Bind domain endpoints to your ingress router and issue automated SSL
            certs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Domain Input Form */}
          <form onSubmit={handleAddDomain} className="flex gap-2">
            <div className="relative flex-1">
              <Globe
                size={18}
                className="absolute left-3 top-3 text-muted-foreground"
              />
              <Input
                placeholder="e.g. shop.acme.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={newDomainTls}
              onChange={(e) =>
                setNewDomainTls(
                  e.target.value as "active" | "expired" | "pending"
                )
              }
              className="bg-black/50 text-white rounded-lg border border-white/[0.1] px-3 text-sm focus:outline-none"
            >
              <option value="active">Active SSL</option>
              <option value="pending">Pending Verification</option>
              <option value="expired">Expired SSL (Simulation)</option>
            </select>
            <Button type="submit">Add Domain</Button>
          </form>

          {/* Domain Table */}
          <div className="rounded-lg border border-white/[0.08] overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/[0.08] text-muted-foreground uppercase font-semibold">
                  <th className="p-3">Domain</th>
                  <th className="p-3">DNS Status</th>
                  <th className="p-3">TLS Certificate</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {domains[selectedEnv].map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-white/[0.01] transition-all"
                  >
                    <td className="p-3 font-medium text-white">
                      <div className="flex items-center gap-1.5">
                        {item.domain}
                        {item.isPrimary && (
                          <span className="bg-primary/20 text-primary border border-primary/30 text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase">
                            Primary
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {item.dnsStatus === "verified" ? (
                        <span className="inline-flex items-center gap-1 text-green-400">
                          <CheckCircle size={12} /> Target verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-yellow-400 animate-pulse">
                          <Warning size={12} /> Pending propagation
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {item.tlsStatus === "active" && (
                        <span className="inline-flex items-center gap-1 text-green-400">
                          <ShieldCheck size={14} /> Active (expires{" "}
                          {item.expiresAt})
                        </span>
                      )}
                      {item.tlsStatus === "expired" && (
                        <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                          <ShieldWarning size={14} /> EXPIRED ({item.expiresAt})
                        </span>
                      )}
                      {item.tlsStatus === "pending" && (
                        <span className="inline-flex items-center gap-1 text-yellow-400">
                          <ArrowClockwise
                            size={14}
                            className="animate-spin"
                          />{" "}
                          Issuing certificate...
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      {item.tlsStatus === "expired" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleForceSSL(item.id)}
                          className="h-7 px-2 text-[10px] border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                        >
                          Force Renew SSL
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteDomain(item.id)}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}

                {domains[selectedEnv].length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-6 text-center text-muted-foreground"
                    >
                      No custom domains mapped yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* DNS instructions card (Q2 Answer) */}
          <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5 space-y-4 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Wrench size={16} className="text-primary" /> DNS Configuration
                Requirements
              </span>
              <p className="text-muted-foreground">
                Configure these DNS records in your domain registrar panel to map
                traffic to this application.
              </p>
            </div>

            <div className="grid gap-3 font-mono text-[11px]">
              <div className="grid grid-cols-4 bg-white/[0.02] border border-white/[0.08] p-2.5 rounded-lg items-center">
                <span className="text-muted-foreground font-semibold">
                  TYPE
                </span>
                <span className="text-muted-foreground font-semibold">
                  HOST
                </span>
                <span className="text-muted-foreground font-semibold col-span-2">
                  VALUE / TARGET
                </span>
              </div>
              <div className="grid grid-cols-4 border border-white/[0.06] p-2.5 rounded-lg items-center">
                <span className="text-green-400 font-bold">A</span>
                <span className="text-white">@</span>
                <span className="text-white col-span-2 flex items-center justify-between">
                  76.76.21.21
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText("76.76.21.21")
                    }
                    className="text-[10px] text-primary hover:underline font-sans cursor-pointer"
                  >
                    Copy
                  </button>
                </span>
              </div>
              <div className="grid grid-cols-4 border border-white/[0.06] p-2.5 rounded-lg items-center">
                <span className="text-green-400 font-bold">CNAME</span>
                <span className="text-white">www</span>
                <span className="text-white col-span-2 flex items-center justify-between">
                  laravel-shop.projects-green.dev
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        "laravel-shop.projects-green.dev"
                      )
                    }
                    className="text-[10px] text-primary hover:underline font-sans cursor-pointer"
                  >
                    Copy
                  </button>
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cloudflare Troubleshooting Guides (Q9, Q10 Answers) */}
      <Card className="border-white/[0.06] bg-black/25 space-y-4">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white flex items-center gap-1.5">
            <Globe size={18} className="text-orange-500" /> Cloudflare Advisory
          </CardTitle>
          <CardDescription>
            Avoid issues when routing custom domains behind Cloudflare proxying
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs leading-relaxed">
          {/* Cloudflare config options simulator */}
          <div className="rounded-lg bg-black/40 border border-white/[0.06] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">
                Cloudflare Proxy Status
              </span>
              <button
                type="button"
                onClick={() => setCloudflareProxied(!cloudflareProxied)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                  cloudflareProxied
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "bg-white/10 text-muted-foreground border border-white/10"
                }`}
              >
                {cloudflareProxied
                  ? "Proxied (Orange Cloud)"
                  : "DNS Only (Grey Cloud)"}
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground block text-[10px]">
                Cloudflare SSL/TLS Encryption Mode:
              </span>
              <div className="grid grid-cols-3 gap-1 bg-black/60 rounded border border-white/[0.06] p-0.5">
                {(["flexible", "full", "strict"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCloudflareSslMode(m)}
                    className={`rounded py-1 text-[9px] font-bold capitalize transition-all ${
                      cloudflareSslMode === m
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Question 9 Explanation */}
          <div className="space-y-1.5 border-l-2 border-orange-500/40 pl-3">
            <h4 className="font-bold text-white text-[13px]">
              SSL Failures Behind Proxy
            </h4>
            <p className="text-muted-foreground text-[11px]">
              If Cloudflare proxy is active before we verify your custom domain,
              our system&apos;s Let&apos;s Encrypt automated HTTP challenge
              might fail. Cloudflare intercepts verification traffic.
            </p>
            <p className="font-semibold text-primary text-[11px]">
              Recommendation: Temporarily switch Cloudflare to &quot;DNS
              Only&quot; (Grey Cloud) until SSL is issued. Once active, proxy can
              be re-enabled.
            </p>
          </div>

          {/* Question 10 Explanation */}
          <div className="space-y-1.5 border-l-2 border-red-500/40 pl-3">
            <h4 className="font-bold text-white text-[13px]">
              Redirect Loops (ERR_TOO_MANY_REDIRECTS)
            </h4>
            <p className="text-muted-foreground text-[11px]">
              Using &quot;Flexible&quot; SSL forces Cloudflare to access our
              cluster over HTTP (port 80). Since our router mandates HTTPS
              redirection, it redirects Cloudflare back to HTTPS, causing an
              infinite loop.
            </p>
            <p
              className={`font-semibold text-[11px] ${cloudflareSslMode === "flexible" ? "text-yellow-400 underline" : "text-green-400"}`}
            >
              {cloudflareSslMode === "flexible"
                ? "⚠️ Current Config: Flexible mode will trigger a loop. Change Cloudflare SSL setting to 'Full' or 'Full (strict)'."
                : "✓ Safe Config: SSL mode set to Full/Strict prevents redirection loops."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

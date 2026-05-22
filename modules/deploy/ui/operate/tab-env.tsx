"use client"

import { useState } from "react"
import {
  Plus,
  Trash,
  Eye,
  EyeSlash,
  ArrowsLeftRight,
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
import { Textarea } from "@/components/ui/textarea"

import type { K8sEnvironmentId, EnvVar } from "@/modules/deploy/operate.types"

type TabEnvProps = {
  selectedEnv: K8sEnvironmentId
  envVars: Record<K8sEnvironmentId, EnvVar[]>
  setEnvVars: React.Dispatch<
    React.SetStateAction<Record<K8sEnvironmentId, EnvVar[]>>
  >
}

export function TabEnv({ selectedEnv, envVars, setEnvVars }: TabEnvProps) {
  const [newEnvKey, setNewEnvKey] = useState("")
  const [newEnvVal, setNewEnvVal] = useState("")
  const [newEnvSecret, setNewEnvSecret] = useState(false)
  const [bulkEnvText, setBulkEnvText] = useState("")
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>(
    {}
  )

  const [trustProxy, setTrustProxy] = useState(false)

  const handleAddEnv = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEnvKey.trim()) return
    const sanitizedKey = newEnvKey.toUpperCase().replace(/[^A-Z0-9_]/g, "")
    if (!sanitizedKey) return

    const newObj: EnvVar = {
      id: `env-${Date.now()}`,
      key: sanitizedKey,
      value: newEnvVal,
      isSecret: newEnvSecret,
      updatedAt: new Date().toISOString().split("T")[0],
    }

    setEnvVars((prev) => ({
      ...prev,
      [selectedEnv]: [...prev[selectedEnv], newObj],
    }))
    setNewEnvKey("")
    setNewEnvVal("")
    setNewEnvSecret(false)
  }

  const handleDeleteEnv = (id: string) => {
    setEnvVars((prev) => ({
      ...prev,
      [selectedEnv]: prev[selectedEnv].filter((e) => e.id !== id),
    }))
  }

  const handleBulkEnvImport = () => {
    if (!bulkEnvText.trim()) return
    const lines = bulkEnvText.split("\n")
    const newVars: EnvVar[] = []
    const now = new Date().toISOString().split("T")[0]

    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) return

      const eqIdx = trimmed.indexOf("=")
      if (eqIdx > 0) {
        const key = trimmed
          .substring(0, eqIdx)
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_]/g, "")
        if (!key) return
        let val = trimmed.substring(eqIdx + 1).trim()

        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.substring(1, val.length - 1)
        }

        const isSecret =
          key.includes("PASS") ||
          key.includes("KEY") ||
          key.includes("SECRET") ||
          key.includes("TOKEN")

        newVars.push({
          id: `env-bulk-${idx}-${Date.now()}`,
          key,
          value: val,
          isSecret,
          updatedAt: now,
        })
      }
    })

    setEnvVars((prev) => ({
      ...prev,
      [selectedEnv]: [...prev[selectedEnv], ...newVars],
    }))
    setBulkEnvText("")
    setIsBulkOpen(false)
  }

  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-3">
        {/* Env List & CRUD */}
        <Card size="sm" className="col-span-2 border-white/[0.08] bg-[#0A0A0C]/50 shadow-xl backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="space-y-1">
              <CardTitle className="text-base font-bold text-white">
                Environment Variables
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Manage environment parameters injected into container pods at runtime
              </CardDescription>
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsBulkOpen(true)}
                className="h-8 border-white/[0.08] text-xs px-3 hover:bg-white/[0.04]"
              >
                Bulk Import .env
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Env Var Form */}
            <form
              onSubmit={handleAddEnv}
              className="space-y-4 rounded-xl border border-white/[0.06] bg-neutral-900/30 p-4 transition-all hover:border-white/[0.1] hover:bg-neutral-900/50"
            >
              <div className="text-xs font-semibold text-white/80">Add Environment Variable</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Key / Name</label>
                  <Input
                    placeholder="KEY (e.g. CACHE_DRIVER)"
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value)}
                    className="h-9 bg-black/40 border-white/[0.08] text-xs uppercase focus:border-primary/50 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Value</label>
                  <Input
                    placeholder="Value"
                    value={newEnvVal}
                    onChange={(e) => setNewEnvVal(e.target.value)}
                    className="h-9 bg-black/40 border-white/[0.08] text-xs focus:border-primary/50 font-mono"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNewEnvSecret(!newEnvSecret)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      newEnvSecret ? "bg-primary" : "bg-neutral-800"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        newEnvSecret ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span
                    className="text-xs text-muted-foreground select-none cursor-pointer"
                    onClick={() => setNewEnvSecret(!newEnvSecret)}
                  >
                    Encrypt as Secret (values masked in dashboard/logs)
                  </span>
                </div>
                <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs px-4 bg-primary hover:bg-primary/95 text-white font-medium">
                  <Plus size={14} className="font-bold" /> Add Var
                </Button>
              </div>
            </form>

            {/* Env List */}
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/20 text-xs">
              <div className="grid grid-cols-12 border-b border-white/[0.08] bg-white/[0.02] p-3 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                <span className="col-span-5">Name / Key</span>
                <span className="col-span-5">Value</span>
                <span className="col-span-2 text-right">Actions</span>
              </div>

              <div className="max-h-[350px] divide-y divide-white/[0.06] overflow-y-auto">
                {envVars[selectedEnv].map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 items-center p-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="col-span-5 pr-2 font-mono font-bold break-all text-white flex flex-wrap items-center gap-1.5">
                      <span className="tracking-tight text-white/95">{item.key}</span>
                      {item.isSecret && (
                        <span className="py-0.5 rounded border border-red-500/20 bg-red-500/10 px-1.5 font-mono text-[8px] font-bold text-red-400">
                          SECRET
                        </span>
                      )}
                    </div>
                    <div className="col-span-5 font-mono break-all text-muted-foreground text-xs">
                      {item.isSecret && !visibleSecrets[item.id] ? (
                        <span className="tracking-widest text-[8px] opacity-40">••••••••••••••••</span>
                      ) : (
                        <span className="text-white/80">{item.value}</span>
                      )}
                    </div>
                    <div className="col-span-2 space-x-1 text-right flex justify-end items-center">
                      {item.isSecret && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSecretVisibility(item.id)}
                          aria-label={
                            visibleSecrets[item.id]
                              ? `Hide secret for ${item.key}`
                              : `Show secret for ${item.key}`
                          }
                          className="h-7 w-7 p-0 text-muted-foreground hover:bg-white/[0.06] hover:text-white"
                        >
                          {visibleSecrets[item.id] ? (
                            <EyeSlash size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEnv(item.id)}
                        aria-label={`Delete environment variable ${item.key}`}
                        className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
                {envVars[selectedEnv].length === 0 && (
                  <div className="p-6 text-center text-muted-foreground font-medium">
                    No environment variables defined for {selectedEnv}.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reverse Proxy / Trust Proxy Configuration */}
        <Card size="sm" className="col-span-1 border-white/[0.08] bg-[#0A0A0C]/50 shadow-xl backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
              <ArrowsLeftRight size={18} className="text-primary" /> Reverse Proxy Ingress
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Trust proxy headers to capture authentic client metadata
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs leading-relaxed">
            <div className="space-y-3.5 rounded-xl border border-white/[0.06] bg-black/40 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">
                  Trust Forwarded Headers
                </span>
                <button
                  type="button"
                  onClick={() => setTrustProxy(!trustProxy)}
                  className={`relative inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all duration-200 focus:outline-none ${
                    trustProxy 
                      ? "bg-primary text-white" 
                      : "bg-neutral-800 text-muted-foreground border border-white/5"
                  }`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      trustProxy ? "bg-white animate-pulse" : "bg-neutral-500"
                    }`}
                  />
                  {trustProxy ? "TRUST ACTIVE" : "DISABLED"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-normal">
                Configures nginx and application environment variable:{" "}
                <code className="text-white font-mono bg-white/5 px-1 py-0.5 rounded text-[10px]">TRUST_PROXIES=*</code>.
              </p>
            </div>

            <div className="space-y-2 border-l-2 border-blue-500/40 pl-3">
              <h4 className="text-xs font-bold text-white leading-tight">
                User IP Resolution
              </h4>
              <p className="text-[11px] text-muted-foreground leading-normal">
                When deployed behind proxy loads (like Cloudflare, ALB, or local nginx Ingress), client requests show internal local cluster IPs (e.g. <code className="font-mono text-white/90">10.0.12.33</code>) in application logging.
              </p>
              <p className="text-[11px] text-muted-foreground leading-normal font-medium">
                Enabling &quot;Trust Forwarded Headers&quot; commands the application server to read client parameters from the <code className="font-mono text-white/90">X-Forwarded-For</code> header sent by proxies.
              </p>
              {trustProxy ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  ✓ Trust proxies is active. Real client IPs will show in application code (request()-&gt;ip()).
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                  ⚠️ Currently disabled. Client IP will register as internal cluster IP.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BULK IMPORT .ENV MODAL */}
      {isBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-white/[0.1] bg-[#0E0E12] shadow-2xl p-6">
            <h3 className="text-base font-bold text-white">
              Bulk Import .env Variables
            </h3>
            <p className="text-xs text-muted-foreground leading-normal">
              Paste plain text .env definitions (KEY=VALUE). Lines starting with # will be skipped.
            </p>
            <Textarea
              value={bulkEnvText}
              onChange={(e) => setBulkEnvText(e.target.value)}
              placeholder="APP_KEY=base64:...\nDB_DATABASE=shop\nCACHE_DRIVER=redis"
              rows={8}
              className="w-full bg-black/50 p-3 font-mono text-xs border-white/[0.08] focus:border-primary/50 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <div className="flex justify-end gap-2 text-xs pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsBulkOpen(false)}
                className="h-8 border-white/10 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleBulkEnvImport}
                className="h-8 bg-primary hover:bg-primary/90 text-white"
              >
                Import Variables
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

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
import { Checkbox } from "@/components/ui/checkbox"
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
        <Card className="col-span-2 border-white/[0.06] bg-black/25">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base font-bold text-white">
                Environment Variables
              </CardTitle>
              <CardDescription>
                Manage environment parameters injected into container pods at
                runtime
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsBulkOpen(true)}
                className="h-8 border-white/[0.08] text-xs"
              >
                Bulk Import .env
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Env Var Form */}
            <form
              onSubmit={handleAddEnv}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-black/30 p-3"
            >
              <Input
                placeholder="KEY (e.g. CACHE_DRIVER)"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                className="h-9 min-w-[150px] flex-1 text-xs uppercase"
              />
              <Input
                placeholder="Value"
                value={newEnvVal}
                onChange={(e) => setNewEnvVal(e.target.value)}
                className="h-9 min-w-[200px] flex-2 text-xs"
              />
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none">
                <Checkbox
                  checked={newEnvSecret}
                  onCheckedChange={(checked) =>
                    setNewEnvSecret(checked === true)
                  }
                  className="border-white/20 bg-black/50 data-[state=checked]:bg-primary"
                />
                Secret Value
              </label>
              <Button type="submit" size="sm" className="h-9 gap-1.5">
                <Plus size={14} /> Add Var
              </Button>
            </form>

            {/* Env List */}
            <div className="overflow-hidden rounded-lg border border-white/[0.08] text-xs">
              <div className="grid grid-cols-4 border-b border-white/[0.08] bg-white/[0.02] p-3 font-semibold text-muted-foreground uppercase">
                <span className="col-span-2">Name / Key</span>
                <span>Value</span>
                <span className="text-right">Actions</span>
              </div>

              <div className="max-h-[350px] divide-y divide-white/[0.06] overflow-y-auto">
                {envVars[selectedEnv].map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-4 items-center p-3 hover:bg-white/[0.01]"
                  >
                    <span className="col-span-2 pr-2 font-mono font-bold break-all text-white">
                      {item.key}
                      {item.isSecret && (
                        <span className="py-0.2 ml-1.5 rounded border border-red-500/20 bg-red-500/10 px-1.5 font-mono text-[8px] font-normal text-red-400">
                          SECRET
                        </span>
                      )}
                    </span>
                    <span className="font-mono break-all text-muted-foreground">
                      {item.isSecret && !visibleSecrets[item.id] ? (
                        <span>••••••••••••••••</span>
                      ) : (
                        <span className="text-white">{item.value}</span>
                      )}
                    </span>
                    <span className="space-x-1 text-right">
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
                          title={
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
                        title={`Delete environment variable ${item.key}`}
                        className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash size={14} />
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reverse Proxy / Trust Proxy Configuration (Q11 Answer) */}
        <Card className="border-white/[0.06] bg-black/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base font-bold text-white">
              <ArrowsLeftRight size={18} className="text-primary" /> Reverse
              Proxy Ingress
            </CardTitle>
            <CardDescription>
              Trust proxy headers to capture authentic client metadata
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs leading-relaxed">
            <div className="space-y-3 rounded-lg border border-white/[0.06] bg-black/40 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">
                  Trust Forwarded Headers
                </span>
                <Button
                  type="button"
                  onClick={() => setTrustProxy(!trustProxy)}
                  variant="ghost"
                  size="sm"
                  className={`px-3 py-1.5 text-xs font-bold transition-all ${
                    trustProxy
                      ? "bg-primary text-white"
                      : "border border-white/10 bg-white/10 text-muted-foreground"
                  }`}
                >
                  {trustProxy ? "TRUST ACTIVE" : "DISABLED"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Configures nginx and application environment variable:{" "}
                <code>TRUST_PROXIES=*</code>.
              </p>
            </div>

            <div className="space-y-2 border-l-2 border-blue-500/40 pl-3">
              <h4 className="text-[13px] font-bold text-white">
                User IP Resolution (Q11)
              </h4>
              <p className="text-[11px] text-muted-foreground">
                When deployed behind proxy loads (like Cloudflare, ALB, or local
                nginx Ingress), client requests show internal local cluster IPs
                (e.g. <code>10.0.12.33</code>) in application logging.
              </p>
              <p className="text-[11px] text-muted-foreground">
                <strong>Solution:</strong> Enabling &quot;Trust Forwarded
                Headers&quot; commands the application server to read client
                parameters from the <code>X-Forwarded-For</code> header sent by
                proxies.
              </p>
              {trustProxy ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-400">
                  ✓ Trust proxies is active. Real client IPs will show in
                  application code (request()-&gt;ip()).
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-yellow-400">
                  ⚠️ Currently disabled. Client IP will register as internal
                  cluster IP.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BULK IMPORT .ENV MODAL */}
      {isBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-white/10 bg-neutral-900 p-5">
            <h3 className="text-base font-bold text-white">
              Bulk Import .env Variables
            </h3>
            <p className="text-xs text-muted-foreground">
              Paste plain text .env definitions (KEY=VALUE). Lines starting with
              # will be skipped.
            </p>
            <Textarea
              value={bulkEnvText}
              onChange={(e) => setBulkEnvText(e.target.value)}
              placeholder="APP_KEY=base64:...\nDB_DATABASE=shop\nCACHE_DRIVER=redis"
              rows={8}
              className="w-full bg-black/50 p-3 font-mono text-xs"
            />
            <div className="flex justify-end gap-2 text-xs">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBulkOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleBulkEnvImport}>
                Import Variables
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

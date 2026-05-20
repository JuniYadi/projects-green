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

import type {
  K8sEnvironmentId,
  EnvVar,
} from "@/modules/deploy/operate.types"

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
  const [visibleSecrets, setVisibleSecrets] = useState<
    Record<string, boolean>
  >({})

  const [trustProxy, setTrustProxy] = useState(false)

  const handleAddEnv = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEnvKey.trim()) return

    const newObj: EnvVar = {
      id: `env-${Date.now()}`,
      key: newEnvKey.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
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
                className="h-8 text-xs border-white/[0.08]"
              >
                Bulk Import .env
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Env Var Form */}
            <form
              onSubmit={handleAddEnv}
              className="flex flex-wrap gap-2 items-center rounded-lg border border-white/[0.06] bg-black/30 p-3"
            >
              <Input
                placeholder="KEY (e.g. CACHE_DRIVER)"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                className="flex-1 min-w-[150px] uppercase h-9 text-xs"
              />
              <Input
                placeholder="Value"
                value={newEnvVal}
                onChange={(e) => setNewEnvVal(e.target.value)}
                className="flex-2 min-w-[200px] h-9 text-xs"
              />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={newEnvSecret}
                  onChange={(e) => setNewEnvSecret(e.target.checked)}
                  className="rounded border-white/20 bg-black/50 accent-primary"
                />
                Secret Value
              </label>
              <Button type="submit" size="sm" className="h-9 gap-1.5">
                <Plus size={14} /> Add Var
              </Button>
            </form>

            {/* Env List */}
            <div className="rounded-lg border border-white/[0.08] overflow-hidden text-xs">
              <div className="grid grid-cols-4 bg-white/[0.02] border-b border-white/[0.08] p-3 text-muted-foreground uppercase font-semibold">
                <span className="col-span-2">Name / Key</span>
                <span>Value</span>
                <span className="text-right">Actions</span>
              </div>

              <div className="divide-y divide-white/[0.06] max-h-[350px] overflow-y-auto">
                {envVars[selectedEnv].map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-4 p-3 items-center hover:bg-white/[0.01]"
                  >
                    <span className="col-span-2 font-mono font-bold text-white break-all pr-2">
                      {item.key}
                      {item.isSecret && (
                        <span className="ml-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] px-1.5 py-0.2 rounded font-mono font-normal">
                          SECRET
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-muted-foreground break-all">
                      {item.isSecret && !visibleSecrets[item.id] ? (
                        <span>••••••••••••••••</span>
                      ) : (
                        <span className="text-white">{item.value}</span>
                      )}
                    </span>
                    <span className="text-right space-x-1">
                      {item.isSecret && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSecretVisibility(item.id)}
                          className="h-7 w-7 p-0 hover:bg-white/[0.06] text-muted-foreground hover:text-white"
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
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
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
            <CardTitle className="text-base font-bold text-white flex items-center gap-1.5">
              <ArrowsLeftRight size={18} className="text-primary" /> Reverse
              Proxy Ingress
            </CardTitle>
            <CardDescription>
              Trust proxy headers to capture authentic client metadata
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs leading-relaxed">
            <div className="rounded-lg bg-black/40 border border-white/[0.06] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">
                  Trust Forwarded Headers
                </span>
                <button
                  type="button"
                  onClick={() => setTrustProxy(!trustProxy)}
                  className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition-all ${
                    trustProxy
                      ? "bg-primary text-white"
                      : "bg-white/10 text-muted-foreground border border-white/10"
                  }`}
                >
                  {trustProxy ? "TRUST ACTIVE" : "DISABLED"}
                </button>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Configures nginx and application environment variable:{" "}
                <code>TRUST_PROXIES=*</code>.
              </p>
            </div>

            <div className="space-y-2 pl-3 border-l-2 border-blue-500/40">
              <h4 className="font-bold text-white text-[13px]">
                User IP Resolution (Q11)
              </h4>
              <p className="text-muted-foreground text-[11px]">
                When deployed behind proxy loads (like Cloudflare, ALB, or local
                nginx Ingress), client requests show internal local cluster IPs
                (e.g. <code>10.0.12.33</code>) in application logging.
              </p>
              <p className="text-muted-foreground text-[11px]">
                <strong>Solution:</strong> Enabling &quot;Trust Forwarded
                Headers&quot; commands the application server to read client
                parameters from the <code>X-Forwarded-For</code> header sent by
                proxies.
              </p>
              {trustProxy ? (
                <span className="inline-flex items-center gap-1 text-green-400 font-semibold text-[11px]">
                  ✓ Trust proxies is active. Real client IPs will show in
                  application code (request()-&gt;ip()).
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-yellow-400 font-semibold text-[11px]">
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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-xl max-w-lg w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-white">
              Bulk Import .env Variables
            </h3>
            <p className="text-xs text-muted-foreground">
              Paste plain text .env definitions (KEY=VALUE). Lines starting with
              # will be skipped.
            </p>
            <textarea
              value={bulkEnvText}
              onChange={(e) => setBulkEnvText(e.target.value)}
              placeholder="APP_KEY=base64:...\nDB_DATABASE=shop\nCACHE_DRIVER=redis"
              rows={8}
              className="w-full bg-black/50 text-white border border-white/[0.1] rounded-lg p-3 font-mono text-xs focus:outline-none"
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

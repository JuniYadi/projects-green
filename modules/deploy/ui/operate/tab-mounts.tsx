"use client"

import { useRef, useState } from "react"
import { Key, Trash } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import type {
  K8sEnvironmentId,
  VolumeMount,
} from "@/modules/deploy/operate.types"

type TabMountsProps = {
  selectedEnv: K8sEnvironmentId
  mounts: Record<K8sEnvironmentId, VolumeMount[]>
  setMounts: React.Dispatch<
    React.SetStateAction<Record<K8sEnvironmentId, VolumeMount[]>>
  >
}

export function TabMounts({ selectedEnv, mounts, setMounts }: TabMountsProps) {
  const [newMountName, setNewMountName] = useState("")
  const [newMountPath, setNewMountPath] = useState("")
  const [newMountReadOnly, setNewMountReadOnly] = useState(true)
  const [mountError, setMountError] = useState("")
  const mountContentInputRef = useRef<HTMLTextAreaElement>(null)

  const buildContentSummary = (content: string, mountPath: string) => {
    const bytes = new TextEncoder().encode(content)
    let hash = 0
    for (const byte of bytes) {
      hash = (hash * 31 + byte) >>> 0
    }
    const extension = mountPath.split(".").pop()?.toLowerCase() ?? "txt"
    return `[REDACTED] type=${extension} bytes=${bytes.length} fingerprint=${hash.toString(16)}`
  }

  const handleAddMount = (e: React.FormEvent) => {
    e.preventDefault()
    setMountError("")
    const mountContent = mountContentInputRef.current?.value ?? ""

    if (!newMountName.trim() || !newMountPath.trim() || !mountContent.trim()) {
      setMountError("All fields are required")
      return
    }

    const forbiddenPaths = [
      "/bin",
      "/sbin",
      "/usr/bin",
      "/proc",
      "/sys",
      "/dev",
      "/etc/passwd",
    ]
    const startsWithForbidden = forbiddenPaths.some((p) =>
      newMountPath.startsWith(p)
    )
    if (startsWithForbidden) {
      setMountError(
        `Cannot mount to protected directories: ${forbiddenPaths.join(", ")}`
      )
      return
    }

    if (!newMountPath.startsWith("/")) {
      setMountError("Mount path must be absolute (starting with '/')")
      return
    }

    const newObj: VolumeMount = {
      id: `mnt-${Date.now()}`,
      name: newMountName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, ""),
      mountPath: newMountPath.trim(),
      sourceType: "secret",
      fileMode: "0400",
      readOnly: newMountReadOnly,
      contentSummary: buildContentSummary(mountContent, newMountPath.trim()),
    }

    setMounts((prev) => ({
      ...prev,
      [selectedEnv]: [...prev[selectedEnv], newObj],
    }))
    setNewMountName("")
    setNewMountPath("")
    if (mountContentInputRef.current) {
      mountContentInputRef.current.value = ""
    }
  }

  const handleDeleteMount = (id: string) => {
    setMounts((prev) => ({
      ...prev,
      [selectedEnv]: prev[selectedEnv].filter((m) => m.id !== id),
    }))
  }

  return (
    <div className="space-y-6">
      {/* Active Mounts List */}
      <Card size="sm" className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Key size={18} className="text-primary" /> Mount Keys & Files
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Mount certificates or secrets securely as localized file paths
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          {mountError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-400">
              {mountError}
            </div>
          )}
          <form onSubmit={handleAddMount} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                Mount Name
              </label>
              <Input
                placeholder="e.g. application-private-key"
                value={newMountName}
                onChange={(e) => setNewMountName(e.target.value)}
                className="h-9 border-border bg-background text-xs focus:border-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                Container Target Path
              </label>
              <Input
                placeholder="e.g. /var/www/html/storage/app/key.pem"
                value={newMountPath}
                onChange={(e) => setNewMountPath(e.target.value)}
                className="h-9 border-border bg-background font-mono text-xs focus:border-primary/50"
              />
              <span className="block text-[10px] leading-relaxed text-muted-foreground/80">
                Must be absolute. Path is write-protected for container
                security.
              </span>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                PEM Content / Private Key Data
              </label>
              <Textarea
                ref={mountContentInputRef}
                placeholder={
                  "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0..."
                }
                rows={6}
                className="w-full rounded-xl border border-border bg-background p-3 font-mono text-[10px] leading-relaxed text-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-foreground">
                  Read-Only Mount
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Mode 0400 (Highly Recommended for keys/certs).
                </span>
              </div>
              <Switch
                checked={newMountReadOnly}
                onCheckedChange={setNewMountReadOnly}
                aria-label="Set mount as read-only"
              />
            </div>
            <Button
              type="submit"
              className="mt-2 h-9 w-full bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/95"
            >
              Create File Mount
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Create Mount form */}
      <Card size="sm" className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground">
            Active Pod File Mounts
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            File injections mapped directly into target containers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card text-xs">
            <div className="grid grid-cols-12 border-b border-border bg-muted/30 px-4 py-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              <span className="col-span-4">Mount Target</span>
              <span className="col-span-3">Type / Mode</span>
              <span className="col-span-3">Content Summary</span>
              <span className="col-span-2 text-right font-normal">Actions</span>
            </div>

            <div className="divide-y divide-border">
              {mounts[selectedEnv].map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 items-center px-4 py-3.5 transition-colors hover:bg-muted/30"
                >
                  <span className="col-span-4 pr-2 font-mono text-xs font-bold break-all text-foreground">
                    {item.mountPath}
                  </span>
                  <span className="col-span-3 flex flex-col gap-0.5 font-mono text-xs text-muted-foreground">
                    <span>
                      {item.sourceType.toUpperCase()} ({item.fileMode})
                    </span>
                    {item.readOnly && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                        ● Read-Only
                      </span>
                    )}
                  </span>
                  <span className="col-span-3">
                    <span className="inline-block max-w-full rounded-lg border border-white/[0.08] bg-black/40 px-2 py-1 font-mono text-[9px] leading-normal break-all whitespace-pre text-muted-foreground/90">
                      {item.contentSummary}
                    </span>
                  </span>
                  <span className="col-span-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMount(item.id)}
                      className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash size={14} />
                    </Button>
                  </span>
                </div>
              ))}

              {mounts[selectedEnv].length === 0 && (
                <div className="p-6 text-center font-medium text-muted-foreground">
                  No private key or volume files mounted.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-black/40 p-4 text-xs leading-relaxed">
            <span className="block text-xs font-bold text-white">
              In-Container Mounting Mechanics
            </span>
            <p className="leading-normal text-muted-foreground">
              Private keys are stored in encrypted Kubernetes{" "}
              <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[10px] text-white">
                Secrets
              </code>
              , then mapped at boot via a volume definition:
            </p>
            <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/80 p-3.5 font-mono text-[10px] leading-relaxed text-emerald-400">
              {`volumes:
  - name: secure-key-volume
    secret:
      secretName: dev-secrets-pem
      items: [{ key: "pem", path: "key.pem", mode: 256 }]`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

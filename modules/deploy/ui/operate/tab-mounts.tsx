"use client"

import { useRef, useState } from "react"
import { Key, Trash } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
    <div className="grid gap-6 md:grid-cols-3">
      {/* Create Mount form */}
      <Card className="col-span-1 border-white/[0.06] bg-black/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-base font-bold text-white">
            <Key size={18} className="text-primary" /> Mount Private Key / Files
          </CardTitle>
          <CardDescription>
            Mount certificates or secrets securely as localized file paths
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          {mountError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-[11px] font-medium text-red-400">
              {mountError}
            </div>
          )}
          <form onSubmit={handleAddMount} className="space-y-3">
            <div className="space-y-1">
              <label className="block font-medium text-muted-foreground">
                Mount Name
              </label>
              <Input
                placeholder="e.g. application-private-key"
                value={newMountName}
                onChange={(e) => setNewMountName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-medium text-muted-foreground">
                Container Target Path
              </label>
              <Input
                placeholder="e.g. /var/www/html/storage/app/key.pem"
                value={newMountPath}
                onChange={(e) => setNewMountPath(e.target.value)}
                className="h-8 font-mono text-xs"
              />
              <span className="block text-[10px] leading-tight text-muted-foreground">
                Must be absolute. Path is write-protected for security.
              </span>
            </div>
            <div className="space-y-1">
              <label className="block font-medium text-muted-foreground">
                PEM Content / Private Key Data
              </label>
              <Textarea
                ref={mountContentInputRef}
                placeholder="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0..."
                rows={6}
                className="w-full rounded-lg border border-white/[0.1] bg-black/50 p-2.5 font-mono text-[10px] text-white focus:outline-none"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground select-none">
              <Checkbox
                checked={newMountReadOnly}
                onCheckedChange={(value) =>
                  setNewMountReadOnly(Boolean(value))
                }
                className="rounded border-white/20 bg-black/50 accent-primary"
              />
              Read-Only (Recommended: Mode 0400)
            </label>

            <Button type="submit" className="mt-2 h-8 w-full text-xs">
              Create File Mount
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Active Mounts List */}
      <Card className="col-span-2 border-white/[0.06] bg-black/25">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white">
            Active Pod File Mounts
          </CardTitle>
          <CardDescription>
            File injections mapped directly into target containers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-white/[0.08] text-xs">
            <div className="grid grid-cols-4 border-b border-white/[0.08] bg-white/[0.02] p-3 font-semibold text-muted-foreground uppercase">
              <span>Mount Target</span>
              <span>Type / Mode</span>
              <span>Content Summary</span>
              <span className="text-right font-normal">Actions</span>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {mounts[selectedEnv].map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-4 items-center p-3 hover:bg-white/[0.01]"
                >
                  <span className="pr-2 font-mono font-bold break-all text-white">
                    {item.mountPath}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {item.sourceType.toUpperCase()} ({item.fileMode})
                    {item.readOnly && (
                      <span className="block text-[9px] text-green-400">
                        Read-Only
                      </span>
                    )}
                  </span>
                  <span className="block max-w-[200px] rounded border border-white/5 bg-black/30 p-1.5 font-mono text-[10px] break-all whitespace-pre text-muted-foreground">
                    {item.contentSummary}
                  </span>
                  <span className="text-right">
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
                <div className="p-6 text-center text-muted-foreground">
                  No private key or volume files mounted.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-black/40 p-4 text-xs leading-relaxed">
            <span className="block font-bold text-white">
              In-Container Mounting Mechanics
            </span>
            <p className="text-muted-foreground">
              Private keys are stored in encrypted Kubernetes{" "}
              <code>Secrets</code>, then mapped at boot via a volume definition:
            </p>
            <pre className="overflow-x-auto rounded border border-white/[0.06] bg-black/80 p-2.5 font-mono text-[10px] text-green-400">
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

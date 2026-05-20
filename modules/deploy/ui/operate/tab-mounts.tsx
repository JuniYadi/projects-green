"use client"

import { useState } from "react"
import { Key, Trash } from "@phosphor-icons/react"

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
  VolumeMount,
} from "@/modules/deploy/operate.types"

type TabMountsProps = {
  selectedEnv: K8sEnvironmentId
  mounts: Record<K8sEnvironmentId, VolumeMount[]>
  setMounts: React.Dispatch<
    React.SetStateAction<Record<K8sEnvironmentId, VolumeMount[]>>
  >
}

export function TabMounts({
  selectedEnv,
  mounts,
  setMounts,
}: TabMountsProps) {
  const [newMountName, setNewMountName] = useState("")
  const [newMountPath, setNewMountPath] = useState("")
  const [newMountContent, setNewMountContent] = useState("")
  const [newMountReadOnly, setNewMountReadOnly] = useState(true)
  const [mountError, setMountError] = useState("")

  const handleAddMount = (e: React.FormEvent) => {
    e.preventDefault()
    setMountError("")

    if (
      !newMountName.trim() ||
      !newMountPath.trim() ||
      !newMountContent.trim()
    ) {
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
      contentSummary:
        newMountContent.slice(0, 45) +
        (newMountContent.length > 45 ? "..." : "") +
        ` (${newMountContent.length} bytes)`,
    }

    setMounts((prev) => ({
      ...prev,
      [selectedEnv]: [...prev[selectedEnv], newObj],
    }))
    setNewMountName("")
    setNewMountPath("")
    setNewMountContent("")
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
      <Card className="border-white/[0.06] bg-black/25 col-span-1">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white flex items-center gap-1.5">
            <Key size={18} className="text-primary" /> Mount Private Key / Files
          </CardTitle>
          <CardDescription>
            Mount certificates or secrets securely as localized file paths
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          {mountError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg font-medium text-[11px]">
              {mountError}
            </div>
          )}
          <form onSubmit={handleAddMount} className="space-y-3">
            <div className="space-y-1">
              <label className="text-muted-foreground font-medium block">
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
              <label className="text-muted-foreground font-medium block">
                Container Target Path
              </label>
              <Input
                placeholder="e.g. /var/www/html/storage/app/key.pem"
                value={newMountPath}
                onChange={(e) => setNewMountPath(e.target.value)}
                className="h-8 text-xs font-mono"
              />
              <span className="text-[10px] text-muted-foreground block leading-tight">
                Must be absolute. Path is write-protected for security.
              </span>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground font-medium block">
                PEM Content / Private Key Data
              </label>
              <textarea
                placeholder="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0..."
                value={newMountContent}
                onChange={(e) => setNewMountContent(e.target.value)}
                rows={6}
                className="w-full bg-black/50 text-white border border-white/[0.1] rounded-lg p-2.5 font-mono text-[10px] focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-1.5 text-muted-foreground select-none cursor-pointer">
              <input
                type="checkbox"
                checked={newMountReadOnly}
                onChange={(e) => setNewMountReadOnly(e.target.checked)}
                className="rounded border-white/20 bg-black/50 accent-primary"
              />
              Read-Only (Recommended: Mode 0400)
            </label>

            <Button type="submit" className="w-full h-8 text-xs mt-2">
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
          <div className="rounded-lg border border-white/[0.08] overflow-hidden text-xs">
            <div className="grid grid-cols-4 bg-white/[0.02] border-b border-white/[0.08] p-3 text-muted-foreground uppercase font-semibold">
              <span>Mount Target</span>
              <span>Type / Mode</span>
              <span>Content Summary</span>
              <th className="text-right font-normal">Actions</th>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {mounts[selectedEnv].map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-4 p-3 items-center hover:bg-white/[0.01]"
                >
                  <span className="font-mono font-bold text-white break-all pr-2">
                    {item.mountPath}
                  </span>
                  <span className="text-muted-foreground font-mono">
                    {item.sourceType.toUpperCase()} ({item.fileMode})
                    {item.readOnly && (
                      <span className="block text-[9px] text-green-400">
                        Read-Only
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-muted-foreground text-[10px] break-all max-w-[200px] whitespace-pre block bg-black/30 p-1.5 border border-white/5 rounded">
                    {item.contentSummary}
                  </span>
                  <span className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMount(item.id)}
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
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

          <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4 text-xs space-y-2 leading-relaxed">
            <span className="font-bold text-white block">
              In-Container Mounting Mechanics
            </span>
            <p className="text-muted-foreground">
              Private keys are stored in encrypted Kubernetes{" "}
              <code>Secrets</code>, then mapped at boot via a volume definition:
            </p>
            <pre className="p-2.5 bg-black/80 rounded border border-white/[0.06] text-[10px] font-mono text-green-400 overflow-x-auto">
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

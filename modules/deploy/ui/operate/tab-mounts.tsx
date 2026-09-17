"use client"

import { useRef, useState } from "react"
import { useParams } from "next/navigation"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { HardDrive, Key, Sparkle, Trash } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

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
  persistentStorage?: {
    enabled: boolean
    mountPath: string
    sizeGb: number
  } | null
  onAddMount?: (
    environmentId: K8sEnvironmentId,
    mount: VolumeMount
  ) => Promise<void>
  onDeleteMount?: (
    environmentId: K8sEnvironmentId,
    mountId: string
  ) => Promise<void>
  isComingSoon?: boolean
  locale?: string
}

export function TabMounts({
  selectedEnv,
  mounts,
  setMounts,
  persistentStorage,
  onAddMount,
  onDeleteMount,
  isComingSoon,
  locale,
}: TabMountsProps) {
  const params = useParams<{ lang?: string }>()
  const lang = locale || params?.lang || "en"
  const messages = getMessagesForMaybeLocale(lang).console.deploy.operateMounts
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

  const handleAddMount = async (e: React.FormEvent) => {
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
      content: mountContent,
    }

    try {
      if (onAddMount) {
        await onAddMount(selectedEnv, newObj)
      } else {
        setMounts((prev) => ({
          ...prev,
          [selectedEnv]: [...prev[selectedEnv], newObj],
        }))
      }
      setNewMountName("")
      setNewMountPath("")
      if (mountContentInputRef.current) {
        mountContentInputRef.current.value = ""
      }
    } catch (error) {
      setMountError(
        error instanceof Error ? error.message : "Unable to add mount"
      )
    }
  }

  const handleDeleteMount = async (id: string) => {
    try {
      if (onDeleteMount) {
        await onDeleteMount(selectedEnv, id)
      } else {
        setMounts((prev) => ({
          ...prev,
          [selectedEnv]: prev[selectedEnv].filter((m) => m.id !== id),
        }))
      }
    } catch (error) {
      setMountError(
        error instanceof Error ? error.message : "Unable to delete mount"
      )
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "space-y-6",
          isComingSoon &&
            "pointer-events-none opacity-40 blur-[0.5px] transition-all select-none"
        )}
        aria-hidden={isComingSoon ? "true" : undefined}
      >
        {persistentStorage && persistentStorage.enabled && (
          <Card size="sm" className="border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <HardDrive size={18} className="text-primary" />{" "}
                {messages.persistentVolumeTitle}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {messages.persistentVolumeDesc}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3.5 font-mono text-xs">
                <div className="space-y-1">
                  <span className="font-semibold text-foreground">
                    {persistentStorage.mountPath}
                  </span>
                  <p className="font-sans text-[11px] font-normal text-muted-foreground">
                    {messages.persistentVolumeRwo}
                  </p>
                </div>
                <span className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 font-bold text-primary">
                  {persistentStorage.sizeGb} GB
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Mounts List */}
        <Card size="sm" className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Key size={18} className="text-primary" />{" "}
              {messages.fileMountsTitle}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {messages.fileMountsDesc}
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
                  {messages.mountName}
                </label>
                <Input
                  placeholder={messages.mountNamePlaceholder}
                  value={newMountName}
                  onChange={(e) => setNewMountName(e.target.value)}
                  className="h-9 border-border bg-background text-xs focus:border-primary/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-muted-foreground">
                  {messages.targetPath}
                </label>
                <Input
                  placeholder={messages.targetPathPlaceholder}
                  value={newMountPath}
                  onChange={(e) => setNewMountPath(e.target.value)}
                  className="h-9 border-border bg-background font-mono text-xs focus:border-primary/50"
                />
                <span className="block text-[10px] leading-relaxed text-muted-foreground/80">
                  {messages.targetPathHelp}
                </span>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-muted-foreground">
                  {messages.contentData}
                </label>
                <Textarea
                  ref={mountContentInputRef}
                  placeholder={
                    "# Configuration data (YAML, JSON, text, or PEM secret)\nPORT: 3000\nLOG_LEVEL: info"
                  }
                  rows={6}
                  className="w-full rounded-xl border border-border bg-background p-3 font-mono text-[10px] leading-relaxed text-foreground focus:ring-1 focus:ring-primary/50 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-foreground">
                    {messages.readOnly}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {messages.readOnlyDesc}
                  </span>
                </div>
                <Switch
                  checked={newMountReadOnly}
                  onCheckedChange={setNewMountReadOnly}
                  aria-label={messages.setReadOnlyAria}
                />
              </div>
              <Button
                type="submit"
                className="mt-2 h-9 w-full bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/95"
              >
                {messages.createButton}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Active Pod File Mounts */}
        <Card size="sm" className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              {messages.activeMountsTitle}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {messages.activeMountsDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border bg-card text-xs">
              <div className="grid grid-cols-12 border-b border-border bg-muted/30 px-4 py-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                <span className="col-span-4">{messages.colTarget}</span>
                <span className="col-span-3">{messages.colType}</span>
                <span className="col-span-3">{messages.colSummary}</span>
                <span className="col-span-2 text-right font-normal">
                  {messages.colActions}
                </span>
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
                      <span>{item.sourceType.toUpperCase()}</span>
                      {item.readOnly ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-500">
                          {messages.readOnlyDot}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-medium text-muted-foreground">
                          {messages.readWriteDot}
                        </span>
                      )}
                    </span>
                    <span className="col-span-3">
                      <span className="inline-block max-w-full rounded-lg border border-border bg-muted/30 px-2 py-1 font-mono text-[9px] leading-normal break-all whitespace-pre text-muted-foreground">
                        {item.contentSummary}
                      </span>
                    </span>
                    <span className="col-span-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={messages.deleteAria}
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
                    {messages.emptyState}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5 rounded-xl border border-border bg-muted/20 p-4 text-xs leading-relaxed">
              <span className="block text-xs font-bold text-foreground">
                {messages.howItWorksTitle}
              </span>
              <p className="leading-normal text-muted-foreground">
                {messages.howItWorksDesc}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isComingSoon && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-start p-6 pt-16 sm:pt-24">
          <Card className="max-w-md border-border bg-card/95 shadow-xl backdrop-blur-md">
            <CardContent className="flex flex-col items-center p-6 text-center sm:p-8">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
                <Sparkle size={28} weight="duotone" />
              </div>

              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkle size={12} weight="fill" />
                {messages.comingSoonBadge}
              </span>

              <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                {messages.comingSoonTitle}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {messages.comingSoonDesc}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

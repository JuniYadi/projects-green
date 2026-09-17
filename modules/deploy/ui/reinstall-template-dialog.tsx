"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  ArrowsClockwise,
  ArrowRight,
  CheckCircle,
  Database,
  HardDrives,
  ShieldCheck,
} from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"
import type {
  ReinstallPreflightResponseDTO,
  ReinstallRequestDTO,
} from "@/modules/deploy/app-reinstall.dto"

type TemplateOption = {
  id: string
  slug: string
  name: string
  version?: string | null
  description?: string | null
  category?: string | null
}

type ReinstallTemplateDialogProps = {
  stack: StackSummaryDTO
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type WizardStep = "SELECT" | "PREFLIGHT" | "CONFIRM"

export function ReinstallTemplateDialog({
  stack,
  open,
  onOpenChange,
  onSuccess,
}: ReinstallTemplateDialogProps) {
  const [step, setStep] = useState<WizardStep>("SELECT")
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  )

  const [preflight, setPreflight] =
    useState<ReinstallPreflightResponseDTO | null>(null)
  const [loadingPreflight, setLoadingPreflight] = useState(false)
  const [preflightError, setPreflightError] = useState<string | null>(null)

  // Dependency options
  const [dependencyMode, setDependencyMode] = useState<"MANAGED" | "BYOD">(
    "MANAGED"
  )
  const [byodHost, setByodHost] = useState("")
  const [byodPort, setByodPort] = useState(3306)
  const [byodDatabase, setByodDatabase] = useState("")
  const [byodUser, setByodUser] = useState("")
  const [byodPassword, setByodPassword] = useState("")

  // Custom envs
  const [customEnvs, setCustomEnvs] = useState<Record<string, string>>({})

  // Slug confirmation input
  const [confirmSlugInput, setConfirmSlugInput] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStep("SELECT")
      setSelectedTemplateId(null)
      setPreflight(null)
      setPreflightError(null)
      setConfirmSlugInput("")
    }
    onOpenChange(newOpen)
  }

  useEffect(() => {
    if (!open) return
    let active = true

    async function fetchTemplates() {
      setLoadingTemplates(true)
      try {
        const res = await fetch("/api/deploy/marketplace/templates")
        if (!active) return
        if (!res.ok) {
          const altRes = await fetch("/api/templates")
          if (altRes.ok && active) {
            const json = await altRes.json()
            setTemplates(json.data ?? json ?? [])
            return
          }
        }
        const data = await res.json()
        if (active) {
          setTemplates(data.data ?? data ?? [])
        }
      } catch {
        if (active) toast.error("Failed to load available templates.")
      } finally {
        if (active) setLoadingTemplates(false)
      }
    }

    void fetchTemplates()

    return () => {
      active = false
    }
  }, [open])

  async function handleSelectTemplate(templateId: string) {
    setSelectedTemplateId(templateId)
    setStep("PREFLIGHT")
    setLoadingPreflight(true)
    setPreflightError(null)

    try {
      const res = await fetch(
        `/api/deploy/apps/${stack.slug}/reinstall/preflight?targetTemplateId=${templateId}`
      )
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setPreflightError(
          data.message ?? "Failed to compute template preflight compatibility."
        )
        return
      }
      setPreflight(data.data)

      // Set default dependency mode
      if (data.data.dependencies?.requiredServiceType) {
        if (data.data.dependencies.managedStockAvailable) {
          setDependencyMode("MANAGED")
        } else {
          setDependencyMode("BYOD")
        }
        if (data.data.dependencies.requiredServiceType === "POSTGRESQL") {
          setByodPort(5432)
        } else if (data.data.dependencies.requiredServiceType === "REDIS") {
          setByodPort(6379)
        } else {
          setByodPort(3306)
        }
      }
    } catch (err) {
      setPreflightError(
        err instanceof Error
          ? err.message
          : "Network error loading preflight info"
      )
    } finally {
      setLoadingPreflight(false)
    }
  }

  async function handleConfirmReinstall() {
    if (confirmSlugInput !== stack.slug || !selectedTemplateId) return
    setSubmitting(true)

    const payload: ReinstallRequestDTO = {
      targetTemplateId: selectedTemplateId,
      dependencyMode: preflight?.dependencies?.requiredServiceType
        ? dependencyMode
        : undefined,
      byodCredentials:
        dependencyMode === "BYOD" &&
        preflight?.dependencies?.requiredServiceType
          ? {
              host: byodHost,
              port: byodPort,
              database: byodDatabase,
              user: byodUser,
              password: byodPassword,
            }
          : undefined,
      customEnvs: Object.keys(customEnvs).length > 0 ? customEnvs : undefined,
    }

    try {
      const res = await fetch(`/api/deploy/apps/${stack.slug}/reinstall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Reinstall failed")
      }

      toast.success(data.data?.message ?? "Template reinstalled successfully!")
      handleOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to execute reinstall"
      )
    } finally {
      setSubmitting(false)
    }
  }

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-border bg-card text-card-foreground">
        {/* STEP 1: SELECT TARGET TEMPLATE */}
        {step === "SELECT" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <ArrowsClockwise size={18} className="text-primary" />
                <span>Reinstall or Change Template: {stack.name}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Choose a new marketplace template for this stack. Your domain,
                slug, and existing storage will be safely preserved.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <Input
                placeholder="Search templates (e.g. WordPress, n8n, Hermes)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 text-xs"
              />

              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                    <ArrowsClockwise
                      size={16}
                      className="mr-2 animate-spin text-muted-foreground"
                    />
                    Loading templates…
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No templates found matching &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  filteredTemplates.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectTemplate(item.id)}
                      className="group flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {item.name}
                          </span>
                          {item.version && (
                            <Badge variant="outline" className="text-[10px]">
                              v{item.version}
                            </Badge>
                          )}
                          {item.category && (
                            <Badge variant="secondary" className="text-[10px]">
                              {item.category}
                            </Badge>
                          )}
                        </div>
                        {item.description && (
                          <p className="line-clamp-1 text-[11px] text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] group-hover:border-primary group-hover:text-primary"
                      >
                        Select <ArrowRight size={12} className="ml-1" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
                className="text-xs"
              >
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP 2: PREFLIGHT DIFF & DEPENDENCY INSPECTOR */}
        {step === "PREFLIGHT" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <HardDrives size={18} className="text-primary" />
                <span>Preflight Compatibility & Diff</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Review runtime differences and configure database or storage
                options.
              </DialogDescription>
            </DialogHeader>

            {loadingPreflight ? (
              <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
                <ArrowsClockwise
                  size={18}
                  className="mr-2 animate-spin text-muted-foreground"
                />
                Analyzing template compatibility…
              </div>
            ) : preflightError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
                <p className="font-semibold">Compatibility Error</p>
                <p className="mt-1">{preflightError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("SELECT")}
                  className="mt-3 text-xs"
                >
                  Choose Different Template
                </Button>
              </div>
            ) : preflight ? (
              <div className="max-h-[380px] space-y-4 overflow-y-auto py-1 pr-1 text-xs">
                {/* Header Transition */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
                  <div>
                    <span className="text-[11px] text-muted-foreground">
                      Current Template
                    </span>
                    <p className="font-bold text-foreground">
                      {preflight.currentTemplate.name}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground" />
                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground">
                      Target Template
                    </span>
                    <p className="font-bold text-foreground">
                      {preflight.targetTemplate.name}
                    </p>
                  </div>
                </div>

                {/* Diff specifications */}
                <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                  <span className="text-xs font-semibold text-foreground">
                    Runtime Architecture Changes
                  </span>
                  <div className="space-y-1.5 pt-1 text-[11px]">
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">
                        Workload Controller:
                      </span>
                      <span className="font-mono text-foreground">
                        {preflight.diff.workloadKind.current} ➔{" "}
                        {preflight.diff.workloadKind.target}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">
                        Default Port:
                      </span>
                      <span className="font-mono text-foreground">
                        {preflight.diff.port.current} ➔{" "}
                        {preflight.diff.port.target}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 pt-0.5">
                      <span className="text-muted-foreground">
                        Storage Policy:
                      </span>
                      <p className="leading-relaxed text-foreground">
                        {preflight.diff.storage.warning ??
                          (preflight.diff.storage.policy === "REUSE_COMPATIBLE"
                            ? "Storage mount is compatible and will be reused."
                            : "No persistent storage required.")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Database Dependency Rule */}
                {preflight.dependencies.requiredServiceType && (
                  <div className="space-y-2.5 rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-1.5">
                      <Database size={15} className="text-primary" />
                      <span className="text-xs font-semibold text-foreground">
                        Database Requirement:{" "}
                        {preflight.dependencies.requiredServiceType}
                      </span>
                    </div>

                    <div className="space-y-2 pt-1">
                      {/* Option 1: Managed Stock */}
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                          dependencyMode === "MANAGED"
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background opacity-80"
                        } ${
                          !preflight.dependencies.managedStockAvailable
                            ? "cursor-not-allowed opacity-50"
                            : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="depMode"
                          value="MANAGED"
                          checked={dependencyMode === "MANAGED"}
                          disabled={
                            !preflight.dependencies.managedStockAvailable
                          }
                          onChange={() => setDependencyMode("MANAGED")}
                          className="mt-0.5"
                        />
                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              Use Managed Stock Pool
                            </span>
                            {preflight.dependencies.managedStockAvailable ? (
                              <Badge variant="success" className="text-[10px]">
                                {preflight.dependencies.availableStockCount}{" "}
                                Available
                              </Badge>
                            ) : (
                              <Badge
                                variant="destructive"
                                className="text-[10px]"
                              >
                                Out of Stock
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Automatic provisioning via Vault/ESO. Zero plaintext
                            password exposure.
                          </p>
                        </div>
                      </label>

                      {/* Option 2: BYOD */}
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                          dependencyMode === "BYOD"
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background opacity-80"
                        }`}
                      >
                        <input
                          type="radio"
                          name="depMode"
                          value="BYOD"
                          checked={dependencyMode === "BYOD"}
                          onChange={() => setDependencyMode("BYOD")}
                          className="mt-0.5"
                        />
                        <div className="space-y-0.5 text-xs">
                          <span className="font-medium text-foreground">
                            Bring Your Own Database (BYOD - External)
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            Connect your own external{" "}
                            {preflight.dependencies.requiredServiceType}{" "}
                            database.
                          </p>
                        </div>
                      </label>

                      {/* BYOD Fields */}
                      {dependencyMode === "BYOD" && (
                        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/10 p-2.5 pt-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Host</Label>
                            <Input
                              value={byodHost}
                              onChange={(e) => setByodHost(e.target.value)}
                              placeholder="db.example.com"
                              className="h-8 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Port</Label>
                            <Input
                              type="number"
                              value={byodPort}
                              onChange={(e) =>
                                setByodPort(Number(e.target.value))
                              }
                              className="h-8 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Database Name</Label>
                            <Input
                              value={byodDatabase}
                              onChange={(e) => setByodDatabase(e.target.value)}
                              placeholder="my_app_db"
                              className="h-8 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">User</Label>
                            <Input
                              value={byodUser}
                              onChange={(e) => setByodUser(e.target.value)}
                              placeholder="db_user"
                              className="h-8 font-mono text-xs"
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-[11px]">Password</Label>
                            <Input
                              type="password"
                              value={byodPassword}
                              onChange={(e) => setByodPassword(e.target.value)}
                              placeholder="••••••••••••"
                              className="h-8 font-mono text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Required Environment Variables */}
                {preflight.envDiff.requiredEnvs.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                    <span className="text-xs font-semibold text-foreground">
                      Required Environment Variables
                    </span>
                    <div className="space-y-2 pt-1">
                      {preflight.envDiff.requiredEnvs.map((env) => (
                        <div key={env.key} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="font-mono text-[11px] text-foreground">
                              {env.key}
                            </Label>
                            <span className="text-[10px] text-muted-foreground">
                              {env.label}
                            </span>
                          </div>
                          <Input
                            type={env.isSecret ? "password" : "text"}
                            value={
                              customEnvs[env.key] ?? env.defaultValue ?? ""
                            }
                            onChange={(e) =>
                              setCustomEnvs((prev) => ({
                                ...prev,
                                [env.key]: e.target.value,
                              }))
                            }
                            placeholder={env.description ?? env.key}
                            className="h-8 font-mono text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <DialogFooter className="sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("SELECT")}
                className="text-xs"
              >
                Back
              </Button>
              <Button
                size="sm"
                disabled={!preflight?.canProceed}
                onClick={() => setStep("CONFIRM")}
                className="text-xs"
              >
                Next: Safety Review <ArrowRight size={14} className="ml-1" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP 3: FINAL SAFETY CONFIRMATION */}
        {step === "CONFIRM" && preflight && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <ShieldCheck size={20} className="text-primary" />
                <span>Confirm Template Reinstall</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Please review safety guarantees before triggering the GitOps
                deployment.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-emerald-700 dark:text-emerald-300">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle size={16} />
                  <span>Safety Checks & Rollback Guarantee</span>
                </div>
                <ul className="list-disc space-y-1 pl-5 text-[11px] leading-relaxed">
                  <li>
                    A complete configuration snapshot is taken prior to changes.
                  </li>
                  <li>
                    Rollback is available directly from the deployment history
                    if ArgoCD health checks fail.
                  </li>
                  <li>
                    Existing storage volume (
                    {preflight.currentTemplate.storagePath ?? "/data"}) is
                    safely archived and detached. Zero data loss.
                  </li>
                  <li>
                    Domain name ({stack.slug}.pfnapp.dev) remains unchanged.
                  </li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Type the application slug{" "}
                  <strong className="font-mono text-primary">
                    {stack.slug}
                  </strong>{" "}
                  to confirm:
                </Label>
                <Input
                  value={confirmSlugInput}
                  onChange={(e) => setConfirmSlugInput(e.target.value)}
                  placeholder={stack.slug}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("PREFLIGHT")}
                disabled={submitting}
                className="text-xs"
              >
                Back
              </Button>
              <Button
                size="sm"
                disabled={confirmSlugInput !== stack.slug || submitting}
                onClick={() => void handleConfirmReinstall()}
                className="text-xs"
              >
                {submitting ? (
                  <>
                    <ArrowsClockwise
                      size={14}
                      className="mr-1.5 animate-spin"
                    />
                    Deploying Target Template…
                  </>
                ) : (
                  "Confirm & Deploy New Template"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

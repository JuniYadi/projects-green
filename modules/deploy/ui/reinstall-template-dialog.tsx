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
  locale?: string
}

type WizardStep = "SELECT" | "PREFLIGHT" | "CONFIRM"

const DICT = {
  en: {
    dialogTitle: "Reinstall or Change Template:",
    dialogDescription:
      "Choose a new marketplace template for this stack. Your domain, slug, and existing storage will be safely preserved.",
    searchPlaceholder: "Search templates (e.g. WordPress, n8n, Hermes)...",
    loadingTemplates: "Loading templates…",
    noTemplatesPrefix: "No templates found matching",
    select: "Select",
    cancel: "Cancel",
    preflightTitle: "Preflight Compatibility & Diff",
    preflightDescription:
      "Review runtime differences and configure database or storage options.",
    analyzingCompatibility: "Analyzing template compatibility…",
    compatibilityError: "Compatibility Error",
    chooseDifferentTemplate: "Choose Different Template",
    currentTemplate: "Current Template",
    targetTemplate: "Target Template",
    runtimeChanges: "Runtime Architecture Changes",
    workloadController: "Workload Controller:",
    defaultPort: "Default Port:",
    storagePolicy: "Storage Policy:",
    storageMountCompatible: "Storage mount is compatible and will be reused.",
    storageNotRequired: "No persistent storage required.",
    dbRequirement: "Database Requirement:",
    useManagedStock: "Use Managed Stock Pool",
    available: "Available",
    outOfStock: "Out of Stock",
    managedStockDescription:
      "Automatic provisioning via Vault/ESO. Zero plaintext password exposure.",
    byodTitle: "Bring Your Own Database (BYOD - External)",
    byodDescriptionPrefix: "Connect your own external",
    byodDescriptionSuffix: "database.",
    host: "Host",
    port: "Port",
    dbName: "Database Name",
    dbNamePlaceholder: "my_app_db",
    user: "User",
    dbUserPlaceholder: "db_user",
    password: "Password",
    requiredEnvs: "Required Environment Variables",
    back: "Back",
    nextSafety: "Next: Safety Review",
    confirmTitle: "Confirm Template Reinstall",
    confirmDescription:
      "Please review safety guarantees before triggering the GitOps deployment.",
    safetyChecksTitle: "Safety Checks & Rollback Guarantee",
    safetySnapshot:
      "A complete configuration snapshot is taken prior to changes.",
    safetyRollback:
      "Rollback is available directly from the deployment history if ArgoCD health checks fail.",
    safetyStoragePrefix: "Existing storage volume (",
    safetyStorageSuffix: ") is safely archived and detached. Zero data loss.",
    safetyDomainPrefix: "Domain name (",
    safetyDomainSuffix: ".pfnapp.dev) remains unchanged.",
    typeSlugPrompt: "Type the application slug",
    toConfirm: "to confirm:",
    deploying: "Deploying Target Template…",
    confirmAndDeploy: "Confirm & Deploy New Template",
  },
  id: {
    dialogTitle: "Instal Ulang atau Ganti Template:",
    dialogDescription:
      "Pilih template marketplace baru untuk stack ini. Domain, slug, dan penyimpanan lama akan tetap aman.",
    searchPlaceholder: "Cari template (mis. WordPress, n8n, Hermes)...",
    loadingTemplates: "Memuat template…",
    noTemplatesPrefix: "Tidak ada template yang cocok dengan",
    select: "Pilih",
    cancel: "Batal",
    preflightTitle: "Kompatibilitas & Diff Pra-Penerapan",
    preflightDescription:
      "Periksa perbedaan runtime dan konfigurasikan opsi basis data atau penyimpanan.",
    analyzingCompatibility: "Menganalisis kompatibilitas template…",
    compatibilityError: "Kendala Kompatibilitas",
    chooseDifferentTemplate: "Pilih Template Lain",
    currentTemplate: "Template Saat Ini",
    targetTemplate: "Template Tujuan",
    runtimeChanges: "Perubahan Arsitektur Runtime",
    workloadController: "Pengendali Workload:",
    defaultPort: "Port Standar:",
    storagePolicy: "Kebijakan Penyimpanan:",
    storageMountCompatible:
      "Mount penyimpanan kompatibel dan akan digunakan kembali.",
    storageNotRequired: "Tidak memerlukan penyimpanan persisten.",
    dbRequirement: "Kebutuhan Basis Data:",
    useManagedStock: "Gunakan Pool Stok Terkelola",
    available: "Tersedia",
    outOfStock: "Stok Habis",
    managedStockDescription:
      "Penyediaan otomatis melalui Vault/ESO. Tanpa paparan kata sandi teks biasa.",
    byodTitle: "Gunakan Basis Data Sendiri (BYOD - Eksternal)",
    byodDescriptionPrefix: "Sambungkan basis data eksternal",
    byodDescriptionSuffix: "milik Anda sendiri.",
    host: "Host",
    port: "Port",
    dbName: "Nama Basis Data",
    dbNamePlaceholder: "my_app_db",
    user: "Pengguna",
    dbUserPlaceholder: "db_user",
    password: "Kata Sandi",
    requiredEnvs: "Variabel Lingkungan yang Dibutuhkan",
    back: "Kembali",
    nextSafety: "Lanjut: Tinjauan Keamanan",
    confirmTitle: "Konfirmasi Instal Ulang Template",
    confirmDescription:
      "Harap tinjau jaminan keamanan sebelum memicu deployment GitOps.",
    safetyChecksTitle: "Pemeriksaan Keamanan & Jaminan Rollback",
    safetySnapshot:
      "Snapshot konfigurasi lengkap dibuat otomatis sebelum perubahan diterapkan.",
    safetyRollback:
      "Rollback tersedia langsung dari riwayat deployment jika pemeriksaan kesehatan ArgoCD gagal.",
    safetyStoragePrefix: "Volume penyimpanan lama (",
    safetyStorageSuffix:
      ") diarsipkan dan dilepas dengan aman. Tanpa kehilangan data.",
    safetyDomainPrefix: "Nama domain (",
    safetyDomainSuffix: ".pfnapp.dev) tetap tidak berubah.",
    typeSlugPrompt: "Ketik slug aplikasi",
    toConfirm: "untuk konfirmasi:",
    deploying: "Menerapkan Template Tujuan…",
    confirmAndDeploy: "Konfirmasi & Pasang Template Baru",
  },
}

export function ReinstallTemplateDialog({
  stack,
  open,
  onOpenChange,
  onSuccess,
  locale = "en",
}: ReinstallTemplateDialogProps) {
  const isId = locale.startsWith("id")
  const t = DICT[isId ? "id" : "en"]
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
                <span>
                  {t.dialogTitle} {stack.name}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {t.dialogDescription}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <Input
                placeholder={t.searchPlaceholder}
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
                    {t.loadingTemplates}
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    {`${t.noTemplatesPrefix} "${searchQuery}".`}
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
                        {t.select} <ArrowRight size={12} className="ml-1" />
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
                {t.cancel}
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
                <span>{t.preflightTitle}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {t.preflightDescription}
              </DialogDescription>
            </DialogHeader>

            {loadingPreflight ? (
              <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
                <ArrowsClockwise
                  size={18}
                  className="mr-2 animate-spin text-muted-foreground"
                />
                {t.analyzingCompatibility}
              </div>
            ) : preflightError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
                <p className="font-semibold">{t.compatibilityError}</p>
                <p className="mt-1">{preflightError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("SELECT")}
                  className="mt-3 text-xs"
                >
                  {t.chooseDifferentTemplate}
                </Button>
              </div>
            ) : preflight ? (
              <div className="max-h-[380px] space-y-4 overflow-y-auto py-1 pr-1 text-xs">
                {/* Header Transition */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
                  <div>
                    <span className="text-[11px] text-muted-foreground">
                      {t.currentTemplate}
                    </span>
                    <p className="font-bold text-foreground">
                      {preflight.currentTemplate.name}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground" />
                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground">
                      {t.targetTemplate}
                    </span>
                    <p className="font-bold text-foreground">
                      {preflight.targetTemplate.name}
                    </p>
                  </div>
                </div>

                {/* Diff specifications */}
                <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                  <span className="text-xs font-semibold text-foreground">
                    {t.runtimeChanges}
                  </span>
                  <div className="space-y-1.5 pt-1 text-[11px]">
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">
                        {t.workloadController}
                      </span>
                      <span className="font-mono text-foreground">
                        {preflight.diff.workloadKind.current} ➔{" "}
                        {preflight.diff.workloadKind.target}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">
                        {t.defaultPort}
                      </span>
                      <span className="font-mono text-foreground">
                        {preflight.diff.port.current} ➔{" "}
                        {preflight.diff.port.target}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 pt-0.5">
                      <span className="text-muted-foreground">
                        {t.storagePolicy}
                      </span>
                      <p className="leading-relaxed text-foreground">
                        {preflight.diff.storage.warning ??
                          (preflight.diff.storage.policy === "REUSE_COMPATIBLE"
                            ? t.storageMountCompatible
                            : t.storageNotRequired)}
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
                        {t.dbRequirement}{" "}
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
                              {t.useManagedStock}
                            </span>
                            {preflight.dependencies.managedStockAvailable ? (
                              <Badge variant="success" className="text-[10px]">
                                {preflight.dependencies.availableStockCount}{" "}
                                {t.available}
                              </Badge>
                            ) : (
                              <Badge
                                variant="destructive"
                                className="text-[10px]"
                              >
                                {t.outOfStock}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {t.managedStockDescription}
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
                            {t.byodTitle}
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            {t.byodDescriptionPrefix}{" "}
                            {preflight.dependencies.requiredServiceType}{" "}
                            {t.byodDescriptionSuffix}
                          </p>
                        </div>
                      </label>

                      {/* BYOD Fields */}
                      {dependencyMode === "BYOD" && (
                        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/10 p-2.5 pt-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">{t.host}</Label>
                            <Input
                              value={byodHost}
                              onChange={(e) => setByodHost(e.target.value)}
                              placeholder="db.example.com"
                              className="h-8 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">{t.port}</Label>
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
                            <Label className="text-[11px]">{t.dbName}</Label>
                            <Input
                              value={byodDatabase}
                              onChange={(e) => setByodDatabase(e.target.value)}
                              placeholder={t.dbNamePlaceholder}
                              className="h-8 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">{t.user}</Label>
                            <Input
                              value={byodUser}
                              onChange={(e) => setByodUser(e.target.value)}
                              placeholder={t.dbUserPlaceholder}
                              className="h-8 font-mono text-xs"
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-[11px]">{t.password}</Label>
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
                      {t.requiredEnvs}
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
                {t.back}
              </Button>
              <Button
                size="sm"
                disabled={!preflight?.canProceed}
                onClick={() => setStep("CONFIRM")}
                className="text-xs"
              >
                {t.nextSafety} <ArrowRight size={14} className="ml-1" />
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
                <span>{t.confirmTitle}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {t.confirmDescription}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-emerald-700 dark:text-emerald-300">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle size={16} />
                  <span>{t.safetyChecksTitle}</span>
                </div>
                <ul className="list-disc space-y-1 pl-5 text-[11px] leading-relaxed">
                  <li>{t.safetySnapshot}</li>
                  <li>{t.safetyRollback}</li>
                  <li>
                    {t.safetyStoragePrefix}
                    {preflight.currentTemplate.storagePath ?? "/data"}
                    {t.safetyStorageSuffix}
                  </li>
                  <li>
                    {t.safetyDomainPrefix}
                    {stack.slug}
                    {t.safetyDomainSuffix}
                  </li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  {t.typeSlugPrompt}{" "}
                  <strong className="font-mono text-primary">
                    {stack.slug}
                  </strong>{" "}
                  {t.toConfirm}
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
                {t.back}
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
                    {t.deploying}
                  </>
                ) : (
                  t.confirmAndDeploy
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

"use client"

import React, { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Star,
  FloppyDisk,
  Trash,
  ShieldCheck,
  DownloadSimple,
  UploadSimple,
  Warning,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TemplateLogo } from "@/app/[lang]/console/app/marketplace/_components/template-logo"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  Trash as TrashIcon,
  Cpu,
  Database,
  HardDrive,
  Key,
  Copy,
  Lock,
  PushPin,
  EyeSlash,
  Eye,
} from "@phosphor-icons/react"
import { renderMarkdownFallback } from "@/lib/markdown"
import { sanitizeHtml } from "@/lib/sanitize-html"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { TemplateInstallationsTab } from "./template-installations-tab"
import type { AdminTemplateRecord } from "@/app/[lang]/portal/marketplace/_components/template-inspector-drawer"
import {
  appTemplateBlueprintSchema,
  type AppTemplateBlueprint,
  type AppTemplateBlueprintEnvVar,
  type AppTemplateBlueprintMount,
  type AppTemplatePackage,
} from "@/modules/deploy/blueprint/app-template-blueprint.schema"
import {
  exportTemplatePackage,
  validateTemplatePackage,
} from "@/modules/deploy/blueprint/app-template-blueprint.service"
export interface TemplateEditorFormProps {
  initialData?: AdminTemplateRecord | null
  isNew?: boolean
  onSave: (payload: Partial<AdminTemplateRecord>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onApprove?: (id: string) => Promise<void>
  onReject?: (id: string, notes: string) => Promise<void>
  onToggleFeatured?: (id: string) => Promise<void>
  isSaving?: boolean
}

export function TemplateEditorForm({
  initialData,
  isNew = false,
  onSave,
  onDelete,
  onApprove,
  onReject,
  onToggleFeatured,
  isSaving = false,
}: TemplateEditorFormProps) {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"

  const [name, setName] = useState(initialData?.name || "")
  const [slug, setSlug] = useState(initialData?.slug || "")
  const [tagline, setTagline] = useState(initialData?.tagline || "")
  const [description, setDescription] = useState(initialData?.description || "")
  const [readmeMarkdown, setReadmeMarkdown] = useState(
    initialData?.readmeMarkdown || ""
  )
  const [readmeTab, setReadmeTab] = useState<"write" | "preview">("write")
  const [iconUrl, setIconUrl] = useState(initialData?.iconUrl || "")
  const [websiteUrl, setWebsiteUrl] = useState(initialData?.websiteUrl || "")
  const [documentationUrl, setDocumentationUrl] = useState(
    initialData?.documentationUrl || ""
  )
  const [category, setCategory] = useState(initialData?.category || "UTILITIES")
  const [visibility, setVisibility] = useState(
    initialData?.visibility || (isNew ? "PUBLIC" : "PRIVATE")
  )
  const [version, setVersion] = useState(initialData?.version || "1.0.0")
  const [isOfficial, setIsOfficial] = useState(initialData?.isOfficial ?? true)
  const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured ?? false)
  const [priceMonthly, setPriceMonthly] = useState<string>(
    initialData?.priceMonthly?.toString() || ""
  )
  const [currency] = useState(initialData?.currency || "USD")

  // Modular Blueprint State
  const [runtimeImage, setRuntimeImage] = useState(
    initialData?.blueprintJson?.runtime?.image || "nginx:alpine"
  )
  const [defaultPort, setDefaultPort] = useState<number>(
    initialData?.blueprintJson?.runtime?.defaultPort || 80
  )
  const [healthCheckPath, setHealthCheckPath] = useState(
    initialData?.blueprintJson?.runtime?.healthCheckPath ||
      initialData?.blueprintJson?.runtime?.livenessProbe?.path ||
      ""
  )
  const [startupProbePath, setStartupProbePath] = useState(
    initialData?.blueprintJson?.runtime?.startupProbe?.path || ""
  )
  const [startupProbeDelay, setStartupProbeDelay] = useState<number>(
    initialData?.blueprintJson?.runtime?.startupProbe?.initialDelaySeconds ?? 10
  )
  const [startupProbeThreshold, setStartupProbeThreshold] = useState<number>(
    initialData?.blueprintJson?.runtime?.startupProbe?.failureThreshold ?? 30
  )
  const [readinessProbePath, setReadinessProbePath] = useState(
    initialData?.blueprintJson?.runtime?.readinessProbe?.path || ""
  )
  const [readinessProbeDelay, setReadinessProbeDelay] = useState<number>(
    initialData?.blueprintJson?.runtime?.readinessProbe?.initialDelaySeconds ??
      10
  )
  const [runAsNonRoot, setRunAsNonRoot] = useState(
    initialData?.blueprintJson?.runtime?.runAsNonRoot ?? true
  )
  const [deploymentType, setDeploymentType] = useState<
    "deployment" | "statefulset"
  >(initialData?.blueprintJson?.runtime?.deploymentType ?? "deployment")
  const [additionalPorts, setAdditionalPorts] = useState<
    Array<{ port: number; name: string }>
  >(initialData?.blueprintJson?.runtime?.additionalPorts || [])
  const [defaultCpu, setDefaultCpu] = useState<number>(
    initialData?.blueprintJson?.resources?.defaultCpu || 500
  )
  const [defaultMemory, setDefaultMemory] = useState<number>(
    initialData?.blueprintJson?.resources?.defaultMemory || 512
  )
  const [storageEnabled, setStorageEnabled] = useState(
    initialData?.blueprintJson?.storage?.enabled ?? false
  )
  const [storageMountPath, setStorageMountPath] = useState(
    initialData?.blueprintJson?.storage?.mountPath || "/data"
  )
  const [storageSizeGb, setStorageSizeGb] = useState<number>(
    initialData?.blueprintJson?.storage?.sizeGbDefault || 10
  )
  const [mounts, setMounts] = useState<AppTemplateBlueprintMount[]>(
    (initialData?.blueprintJson?.storage
      ?.mounts as AppTemplateBlueprintMount[]) || []
  )
  const [newMountType, setNewMountType] = useState<
    "pvc" | "configmap" | "secret" | "emptyDir"
  >("configmap")
  const [newMountName, setNewMountName] = useState("")
  const [newMountPath, setNewMountPath] = useState("")
  const [newMountSourceName, setNewMountSourceName] = useState("")
  const [newMountReadOnly, setNewMountReadOnly] = useState(false)
  const [dependencies, setDependencies] = useState<
    Array<{
      serviceType: "POSTGRESQL" | "MYSQL" | "REDIS"
      alias: string
      envPrefix: string
    }>
  >(initialData?.blueprintJson?.dependencies || [])

  const [envSchema, setEnvSchema] = useState<AppTemplateBlueprintEnvVar[]>(
    initialData?.blueprintJson?.envSchema || []
  )
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importJsonText, setImportJsonText] = useState("")
  const [activeTab, setActiveTab] = useState("general")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const handleSlugAutoFill = (val: string) => {
    setName(val)
    if (isNew && !slug) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      )
    }
  }

  const constructBlueprint = (): AppTemplateBlueprint => {
    const hasStorageOrMounts = storageEnabled || mounts.length > 0
    const trimmedHealthCheck = healthCheckPath.trim()
    return {
      version: "1.0.0",
      runtime: {
        image: runtimeImage,
        defaultPort,
        healthCheckPath: trimmedHealthCheck || undefined,
        ...(trimmedHealthCheck
          ? {
              livenessProbe: {
                path: trimmedHealthCheck,
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              ...(readinessProbePath.trim()
                ? {
                    readinessProbe: {
                      path: readinessProbePath.trim(),
                      initialDelaySeconds: readinessProbeDelay,
                      periodSeconds: 5,
                    },
                  }
                : {}),
              ...(startupProbePath.trim()
                ? {
                    startupProbe: {
                      path: startupProbePath.trim(),
                      initialDelaySeconds: startupProbeDelay,
                      periodSeconds: 5,
                      failureThreshold: startupProbeThreshold,
                    },
                  }
                : {}),
            }
          : {}),
        runAsNonRoot,
        deploymentType,
        additionalPorts,
      },
      resources: {
        defaultCpu,
        defaultMemory,
      },
      ...(hasStorageOrMounts
        ? {
            storage: {
              enabled: true,
              ...(storageEnabled
                ? {
                    mountPath: storageMountPath,
                    sizeGbDefault: storageSizeGb,
                  }
                : {}),
              mounts,
            },
            scaling: {
              allowAutoscale: false,
              maxReplicas: 1,
              advisoryNote:
                "Workloads with Persistent Storage (RWO) cannot be scaled horizontally across multiple nodes. Max replicas is locked to 1.",
            },
          }
        : {}),
      dependencies,
      envSchema: envSchema.map((item) => ({
        key: item.key.trim(),
        label: item.label.trim() || item.key.trim(),
        description: item.description?.trim() || undefined,
        defaultValue:
          item.defaultValue !== undefined && item.defaultValue !== ""
            ? item.defaultValue
            : undefined,
        required: Boolean(item.required),
        isSecret: Boolean(item.isSecret),
        dataType: item.dataType,
        options:
          item.dataType === "select" && item.options?.length
            ? item.options
            : undefined,
        generateRandomHex:
          item.generateRandomHex && item.generateRandomHex > 0
            ? Number(item.generateRandomHex)
            : undefined,
        isFixed: Boolean(item.isFixed),
        isHidden: Boolean(item.isHidden),
      })),
    }
  }

  const addMount = () => {
    if (!newMountName.trim() || !newMountPath.trim()) {
      toast.error("Mount name and mount path are required")
      return
    }
    const entry: AppTemplateBlueprintMount = {
      type: newMountType,
      name: newMountName.trim(),
      mountPath: newMountPath.trim(),
      sourceName: newMountSourceName.trim() || undefined,
      readOnly: newMountReadOnly,
    }
    setMounts((prev) => [...prev, entry])
    setNewMountName("")
    setNewMountPath("")
    setNewMountSourceName("")
    setNewMountReadOnly(false)
  }

  const removeMount = (index: number) => {
    setMounts((prev) => prev.filter((_, i) => i !== index))
  }

  const addEnvVar = () => {
    setEnvSchema([
      ...envSchema,
      {
        key: `ENV_VAR_${envSchema.length + 1}`,
        label: `Variable ${envSchema.length + 1}`,
        defaultValue: "",
        required: false,
        isSecret: false,
        dataType: "string",
      },
    ])
  }

  const removeEnvVar = (idx: number) => {
    setEnvSchema(envSchema.filter((_, i) => i !== idx))
  }

  const updateEnvVar = (
    idx: number,
    patch: Partial<AppTemplateBlueprintEnvVar>
  ) => {
    setEnvSchema(
      envSchema.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    )
  }

  const addAdditionalPort = () => {
    setAdditionalPorts([
      ...additionalPorts,
      { port: 8080, name: `port-${additionalPorts.length + 1}` },
    ])
  }

  const removeAdditionalPort = (idx: number) => {
    setAdditionalPorts(additionalPorts.filter((_, i) => i !== idx))
  }

  const updateAdditionalPort = (
    idx: number,
    patch: Partial<(typeof additionalPorts)[0]>
  ) => {
    setAdditionalPorts(
      additionalPorts.map((item, i) =>
        i === idx ? { ...item, ...patch } : item
      )
    )
  }

  const toggleDependency = (type: "POSTGRESQL" | "MYSQL" | "REDIS") => {
    const exists = dependencies.some((d) => d.serviceType === type)
    if (exists) {
      setDependencies(dependencies.filter((d) => d.serviceType !== type))
    } else {
      setDependencies([
        ...dependencies,
        {
          serviceType: type,
          alias: type.toLowerCase(),
          envPrefix: type === "POSTGRESQL" ? "DB" : type,
        },
      ])
    }
  }

  const handleExportJson = () => {
    const blueprint = constructBlueprint()
    const pkg = exportTemplatePackage({
      name: name.trim() || "template",
      slug: slug.trim() || "template",
      tagline: tagline.trim() || undefined,
      description: description.trim() || undefined,
      category,
      iconUrl: iconUrl.trim() || undefined,
      websiteUrl: websiteUrl.trim() || undefined,
      documentationUrl: documentationUrl.trim() || undefined,
      blueprint,
    })

    const blob = new Blob([JSON.stringify(pkg, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${slug.trim() || "template"}-template.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Template exported as JSON")
  }

  const handleApplyImport = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr)
      // Support full template package or bare blueprint
      let meta: Partial<AppTemplatePackage["metadata"]> = {}
      let bp: AppTemplateBlueprint

      if (parsed && typeof parsed === "object" && "blueprint" in parsed) {
        const validation = validateTemplatePackage(parsed)
        if (!validation.valid || !validation.data) {
          const firstErr =
            Object.values(validation.errors || {})[0] ||
            "Invalid package structure"
          toast.error(`Invalid template package: ${firstErr}`)
          return
        }
        meta = validation.data.metadata
        bp = validation.data.blueprint
      } else {
        const parseResult = appTemplateBlueprintSchema.safeParse(parsed)
        if (!parseResult.success) {
          const firstIssue =
            parseResult.error.issues[0]?.message ||
            "Invalid blueprint structure"
          toast.error(`Invalid blueprint schema: ${firstIssue}`)
          return
        }
        bp = parseResult.data
      }

      if (meta.name) setName(meta.name)
      if (meta.slug) setSlug(meta.slug)
      if (meta.tagline !== undefined) setTagline(meta.tagline)
      if (meta.description !== undefined) setDescription(meta.description)
      if (meta.category) setCategory(meta.category)
      if (meta.iconUrl !== undefined) setIconUrl(meta.iconUrl)
      if (meta.websiteUrl !== undefined) setWebsiteUrl(meta.websiteUrl)
      if (meta.documentationUrl !== undefined)
        setDocumentationUrl(meta.documentationUrl)

      if (bp.runtime) {
        if (bp.runtime.image) setRuntimeImage(bp.runtime.image)
        if (bp.runtime.defaultPort) setDefaultPort(bp.runtime.defaultPort)
        if (bp.runtime.healthCheckPath !== undefined)
          setHealthCheckPath(bp.runtime.healthCheckPath)
        else if (bp.runtime.livenessProbe?.path)
          setHealthCheckPath(bp.runtime.livenessProbe.path)
        if (bp.runtime.runAsNonRoot !== undefined)
          setRunAsNonRoot(bp.runtime.runAsNonRoot)
        if (bp.runtime.deploymentType)
          setDeploymentType(bp.runtime.deploymentType)
        if (bp.runtime.additionalPorts)
          setAdditionalPorts(bp.runtime.additionalPorts)
      }

      if (bp.resources) {
        if (bp.resources.defaultCpu) setDefaultCpu(bp.resources.defaultCpu)
        if (bp.resources.defaultMemory)
          setDefaultMemory(bp.resources.defaultMemory)
      }

      if (bp.storage) {
        setStorageEnabled(Boolean(bp.storage.enabled))
        if (bp.storage.mountPath) setStorageMountPath(bp.storage.mountPath)
        if (bp.storage.sizeGbDefault) setStorageSizeGb(bp.storage.sizeGbDefault)
      } else {
        setStorageEnabled(false)
      }

      if (Array.isArray(bp.dependencies)) {
        setDependencies(bp.dependencies)
      }

      if (Array.isArray(bp.envSchema)) {
        setEnvSchema(bp.envSchema)
      }

      setShowImportDialog(false)
      setImportJsonText("")
      toast.success("Template configuration imported successfully!")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid JSON syntax"
      toast.error(`Import failed: ${msg}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedBlueprint = constructBlueprint()
    if (!name.trim()) {
      toast.error("Template name is required")
      setActiveTab("general")
      return
    }
    if (!slug.trim()) {
      toast.error("Template slug is required")
      setActiveTab("general")
      return
    }

    const payload: Partial<AdminTemplateRecord> = {
      name: name.trim(),
      slug: slug.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      readmeMarkdown: readmeMarkdown.trim() || null,
      iconUrl: iconUrl.trim() || null,
      category,
      visibility,
      version: version.trim() || "1.0.0",
      blueprintJson: parsedBlueprint,
      isOfficial,
      isFeatured,
      priceMonthly: priceMonthly ? Number(priceMonthly) : undefined,
      currency,
    }

    try {
      await onSave(payload)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save template"
      toast.error(msg)
    }
  }

  const handleDelete = async () => {
    if (!initialData?.id || !onDelete) return
    try {
      await onDelete(initialData.id)
      router.push(`/${lang}/portal/app/templates`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete"
      toast.error(msg)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-1 flex-col gap-6 p-6 pt-0"
    >
      {/* Top Header / Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => router.push(`/${lang}/portal/app/templates`)}
            className="size-8"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">
                {isNew
                  ? "Create Marketplace Template"
                  : `Edit ${name || "Template"}`}
              </h1>
              {isOfficial && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <ShieldCheck className="size-3 text-emerald-500" />
                  Official
                </Badge>
              )}
              {isFeatured && (
                <Badge variant="default" className="gap-1 text-xs">
                  <Star className="size-3 fill-amber-400" />
                  Featured
                </Badge>
              )}
            </div>
            {isNew ? (
              <p className="text-xs text-muted-foreground">
                Author first-party stack or community blueprint with full
                configuration specs.
              </p>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">Version {version}</span>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    if (initialData?.id) {
                      navigator.clipboard.writeText(initialData.id)
                      toast.success("Template ID copied to clipboard")
                    }
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  title="Click to copy full ID"
                >
                  <Copy className="size-3" />
                  <span>
                    ID:{" "}
                    {initialData?.id ? `${initialData.id.slice(0, 12)}...` : ""}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowImportDialog(true)}
            className="gap-1.5 text-xs"
          >
            <UploadSimple className="size-4" /> Import JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            className="gap-1.5 text-xs"
          >
            <DownloadSimple className="size-4" /> Export JSON
          </Button>
          {!isNew && initialData?.id && (
            <>
              {initialData.visibility === "PENDING_REVIEW" && onApprove && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onApprove(initialData.id)}
                  className="gap-1 text-emerald-600 hover:text-emerald-700"
                >
                  <CheckCircle className="size-4" /> Approve
                </Button>
              )}
              {initialData.visibility === "PENDING_REVIEW" && onReject && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectDialog(true)}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <XCircle className="size-4" /> Reject
                </Button>
              )}
              {onToggleFeatured && (
                <Button
                  type="button"
                  variant={isFeatured ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsFeatured(!isFeatured)
                    onToggleFeatured(initialData.id)
                  }}
                  className="gap-1 text-xs"
                >
                  <Star
                    className={`size-4 ${isFeatured ? "fill-amber-400 text-amber-400" : ""}`}
                  />
                  {isFeatured ? "Unfeature" : "Feature"}
                </Button>
              )}
              {onDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-1 text-destructive hover:bg-destructive/10"
                >
                  <Trash className="size-4" /> Delete
                </Button>
              )}
            </>
          )}

          <Button
            type="submit"
            disabled={isSaving}
            className="gap-1.5 bg-primary text-primary-foreground"
          >
            <FloppyDisk className="size-4" />
            {isSaving
              ? "Saving..."
              : isNew
                ? "Create Template"
                : "Save Changes"}
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList
          className={`grid w-full ${!isNew && initialData?.id ? "grid-cols-4" : "grid-cols-3"}`}
        >
          <TabsTrigger value="general">General &amp; Docs</TabsTrigger>
          <TabsTrigger value="runtime">Runtime &amp; Services</TabsTrigger>
          <TabsTrigger value="env">Env Schema</TabsTrigger>
          {!isNew && initialData?.id && (
            <TabsTrigger value="installations">Installations</TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: General Info */}
        <TabsContent value="general" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Identity & Presentation
                </CardTitle>
                <CardDescription>
                  Primary marketplace catalog listing info
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="template-name">Display Name *</Label>
                  <Input
                    id="template-name"
                    data-testid="template-name-input"
                    value={name}
                    onChange={(e) => handleSlugAutoFill(e.target.value)}
                    placeholder="e.g. n8n Automation"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-slug">URL Slug *</Label>
                  <Input
                    id="template-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. n8n"
                    className="font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-tagline">Tagline / Short Hook</Label>
                  <Input
                    id="template-tagline"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Fair-code workflow automation platform"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-desc">Description *</Label>
                  <Textarea
                    id="template-desc"
                    data-testid="template-desc-input"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed explanation of features and capabilities"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-icon">
                    Icon URL / SVG identifier
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30 p-1.5">
                      <TemplateLogo
                        slug={slug}
                        name={name}
                        iconUrl={iconUrl}
                        className="size-full"
                      />
                    </div>
                    <Input
                      id="template-icon"
                      value={iconUrl}
                      onChange={(e) => setIconUrl(e.target.value)}
                      placeholder="e.g. /app-hosting/icons/n8n.svg or https://..."
                      className="flex-1 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Catalog &amp; Pricing
                </CardTitle>
                <CardDescription>
                  Marketplace catalog, category, and commercial terms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="template-category">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="template-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AI">AI</SelectItem>
                        <SelectItem value="AUTOMATION">Automation</SelectItem>
                        <SelectItem value="CMS">CMS</SelectItem>
                        <SelectItem value="DATABASE">Database</SelectItem>
                        <SelectItem value="DEVELOPER_TOOLS">
                          Developer Tools
                        </SelectItem>
                        <SelectItem value="ANALYTICS">Analytics</SelectItem>
                        <SelectItem value="UTILITIES">Utilities</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="template-visibility">
                      Visibility Status
                    </Label>
                    <Select
                      value={visibility}
                      onValueChange={(
                        v:
                          | "PRIVATE"
                          | "PENDING_REVIEW"
                          | "PUBLIC"
                          | "REJECTED"
                          | "UNLISTED"
                      ) => setVisibility(v)}
                    >
                      <SelectTrigger id="template-visibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PUBLIC">PUBLIC (Live)</SelectItem>
                        <SelectItem value="PENDING_REVIEW">
                          PENDING_REVIEW
                        </SelectItem>
                        <SelectItem value="PRIVATE">PRIVATE</SelectItem>
                        <SelectItem value="REJECTED">REJECTED</SelectItem>
                        <SelectItem value="UNLISTED">UNLISTED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="template-version">Release Version</Label>
                    <Input
                      id="template-version"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0.0"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="template-price">
                      Monthly Price (USD $)
                    </Label>
                    <div className="relative">
                      <span className="absolute top-1/2 left-3 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="template-price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={priceMonthly}
                        onChange={(e) => setPriceMonthly(e.target.value)}
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">
                        Official Platform Template
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Verified and guaranteed first-party stack
                      </p>
                    </div>
                    <Switch
                      checked={isOfficial}
                      onCheckedChange={setIsOfficial}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">
                        Featured on Marketplace
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Highlight template on marketplace top showcase
                      </p>
                    </div>
                    <Switch
                      checked={isFeatured}
                      onCheckedChange={setIsFeatured}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">
                  Template Documentation (Markdown)
                </CardTitle>
                <CardDescription>
                  Full readme and deployment manual shown in template detail
                  view
                </CardDescription>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 text-xs">
                <Button
                  type="button"
                  size="sm"
                  variant={readmeTab === "write" ? "secondary" : "ghost"}
                  onClick={() => setReadmeTab("write")}
                  className="h-7 px-2.5 text-xs"
                >
                  Write
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={readmeTab === "preview" ? "secondary" : "ghost"}
                  onClick={() => setReadmeTab("preview")}
                  className="h-7 px-2.5 text-xs"
                >
                  Preview
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {readmeTab === "write" ? (
                <Textarea
                  rows={12}
                  value={readmeMarkdown}
                  onChange={(e) => setReadmeMarkdown(e.target.value)}
                  placeholder="# Getting Started with this Stack..."
                  className="font-mono text-xs"
                />
              ) : (
                <div className="prose prose-sm max-h-[380px] min-h-[240px] max-w-none overflow-y-auto rounded-md border p-4 text-foreground dark:prose-invert">
                  {readmeMarkdown.trim() ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(
                          renderMarkdownFallback(readmeMarkdown)
                        ),
                      }}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No documentation written yet.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Runtime & Compute Specs */}
        <TabsContent value="runtime" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cpu className="size-4" /> Container Runtime
                </CardTitle>
                <CardDescription>
                  Docker image, container port, and health check path
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="runtime-image">Docker Image *</Label>
                  <Input
                    id="runtime-image"
                    value={runtimeImage}
                    onChange={(e) => setRuntimeImage(e.target.value)}
                    placeholder="e.g. n8nio/n8n:latest"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="runtime-port">Default Port *</Label>
                    <Input
                      id="runtime-port"
                      type="number"
                      value={defaultPort}
                      onChange={(e) =>
                        setDefaultPort(parseInt(e.target.value) || 80)
                      }
                      placeholder="80"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="runtime-deployment-type">
                      Workload Type
                    </Label>
                    <Select
                      value={deploymentType}
                      onValueChange={(v: "deployment" | "statefulset") =>
                        setDeploymentType(v)
                      }
                    >
                      <SelectTrigger id="runtime-deployment-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deployment">Deployment</SelectItem>
                        <SelectItem value="statefulset">StatefulSet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      Health Checks &amp; Container Probes
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Configure health endpoints to monitor container status and
                      prevent boot loops.
                    </p>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="runtime-health" className="text-xs">
                      Liveness Probe Path (Health Check Endpoint)
                    </Label>
                    <Input
                      id="runtime-health"
                      value={healthCheckPath}
                      onChange={(e) => setHealthCheckPath(e.target.value)}
                      placeholder="e.g. /healthz or /api/ping (leave empty to disable all probes)"
                      className="h-8 text-xs"
                    />
                  </div>

                  {healthCheckPath.trim() ? (
                    <div className="space-y-3 border-t pt-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="startup-probe" className="text-xs">
                            Startup Probe Path
                          </Label>
                          <Input
                            id="startup-probe"
                            value={startupProbePath}
                            onChange={(e) =>
                              setStartupProbePath(e.target.value)
                            }
                            placeholder="e.g. /health/startup (optional)"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="startup-delay" className="text-xs">
                            Startup Delay (s)
                          </Label>
                          <Input
                            id="startup-delay"
                            type="number"
                            value={startupProbeDelay}
                            onChange={(e) =>
                              setStartupProbeDelay(
                                parseInt(e.target.value) || 10
                              )
                            }
                            placeholder="10"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="startup-threshold"
                            className="text-xs"
                          >
                            Startup Threshold
                          </Label>
                          <Input
                            id="startup-threshold"
                            type="number"
                            value={startupProbeThreshold}
                            onChange={(e) =>
                              setStartupProbeThreshold(
                                parseInt(e.target.value) || 30
                              )
                            }
                            placeholder="30"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="readiness-probe" className="text-xs">
                            Readiness Probe Path
                          </Label>
                          <Input
                            id="readiness-probe"
                            value={readinessProbePath}
                            onChange={(e) =>
                              setReadinessProbePath(e.target.value)
                            }
                            placeholder="e.g. /health/ready (optional)"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="readiness-delay" className="text-xs">
                            Readiness Initial Delay (s)
                          </Label>
                          <Input
                            id="readiness-delay"
                            type="number"
                            value={readinessProbeDelay}
                            onChange={(e) =>
                              setReadinessProbeDelay(
                                parseInt(e.target.value) || 10
                              )
                            }
                            placeholder="10"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded border border-dashed border-muted p-2 text-center text-[11px] text-muted-foreground">
                      Startup &amp; Readiness probes are inactive while Liveness
                      Probe path is empty.
                    </div>
                  )}
                </div>
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">
                        Additional Ports
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Extra container ports beyond the default port
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAdditionalPort}
                      className="gap-1 text-xs"
                    >
                      <Plus className="size-3.5" /> Add Port
                    </Button>
                  </div>
                  {additionalPorts.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={item.port}
                        onChange={(e) =>
                          updateAdditionalPort(idx, {
                            port: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="9119"
                        className="h-8 text-xs"
                      />
                      <Input
                        value={item.name}
                        onChange={(e) =>
                          updateAdditionalPort(idx, { name: e.target.value })
                        }
                        placeholder="dashboard"
                        className="h-8 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAdditionalPort(idx)}
                        className="size-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      Run as Non-Root
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enforces pod security standards
                    </p>
                  </div>
                  <Switch
                    checked={runAsNonRoot}
                    onCheckedChange={setRunAsNonRoot}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HardDrive className="size-4" /> Resources & Storage
                </CardTitle>
                <CardDescription>
                  Compute allocations and persistent storage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="res-cpu">Default CPU (mCPU)</Label>
                      <span className="text-[11px] text-muted-foreground">
                        = {(defaultCpu / 1000).toFixed(2)} vCPU (1000m = 1 vCPU)
                      </span>
                    </div>
                    <Input
                      id="res-cpu"
                      type="number"
                      min={50}
                      step={50}
                      value={defaultCpu}
                      onChange={(e) =>
                        setDefaultCpu(parseInt(e.target.value) || 500)
                      }
                      placeholder="500 mCPU"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="res-mem">Default Memory (MB)</Label>
                      <span className="text-[11px] text-muted-foreground">
                        ={" "}
                        {defaultMemory >= 1024
                          ? `${(defaultMemory / 1024).toFixed(1)} GB`
                          : `${defaultMemory} MB`}
                      </span>
                    </div>
                    <Input
                      id="res-mem"
                      type="number"
                      min={64}
                      step={64}
                      value={defaultMemory}
                      onChange={(e) =>
                        setDefaultMemory(parseInt(e.target.value) || 512)
                      }
                      placeholder="512 MB"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">
                        Persistent Storage
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Mount dedicated PVC for data persistence
                      </p>
                    </div>
                    <Switch
                      checked={storageEnabled}
                      onCheckedChange={setStorageEnabled}
                    />
                  </div>
                  {storageEnabled && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="storage-mount">Mount Path</Label>
                        <Input
                          id="storage-mount"
                          value={storageMountPath}
                          onChange={(e) => setStorageMountPath(e.target.value)}
                          placeholder="/data"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="storage-size">Default Size (GB)</Label>
                        <Input
                          id="storage-size"
                          type="number"
                          value={storageSizeGb}
                          onChange={(e) =>
                            setStorageSizeGb(parseInt(e.target.value) || 10)
                          }
                          placeholder="10"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Autoscaling Advisory Alert */}
                {(storageEnabled || mounts.length > 0) && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                    <Warning className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="space-y-1">
                      <p className="font-semibold">
                        Single-Node Storage Constraint:
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Workloads with dedicated persistent storage (RWO) cannot
                        be scaled horizontally across multiple nodes (maximum
                        replicas is locked to 1) to prevent volume attachment
                        conflicts.
                      </p>
                    </div>
                  </div>
                )}

                {/* Additional Volume Mounts (ConfigMap, Secret, PVC, EmptyDir) */}
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      Volume Mounts (ConfigMap, Secret, PVC, EmptyDir)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Mount configuration files, certificates, or additional
                      storage volumes
                    </p>
                  </div>

                  {mounts.length > 0 && (
                    <div className="space-y-2 border-t pt-2">
                      {mounts.map((m, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded border bg-muted/30 p-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] uppercase"
                            >
                              {m.type}
                            </Badge>
                            <span className="font-semibold">{m.name}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-mono text-muted-foreground">
                              {m.mountPath}
                            </span>
                            {m.sourceName && (
                              <span className="text-[10px] text-muted-foreground">
                                ({m.sourceName})
                              </span>
                            )}
                            {m.readOnly && (
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
                                RO
                              </Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMount(idx)}
                            className="size-6 text-destructive hover:bg-destructive/10"
                          >
                            <Trash className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Mount Input Row */}
                  <div className="space-y-2 rounded border border-dashed bg-muted/10 p-2.5">
                    <p className="text-[11px] font-medium text-foreground">
                      Add New Mount
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Type</Label>
                        <Select
                          value={newMountType}
                          onValueChange={(
                            v: "pvc" | "configmap" | "secret" | "emptyDir"
                          ) => setNewMountType(v)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="configmap">ConfigMap</SelectItem>
                            <SelectItem value="secret">Secret</SelectItem>
                            <SelectItem value="pvc">PVC</SelectItem>
                            <SelectItem value="emptyDir">EmptyDir</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Volume Name *</Label>
                        <Input
                          value={newMountName}
                          onChange={(e) => setNewMountName(e.target.value)}
                          placeholder="e.g. app-config"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Mount Path *</Label>
                        <Input
                          value={newMountPath}
                          onChange={(e) => setNewMountPath(e.target.value)}
                          placeholder="e.g. /etc/config"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Source Name</Label>
                        <Input
                          value={newMountSourceName}
                          onChange={(e) =>
                            setNewMountSourceName(e.target.value)
                          }
                          placeholder="ConfigMap/Secret name"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="mount-readonly"
                          checked={newMountReadOnly}
                          onCheckedChange={(c) =>
                            setNewMountReadOnly(Boolean(c))
                          }
                        />
                        <Label
                          htmlFor="mount-readonly"
                          className="cursor-pointer text-[11px]"
                        >
                          Mount as Read-Only
                        </Label>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addMount}
                        className="h-7 gap-1 text-xs"
                      >
                        <Plus className="size-3" /> Add Mount
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="size-4" /> Managed Database & Cache
                Dependencies
              </CardTitle>
              <CardDescription>
                Select required add-on services that platform will automatically
                provision and inject
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(["POSTGRESQL", "MYSQL", "REDIS"] as const).map((type) => {
                  const dep = dependencies.find((d) => d.serviceType === type)
                  const isSelected = Boolean(dep)
                  return (
                    <div
                      key={type}
                      className={`flex flex-col justify-between rounded-lg border p-4 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{type}</span>
                        <Switch
                          checked={isSelected}
                          onCheckedChange={() => toggleDependency(type)}
                        />
                      </div>
                      {isSelected && dep && (
                        <div className="mt-3 space-y-2 text-xs">
                          <div>
                            <Label className="text-xs">ENV Prefix</Label>
                            <Input
                              size={1}
                              value={dep.envPrefix}
                              onChange={(e) => {
                                setDependencies(
                                  dependencies.map((d) =>
                                    d.serviceType === type
                                      ? { ...d, envPrefix: e.target.value }
                                      : d
                                  )
                                )
                              }}
                              placeholder={type === "POSTGRESQL" ? "DB" : type}
                              className="h-7 font-mono text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Env Schema Builder */}
        <TabsContent value="env" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Key className="size-4" /> Environment Variables Schema
                </CardTitle>
                <CardDescription>
                  Define configurable environment variables with typing, default
                  values, and secrets
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEnvVar}
                className="gap-1 text-xs"
              >
                <Plus className="size-3.5" /> Add Variable
              </Button>
            </CardHeader>
            <CardContent>
              {envSchema.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  <p className="text-sm">No environment variables defined.</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addEnvVar}
                    className="mt-2 text-xs text-primary"
                  >
                    + Add your first variable
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {envSchema.map((item, idx) => (
                    <div
                      key={idx}
                      className="space-y-3 rounded-lg border bg-card p-4 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              Key <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              value={item.key}
                              onChange={(e) =>
                                updateEnvVar(idx, { key: e.target.value })
                              }
                              placeholder="e.g. DATA_DIR"
                              className="h-8 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              Label <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              value={item.label}
                              onChange={(e) =>
                                updateEnvVar(idx, { label: e.target.value })
                              }
                              placeholder="e.g. Data Directory"
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">Type</Label>
                            <Select
                              value={item.dataType}
                              onValueChange={(
                                val: "string" | "number" | "boolean" | "select"
                              ) => updateEnvVar(idx, { dataType: val })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">string</SelectItem>
                                <SelectItem value="number">number</SelectItem>
                                <SelectItem value="boolean">boolean</SelectItem>
                                <SelectItem value="select">select</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              Default Value
                            </Label>
                            <Input
                              value={item.defaultValue || ""}
                              onChange={(e) =>
                                updateEnvVar(idx, {
                                  defaultValue: e.target.value,
                                })
                              }
                              placeholder="e.g. /app/data"
                              className="h-8 font-mono text-xs"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEnvVar(idx)}
                          className="mt-6 size-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1 lg:col-span-2">
                          <Label className="text-xs font-medium text-muted-foreground">
                            Description (User Helper Text)
                          </Label>
                          <Input
                            value={item.description || ""}
                            onChange={(e) =>
                              updateEnvVar(idx, {
                                description: e.target.value,
                              })
                            }
                            placeholder="e.g. Admin key for gateway configuration and key issuance"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-muted-foreground">
                            Generate Random Hex (Length)
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            value={item.generateRandomHex ?? ""}
                            onChange={(e) => {
                              const num = parseInt(e.target.value, 10)
                              updateEnvVar(idx, {
                                generateRandomHex:
                                  isNaN(num) || num <= 0 ? undefined : num,
                              })
                            }}
                            placeholder="Length in chars (e.g. 32)"
                            className="h-8 font-mono text-xs"
                          />
                        </div>
                      </div>

                      {item.dataType === "select" && (
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-muted-foreground">
                            Options (Comma-separated)
                          </Label>
                          <Input
                            value={item.options?.join(", ") || ""}
                            onChange={(e) => {
                              const opts = e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean)
                              updateEnvVar(idx, { options: opts })
                            }}
                            placeholder="e.g. dev, staging, production"
                            className="h-8 text-xs"
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-6 border-t border-border/50 pt-2 text-xs">
                        <label className="flex cursor-pointer items-center gap-2">
                          <Checkbox
                            checked={item.required}
                            onCheckedChange={(checked) =>
                              updateEnvVar(idx, {
                                required: Boolean(checked),
                              })
                            }
                          />
                          <span className="font-medium">Required</span>
                          <span className="text-[11px] text-muted-foreground">
                            (Must be set)
                          </span>
                        </label>

                        <label className="flex cursor-pointer items-center gap-2">
                          <Checkbox
                            checked={item.isSecret}
                            onCheckedChange={(checked) =>
                              updateEnvVar(idx, {
                                isSecret: Boolean(checked),
                              })
                            }
                          />
                          <span className="flex items-center gap-1 font-medium">
                            <Lock className="size-3.5 text-muted-foreground" />
                            Secret
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            (Masked input)
                          </span>
                        </label>

                        <label className="flex cursor-pointer items-center gap-2">
                          <Checkbox
                            checked={Boolean(item.isFixed)}
                            onCheckedChange={(checked) =>
                              updateEnvVar(idx, {
                                isFixed: Boolean(checked),
                              })
                            }
                          />
                          <span className="flex items-center gap-1 font-medium">
                            <PushPin className="size-3.5 text-muted-foreground" />
                            Fixed
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            (Locked for tenant)
                          </span>
                        </label>

                        <label className="flex cursor-pointer items-center gap-2">
                          <Checkbox
                            checked={Boolean(item.isHidden)}
                            onCheckedChange={(checked) =>
                              updateEnvVar(idx, {
                                isHidden: Boolean(checked),
                              })
                            }
                          />
                          <span className="flex items-center gap-1 font-medium">
                            <EyeSlash className="size-3.5 text-muted-foreground" />
                            Hidden
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            (Hidden in deploy drawer)
                          </span>
                        </label>
                      </div>
                    </div>
                  ))}

                  {envSchema.length > 0 && (
                    <div className="mt-6 rounded-lg border border-border bg-muted/20 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Eye className="size-4 text-primary" />
                        <span className="text-xs font-semibold tracking-wider text-foreground uppercase">
                          Deploy Drawer Preview
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          — Live preview of how tenants will see these inputs
                          during deployment
                        </span>
                      </div>

                      <div className="space-y-3 rounded-md border bg-card p-4">
                        {envSchema.map((item, idx) => {
                          if (item.isHidden) {
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between rounded border border-dashed border-muted bg-muted/30 p-2 text-xs text-muted-foreground"
                              >
                                <span className="font-mono">
                                  {item.key || `VAR_${idx + 1}`}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] italic">
                                  <EyeSlash className="size-3" /> Hidden from
                                  tenant
                                </span>
                              </div>
                            )
                          }

                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-1 text-xs font-medium">
                                  {item.label ||
                                    item.key ||
                                    `Variable ${idx + 1}`}
                                  {item.required && (
                                    <span className="text-destructive">*</span>
                                  )}
                                </Label>
                                <div className="flex items-center gap-1.5">
                                  {item.isFixed && (
                                    <Badge
                                      variant="outline"
                                      className="h-4 gap-0.5 px-1 text-[10px] text-muted-foreground"
                                    >
                                      <PushPin className="size-2.5" /> Locked
                                    </Badge>
                                  )}
                                  {item.isSecret && (
                                    <Badge
                                      variant="outline"
                                      className="h-4 gap-0.5 px-1 text-[10px] text-amber-600 dark:text-amber-400"
                                    >
                                      <Lock className="size-2.5" /> Secret
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {item.description && (
                                <p className="text-[11px] text-muted-foreground">
                                  {item.description}
                                </p>
                              )}
                              <Input
                                disabled={item.isFixed}
                                type={item.isSecret ? "password" : "text"}
                                value={
                                  item.isSecret && item.defaultValue
                                    ? "••••••••"
                                    : item.defaultValue || ""
                                }
                                readOnly
                                placeholder={
                                  item.defaultValue
                                    ? undefined
                                    : item.isSecret
                                      ? "Enter secret value..."
                                      : "Enter value..."
                                }
                                className="h-8 bg-background/80 text-xs"
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {!isNew && initialData?.id && (
          <TabsContent value="installations" className="space-y-4">
            <TemplateInstallationsTab
              templateId={initialData.id}
              templateName={name || initialData.name}
              targetDeploymentType={deploymentType}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete template &ldquo;{name}
              &rdquo;? Existing deployed stacks will not be disrupted, but this
              blueprint will be removed from marketplace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Note Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Template Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Provide clear feedback explaining why this template submission was
              rejected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              rows={3}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="e.g. Container image runs as root user or invalid database prefix..."
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (initialData?.id && onReject && rejectNotes.trim()) {
                  onReject(initialData.id, rejectNotes.trim())
                  setShowRejectDialog(false)
                }
              }}
              disabled={!rejectNotes.trim()}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import JSON Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Import Template Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Paste a template package JSON exported from another environment
              (e.g. dev/staging) or upload a .json file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".json,application/json"
                id="import-json-file-input"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = (evt) => {
                      const text = evt.target?.result as string
                      if (text) {
                        setImportJsonText(text)
                      }
                    }
                    reader.readAsText(file)
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  document.getElementById("import-json-file-input")?.click()
                }}
                className="gap-1.5 text-xs"
              >
                <UploadSimple className="size-3.5" /> Upload File (.json)
              </Button>
              {importJsonText && (
                <span className="text-xs text-muted-foreground">
                  File loaded ({importJsonText.length} bytes)
                </span>
              )}
            </div>
            <Textarea
              rows={10}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='{"exportVersion":"1.0.0","metadata":{"name":"..."},"blueprint":{...}}'
              className="font-mono text-xs"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setImportJsonText("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleApplyImport(importJsonText)}
              disabled={!importJsonText.trim()}
              className="bg-primary text-primary-foreground"
            >
              Apply Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

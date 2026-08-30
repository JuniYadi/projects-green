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
} from "@phosphor-icons/react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import type { AdminTemplateRecord } from "@/app/[lang]/portal/marketplace/_components/template-inspector-drawer"
import type { AppTemplateBlueprint } from "@/modules/deploy/blueprint/app-template-blueprint.schema"

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
  const [iconUrl, setIconUrl] = useState(initialData?.iconUrl || "")
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
    initialData?.blueprintJson?.runtime?.healthCheckPath || "/healthz"
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
  const [dependencies, setDependencies] = useState<
    Array<{
      serviceType: "POSTGRESQL" | "MYSQL" | "REDIS"
      alias: string
      envPrefix: string
    }>
  >(initialData?.blueprintJson?.dependencies || [])

  const [envSchema, setEnvSchema] = useState<
    Array<{
      key: string
      label: string
      description?: string
      defaultValue?: string
      required: boolean
      isSecret: boolean
      dataType: "string" | "number" | "boolean" | "select"
    }>
  >(initialData?.blueprintJson?.envSchema || [])

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

  const constructBlueprint = (): AppTemplateBlueprint => ({
    version: "1.0.0",
    runtime: {
      image: runtimeImage,
      defaultPort,
      healthCheckPath: healthCheckPath || undefined,
      runAsNonRoot,
      deploymentType,
      additionalPorts,
    },
    resources: {
      defaultCpu,
      defaultMemory,
    },
    ...(storageEnabled
      ? {
          storage: {
            enabled: true,
            mountPath: storageMountPath,
            sizeGbDefault: storageSizeGb,
          },
        }
      : {}),
    dependencies,
    envSchema,
  })

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

  const updateEnvVar = (idx: number, patch: Partial<(typeof envSchema)[0]>) => {
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
            <p className="text-xs text-muted-foreground">
              {isNew
                ? "Author first-party stack or community blueprint with full configuration specs."
                : `ID: ${initialData?.id} · Version: ${version}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">1. General</TabsTrigger>
          <TabsTrigger value="runtime">2. Runtime & Specs</TabsTrigger>
          <TabsTrigger value="dependencies">3. Dependencies</TabsTrigger>
          <TabsTrigger value="env">4. Env Schema</TabsTrigger>
          <TabsTrigger value="documentation">5. Readme & Docs</TabsTrigger>
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
                  Governance & Classification
                </CardTitle>
                <CardDescription>
                  Category, visibility, and commercial terms
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
                    <Label htmlFor="runtime-health">Health Check Path</Label>
                    <Input
                      id="runtime-health"
                      value={healthCheckPath}
                      onChange={(e) => setHealthCheckPath(e.target.value)}
                      placeholder="/healthz"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="runtime-deployment-type">Workload Type</Label>
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
                      <Label htmlFor="res-cpu">Default CPU</Label>
                      <span className="text-[11px] text-muted-foreground">
                        {(defaultCpu / 1000).toFixed(2)} vCPU
                      </span>
                    </div>
                    <Input
                      id="res-cpu"
                      type="number"
                      value={defaultCpu}
                      onChange={(e) =>
                        setDefaultCpu(parseInt(e.target.value) || 500)
                      }
                      placeholder="500 mCPU"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="res-mem">Default Memory</Label>
                      <span className="text-[11px] text-muted-foreground">
                        {defaultMemory >= 1024
                          ? `${(defaultMemory / 1024).toFixed(1)} GB`
                          : `${defaultMemory} MB`}
                      </span>
                    </div>
                    <Input
                      id="res-mem"
                      type="number"
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Dependencies */}
        <TabsContent value="dependencies" className="space-y-4">
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

        {/* Tab 4: Env Schema Builder */}
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
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Default</TableHead>
                        <TableHead className="w-20 text-center text-xs">
                          Required
                        </TableHead>
                        <TableHead className="w-20 text-center text-xs">
                          Secret 🔒
                        </TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {envSchema.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="p-2">
                            <Input
                              value={item.key}
                              onChange={(e) =>
                                updateEnvVar(idx, { key: e.target.value })
                              }
                              className="h-8 font-mono text-xs"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={item.label}
                              onChange={(e) =>
                                updateEnvVar(idx, { label: e.target.value })
                              }
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell className="p-2">
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
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={item.defaultValue || ""}
                              onChange={(e) =>
                                updateEnvVar(idx, {
                                  defaultValue: e.target.value,
                                })
                              }
                              className="h-8 font-mono text-xs"
                            />
                          </TableCell>
                          <TableCell className="p-2 text-center">
                            <Checkbox
                              checked={item.required}
                              onCheckedChange={(checked) =>
                                updateEnvVar(idx, {
                                  required: Boolean(checked),
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="p-2 text-center">
                            <Checkbox
                              checked={item.isSecret}
                              onCheckedChange={(checked) =>
                                updateEnvVar(idx, {
                                  isSecret: Boolean(checked),
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeEnvVar(idx)}
                              className="size-8 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <TrashIcon className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Documentation */}
        <TabsContent value="documentation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Template Documentation (Markdown)
              </CardTitle>
              <CardDescription>
                Full readme and deployment manual shown in template detail view
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={14}
                value={readmeMarkdown}
                onChange={(e) => setReadmeMarkdown(e.target.value)}
                placeholder="# Getting Started with this Stack..."
                className="font-mono text-xs"
              />
            </CardContent>
          </Card>
        </TabsContent>
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
    </form>
  )
}

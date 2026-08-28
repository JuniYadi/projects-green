"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  Container,
  Database,
  HardDrive,
  Key,
  Layers,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react"
import { eden } from "@/lib/eden"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface TemplateEnvVar {
  id: string
  key: string
  label: string
  description?: string
  defaultValue?: string
  required: boolean
  isSecret: boolean
  dataType: "string" | "number" | "boolean" | "select"
  options?: string[]
}

export interface TemplateBuilderState {
  // Step 1: General Info
  name: string
  tagline: string
  description: string
  category: string
  iconUrl: string
  readmeMarkdown?: string

  // Step 2: Container Runtime
  image: string
  defaultPort: number
  command: string
  args: string
  healthCheckPath: string
  runAsNonRoot: boolean
  defaultCpu: number
  defaultMemory: number

  // Step 3: Dependencies & Storage
  enablePostgres: boolean
  enableMysql: boolean
  enableRedis: boolean
  enableStorage: boolean
  storageMountPath: string
  storageSizeGb: number

  // Step 4: Environment Schema
  envSchema: TemplateEnvVar[]
}

const CATEGORIES = [
  { value: "AI", label: "AI & Machine Learning" },
  { value: "AUTOMATION", label: "Automation & Workflows" },
  { value: "CMS", label: "CMS & Blogs" },
  { value: "DATABASE", label: "Databases & Datastores" },
  { value: "DEVELOPER_TOOLS", label: "Developer Tools" },
  { value: "ANALYTICS", label: "Analytics & Telemetry" },
  { value: "UTILITIES", label: "Utilities & Helpers" },
]

const INITIAL_STATE: TemplateBuilderState = {
  name: "",
  tagline: "",
  description: "",
  category: "DEVELOPER_TOOLS",
  iconUrl: "",
  readmeMarkdown: "",

  image: "",
  defaultPort: 8080,
  command: "",
  args: "",
  healthCheckPath: "/healthz",
  runAsNonRoot: true,
  defaultCpu: 500,
  defaultMemory: 512,

  enablePostgres: false,
  enableMysql: false,
  enableRedis: false,
  enableStorage: false,
  storageMountPath: "/data",
  storageSizeGb: 10,

  envSchema: [],
}

export default function TemplateBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const lang = (params?.lang as string) || "en"

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [formData, setFormData] = useState<TemplateBuilderState>(INITIAL_STATE)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = <K extends keyof TemplateBuilderState>(
    field: K,
    value: TemplateBuilderState[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const addEnvVar = () => {
    const newVar: TemplateEnvVar = {
      id: Math.random().toString(36).substring(2, 9),
      key: "",
      label: "",
      description: "",
      defaultValue: "",
      required: false,
      isSecret: false,
      dataType: "string",
    }
    setFormData((prev) => ({
      ...prev,
      envSchema: [...prev.envSchema, newVar],
    }))
  }

  const updateEnvVar = (
    id: string,
    field: keyof TemplateEnvVar,
    value: unknown
  ) => {
    setFormData((prev) => ({
      ...prev,
      envSchema: prev.envSchema.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }))
  }

  const removeEnvVar = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      envSchema: prev.envSchema.filter((item) => item.id !== id),
    }))
  }

  const constructBlueprintJson = () => {
    const dependencies: Array<{
      serviceType: "POSTGRESQL" | "MYSQL" | "REDIS"
      alias: string
      envPrefix: string
    }> = []

    if (formData.enablePostgres) {
      dependencies.push({
        serviceType: "POSTGRESQL",
        alias: "primary-postgres",
        envPrefix: "DB",
      })
    }
    if (formData.enableMysql) {
      dependencies.push({
        serviceType: "MYSQL",
        alias: "primary-mysql",
        envPrefix: "DB",
      })
    }
    if (formData.enableRedis) {
      dependencies.push({
        serviceType: "REDIS",
        alias: "cache-redis",
        envPrefix: "REDIS",
      })
    }

    return {
      version: "1.0.0",
      runtime: {
        image: formData.image.trim(),
        defaultPort: Number(formData.defaultPort) || 8080,
        healthCheckPath: formData.healthCheckPath.trim() || undefined,
        runAsNonRoot: formData.runAsNonRoot,
        command: formData.command.trim()
          ? formData.command.split(" ").filter(Boolean)
          : undefined,
        args: formData.args.trim()
          ? formData.args.split(" ").filter(Boolean)
          : undefined,
      },
      resources: {
        defaultCpu: Number(formData.defaultCpu) || 500,
        defaultMemory: Number(formData.defaultMemory) || 512,
      },
      storage: formData.enableStorage
        ? {
            enabled: true,
            mountPath: formData.storageMountPath.trim() || "/data",
            sizeGbDefault: Number(formData.storageSizeGb) || 10,
          }
        : undefined,
      dependencies,
      envSchema: formData.envSchema.map((env) => ({
        key: env.key.trim(),
        label: env.label.trim() || env.key.trim(),
        description: env.description?.trim() || undefined,
        defaultValue: env.defaultValue?.trim() || undefined,
        required: env.required,
        isSecret: env.isSecret,
        dataType: env.dataType,
      })),
    }
  }

  const validateCurrentStep = (stepNumber: number): boolean => {
    if (stepNumber === 1) {
      if (!formData.name.trim()) {
        toast.error("Template name is required")
        return false
      }
      if (!formData.tagline.trim()) {
        toast.error("Short tagline is required")
        return false
      }
      if (!formData.description.trim()) {
        toast.error("Description is required")
        return false
      }
    } else if (stepNumber === 2) {
      if (!formData.image.trim()) {
        toast.error("Container image repository is required")
        return false
      }
      if (!formData.defaultPort || Number(formData.defaultPort) <= 0) {
        toast.error("Valid port number is required")
        return false
      }
    }
    return true
  }

  const handleNext = () => {
    if (validateCurrentStep(step)) {
      setStep((prev) => Math.min(prev + 1, 4) as 1 | 2 | 3 | 4)
    }
  }

  const handlePrevious = () => {
    setStep((prev) => Math.max(prev - 1, 1) as 1 | 2 | 3 | 4)
  }

  const handleSave = async (submitForReview = false) => {
    if (!validateCurrentStep(1) || !validateCurrentStep(2)) {
      return
    }

    setIsSubmitting(true)
    try {
      const blueprintJson = constructBlueprintJson()
      const payload = {
        name: formData.name.trim(),
        tagline: formData.tagline.trim(),
        description: formData.description.trim(),
        category: formData.category,
        iconUrl: formData.iconUrl.trim() || undefined,
        readmeMarkdown: formData.readmeMarkdown?.trim() || undefined,
        blueprintJson,
      }

      const res = await (
        eden.api.templates as unknown as {
          post: (b: unknown) => Promise<{
            data?: { id?: string; ok?: boolean; message?: string }
            error?: { value?: { message?: string } }
          }>
        }
      ).post(payload)

      if (res.error || !res.data) {
        throw new Error(
          res.error?.value?.message || "Failed to create template"
        )
      }

      const created = res.data

      if (submitForReview && created.id) {
        const reviewApi = (
          eden.api.templates as unknown as Record<
            string,
            {
              "submit-review": {
                post: () => Promise<{ data?: { ok?: boolean } }>
              }
            }
          >
        )[created.id]
        const reviewRes = await reviewApi?.["submit-review"].post()
        if (!reviewRes?.data?.ok) {
          toast.warning("Saved template, but failed to submit for review")
        } else {
          toast.success("Template submitted for marketplace review!")
          router.push(`/${lang}/console/app/marketplace/my-templates`)
          return
        }
      }
      toast.success("Workspace template saved successfully!")
      router.push(`/${lang}/console/app/marketplace/my-templates`)
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      {/* Top Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 px-2 text-muted-foreground hover:text-foreground"
              onClick={() =>
                router.push(`/${lang}/console/app/marketplace/my-templates`)
              }
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Templates
            </Button>
            <span>/</span>
            <span>Custom Visual Builder</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Custom Template Builder
          </h1>
          <p className="text-sm text-muted-foreground">
            Design container stack blueprints, declare dependent managed
            databases, and define configuration schemas.
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={isSubmitting}
            onClick={() => handleSave(false)}
          >
            <Save className="mr-2 h-4 w-4" />
            Save as Workspace Template
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={isSubmitting}
            onClick={() => handleSave(true)}
          >
            <Send className="mr-2 h-4 w-4" />
            Submit for Review
          </Button>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        {[
          {
            num: 1,
            title: "General Info",
            desc: "Metadata & Categories",
            icon: Layers,
          },
          {
            num: 2,
            title: "Container Runtime",
            desc: "Image, Port, Healthcheck",
            icon: Container,
          },
          {
            num: 3,
            title: "Dependencies & Storage",
            desc: "Managed DBs & Volumes",
            icon: Database,
          },
          {
            num: 4,
            title: "Environment Schema",
            desc: "Variables & Secrets",
            icon: Key,
          },
        ].map((item) => {
          const isDone = step > item.num
          const isActive = step === item.num
          return (
            <button
              key={item.num}
              type="button"
              onClick={() => setStep(item.num as 1 | 2 | 3 | 4)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : isDone
                    ? "border-border bg-muted/40"
                    : "border-border bg-card opacity-70"
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : item.num}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium">{item.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  {item.desc}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Builder Step Form Card */}
      <Card className="border-border bg-card">
        {/* Step 1: General Info */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle className="text-lg">Step 1: General Info</CardTitle>
              <CardDescription>
                Provide catalog presentation details for your template.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Template Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g. Next.js High Performance Stack"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(val) => updateField("category", val)}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagline">
                  Short Tagline <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tagline"
                  placeholder="e.g. Production-ready Next.js 15 app with Redis caching and PostgreSQL"
                  value={formData.tagline}
                  onChange={(e) => updateField("tagline", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Full Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  rows={4}
                  placeholder="Explain what this stack does, architectural benefits, and included configurations..."
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="iconUrl">Icon or Logo URL (Optional)</Label>
                <Input
                  id="iconUrl"
                  placeholder="https://raw.githubusercontent.com/.../logo.png"
                  value={formData.iconUrl}
                  onChange={(e) => updateField("iconUrl", e.target.value)}
                />
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2: Container Runtime */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle className="text-lg">
                Step 2: Container Runtime
              </CardTitle>
              <CardDescription>
                Define the container image, networking ports, command overrides,
                and health check probes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="image">
                  Docker Image Repository{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="image"
                  placeholder="e.g. ghcr.io/org/my-app:v1.0.0 or node:20-alpine"
                  value={formData.image}
                  onChange={(e) => updateField("image", e.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="defaultPort">
                    Default Port <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="defaultPort"
                    type="number"
                    min={1}
                    max={65535}
                    placeholder="8080"
                    value={formData.defaultPort}
                    onChange={(e) =>
                      updateField("defaultPort", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="healthCheckPath">
                    Health Check HTTP Path
                  </Label>
                  <Input
                    id="healthCheckPath"
                    placeholder="/healthz or /api/health"
                    value={formData.healthCheckPath}
                    onChange={(e) =>
                      updateField("healthCheckPath", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="command">Command Override (Optional)</Label>
                  <Input
                    id="command"
                    placeholder="e.g. npm start"
                    value={formData.command}
                    onChange={(e) => updateField("command", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="args">Command Arguments (Optional)</Label>
                  <Input
                    id="args"
                    placeholder="e.g. --port 8080 --host 0.0.0.0"
                    value={formData.args}
                    onChange={(e) => updateField("args", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="defaultCpu">Default CPU (mili-cores)</Label>
                  <Input
                    id="defaultCpu"
                    type="number"
                    min={100}
                    step={100}
                    value={formData.defaultCpu}
                    onChange={(e) =>
                      updateField("defaultCpu", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultMemory">Default Memory (MiB)</Label>
                  <Input
                    id="defaultMemory"
                    type="number"
                    min={128}
                    step={128}
                    value={formData.defaultMemory}
                    onChange={(e) =>
                      updateField("defaultMemory", Number(e.target.value))
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="nonRoot">Run as Non-Root User</Label>
                  <p className="text-xs text-muted-foreground">
                    Enforce secure unprivileged user container execution.
                  </p>
                </div>
                <Switch
                  id="nonRoot"
                  checked={formData.runAsNonRoot}
                  onCheckedChange={(val) => updateField("runAsNonRoot", val)}
                />
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3: Dependencies & Storage */}
        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle className="text-lg">
                Step 3: Dependencies & Storage
              </CardTitle>
              <CardDescription>
                Configure automated managed database provisioning and persistent
                disk volumes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold tracking-tight">
                  Managed Database Addons
                </h3>
                <p className="text-xs text-muted-foreground">
                  When deployed, App Hosting will automatically provision these
                  isolated managed services and inject connection variables.
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div
                    className={`flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-all ${
                      formData.enablePostgres
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    }`}
                    onClick={() =>
                      updateField("enablePostgres", !formData.enablePostgres)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <Database className="h-5 w-5 text-primary" />
                      <Switch
                        checked={formData.enablePostgres}
                        onCheckedChange={(val) =>
                          updateField("enablePostgres", val)
                        }
                      />
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-medium">PostgreSQL</p>
                      <p className="text-xs text-muted-foreground">
                        Injects DB_HOST, DB_USER, DB_PASSWORD, DB_URL
                      </p>
                    </div>
                  </div>

                  <div
                    className={`flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-all ${
                      formData.enableMysql
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    }`}
                    onClick={() =>
                      updateField("enableMysql", !formData.enableMysql)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <Database className="h-5 w-5 text-amber-500" />
                      <Switch
                        checked={formData.enableMysql}
                        onCheckedChange={(val) =>
                          updateField("enableMysql", val)
                        }
                      />
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-medium">MySQL</p>
                      <p className="text-xs text-muted-foreground">
                        Injects MYSQL_HOST, MYSQL_DATABASE, MYSQL_URL
                      </p>
                    </div>
                  </div>

                  <div
                    className={`flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-all ${
                      formData.enableRedis
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    }`}
                    onClick={() =>
                      updateField("enableRedis", !formData.enableRedis)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <Boxes className="h-5 w-5 text-rose-500" />
                      <Switch
                        checked={formData.enableRedis}
                        onCheckedChange={(val) =>
                          updateField("enableRedis", val)
                        }
                      />
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-medium">Redis</p>
                      <p className="text-xs text-muted-foreground">
                        Injects REDIS_HOST, REDIS_PORT, REDIS_URL
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-primary" />
                      <Label htmlFor="storageToggle" className="font-medium">
                        Persistent Storage Volume
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Attach a fast SSD PersistentVolume to the app container.
                    </p>
                  </div>
                  <Switch
                    id="storageToggle"
                    checked={formData.enableStorage}
                    onCheckedChange={(val) => updateField("enableStorage", val)}
                  />
                </div>

                {formData.enableStorage && (
                  <div className="grid gap-4 pt-2 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="storageMountPath">Mount Path</Label>
                      <Input
                        id="storageMountPath"
                        placeholder="/data or /var/lib/app"
                        value={formData.storageMountPath}
                        onChange={(e) =>
                          updateField("storageMountPath", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storageSizeGb">Default Size (GB)</Label>
                      <Input
                        id="storageSizeGb"
                        type="number"
                        min={1}
                        max={1000}
                        value={formData.storageSizeGb}
                        onChange={(e) =>
                          updateField("storageSizeGb", Number(e.target.value))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </>
        )}

        {/* Step 4: Environment Schema Builder */}
        {step === 4 && (
          <>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Step 4: Environment Schema Builder
                </CardTitle>
                <CardDescription>
                  Define configurable variables, secrets, defaults, and input
                  types for template consumers.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={addEnvVar}
                className="shrink-0"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Variable
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.envSchema.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                  <Key className="mb-2 h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-medium">
                    No custom environment variables defined
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Add required or optional environment keys that users must
                    configure when launching stacks from this template.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={addEnvVar}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add First Variable
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.envSchema.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4"
                    >
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Variable Key</Label>
                          <Input
                            placeholder="e.g. API_KEY or PORT"
                            value={item.key}
                            onChange={(e) =>
                              updateEnvVar(item.id, "key", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Display Label</Label>
                          <Input
                            placeholder="e.g. Master Secret Key"
                            value={item.label}
                            onChange={(e) =>
                              updateEnvVar(item.id, "label", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Default Value</Label>
                          <Input
                            placeholder="e.g. production"
                            value={item.defaultValue || ""}
                            onChange={(e) =>
                              updateEnvVar(
                                item.id,
                                "defaultValue",
                                e.target.value
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`required-${item.id}`}
                              checked={item.required}
                              onCheckedChange={(val) =>
                                updateEnvVar(item.id, "required", val)
                              }
                            />
                            <Label
                              htmlFor={`required-${item.id}`}
                              className="cursor-pointer text-xs"
                            >
                              Required
                            </Label>
                          </div>

                          <div className="flex items-center gap-2">
                            <Switch
                              id={`secret-${item.id}`}
                              checked={item.isSecret}
                              onCheckedChange={(val) =>
                                updateEnvVar(item.id, "isSecret", val)
                              }
                            />
                            <Label
                              htmlFor={`secret-${item.id}`}
                              className="cursor-pointer text-xs"
                            >
                              Store as Secret (Vault)
                            </Label>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeEnvVar(item.id)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </>
        )}

        {/* Footer Navigation Buttons */}
        <CardFooter className="flex items-center justify-between border-t p-4">
          <Button
            variant="outline"
            disabled={step === 1 || isSubmitting}
            onClick={handlePrevious}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isSubmitting}
                onClick={() => handleSave(false)}
              >
                <Save className="mr-2 h-4 w-4" />
                Finish & Save Template
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

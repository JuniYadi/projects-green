"use client"

import React, { useState, useMemo } from "react"
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
  DotsThreeVertical,
  CloudArrowDown,
} from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
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
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
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
  const messages = getMessagesForMaybeLocale(lang).console.deploy.templateEditor

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
  const [runAsNonRoot, setRunAsNonRoot] = useState<boolean>(
    initialData?.blueprintJson?.runtime?.runAsNonRoot ?? true
  )
  const [runAsUser, setRunAsUser] = useState<string>(
    initialData?.blueprintJson?.runtime?.runAsUser != null
      ? String(initialData.blueprintJson.runtime.runAsUser)
      : ""
  )
  const [runAsGroup, setRunAsGroup] = useState<string>(
    initialData?.blueprintJson?.runtime?.runAsGroup != null
      ? String(initialData.blueprintJson.runtime.runAsGroup)
      : ""
  )
  const [runtimeFsGroup, setRuntimeFsGroup] = useState<string>(
    initialData?.blueprintJson?.runtime?.fsGroup != null
      ? String(initialData.blueprintJson.runtime.fsGroup)
      : ""
  )
  const [readOnlyRootFilesystem, setReadOnlyRootFilesystem] = useState<boolean>(
    initialData?.blueprintJson?.runtime?.readOnlyRootFilesystem ?? false
  )

  const handlePresetChange = (preset: string) => {
    if (preset === "root_default") {
      setRunAsNonRoot(false)
      setRunAsUser("")
      setRunAsGroup("")
      setRuntimeFsGroup("")
      setReadOnlyRootFilesystem(false)
    } else if (preset === "strict_non_root") {
      setRunAsNonRoot(true)
      setRunAsUser("10001")
      setRunAsGroup("10001")
      setRuntimeFsGroup("")
      setReadOnlyRootFilesystem(false)
    } else if (preset === "standard_non_root") {
      setRunAsNonRoot(true)
      setRunAsUser("1000")
      setRunAsGroup("1000")
      setRuntimeFsGroup("")
      setReadOnlyRootFilesystem(false)
    } else if (preset === "image_default_non_root") {
      setRunAsNonRoot(true)
      setRunAsUser("")
      setRunAsGroup("")
      setRuntimeFsGroup("")
      setReadOnlyRootFilesystem(false)
    }
  }

  const activePreset = useMemo(() => {
    const trimmedUser = runAsUser.trim()
    const trimmedGroup = runAsGroup.trim()
    const trimmedFsGroup = runtimeFsGroup.trim()

    // Deviations with read-only root or custom fsGroup belong to custom configuration
    if (readOnlyRootFilesystem || trimmedFsGroup) {
      return "custom"
    }

    if (!runAsNonRoot && !trimmedUser && !trimmedGroup) return "root_default"
    if (runAsNonRoot && trimmedUser === "10001" && trimmedGroup === "10001")
      return "strict_non_root"
    if (runAsNonRoot && trimmedUser === "1000" && trimmedGroup === "1000")
      return "standard_non_root"
    if (runAsNonRoot && !trimmedUser && !trimmedGroup)
      return "image_default_non_root"
    return "custom"
  }, [
    runAsNonRoot,
    runAsUser,
    runAsGroup,
    runtimeFsGroup,
    readOnlyRootFilesystem,
  ])
  const [runtimeCommand, setRuntimeCommand] = useState(
    Array.isArray(initialData?.blueprintJson?.runtime?.command)
      ? initialData.blueprintJson.runtime.command.join(" ")
      : ""
  )
  const [runtimeArgs, setRuntimeArgs] = useState(
    Array.isArray(initialData?.blueprintJson?.runtime?.args)
      ? initialData.blueprintJson.runtime.args.join(" ")
      : ""
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
  const [isSyncingManifest, setIsSyncingManifest] = useState(false)
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
    const parsedCommand = runtimeCommand.trim().split(/\s+/).filter(Boolean)
    const parsedArgs = runtimeArgs.trim().split(/\s+/).filter(Boolean)
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
        runAsUser:
          runAsUser.trim() !== "" && !isNaN(Number(runAsUser))
            ? Number(runAsUser)
            : null,
        runAsGroup:
          runAsGroup.trim() !== "" && !isNaN(Number(runAsGroup))
            ? Number(runAsGroup)
            : null,
        ...(readOnlyRootFilesystem ? { readOnlyRootFilesystem: true } : {}),
        ...(runtimeFsGroup.trim() !== "" && !isNaN(Number(runtimeFsGroup))
          ? { fsGroup: Number(runtimeFsGroup) }
          : {}),
        ...(parsedCommand.length > 0 ? { command: parsedCommand } : {}),
        ...(parsedArgs.length > 0 ? { args: parsedArgs } : {}),
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

  const handleSyncFromManifest = async () => {
    setIsSyncingManifest(true)
    try {
      const targetQuery = slug.trim() || name.trim().toLowerCase()
      const res = await fetch(
        `/api/admin/runtimes/manifests?framework=${encodeURIComponent(targetQuery)}`
      )
      if (!res.ok) {
        throw new Error(
          messages.syncManifestFetchError.replace(
            "{status}",
            String(res.status)
          )
        )
      }
      const json = await res.json()
      if (!json.ok || !json.data || !Array.isArray(json.data.tunables)) {
        throw new Error(json.message || messages.syncManifestNotFound)
      }
      const tunables = json.data.tunables as Array<{
        key: string
        label?: string
        type?: string
        default?: unknown
        example?: unknown
        required?: boolean
        safe?: boolean
        category?: string
        description?: string
        troubleshooting?: string
        options?: string[]
      }>

      let addedCount = 0
      const currentKeys = new Set(
        envSchema.map((e) => e.key.trim().toUpperCase())
      )
      const newItems: AppTemplateBlueprintEnvVar[] = []

      for (const t of tunables) {
        const cleanKey = t.key.trim()
        if (currentKeys.has(cleanKey.toUpperCase())) continue

        const isSecret =
          t.category === "security" ||
          t.safe === false ||
          /key|secret|password|token|auth/i.test(cleanKey)

        const dataType: "string" | "number" | "boolean" | "select" =
          t.type === "boolean"
            ? "boolean"
            : t.type === "number"
              ? "number"
              : t.type === "select"
                ? "select"
                : "string"

        const defVal =
          t.default !== undefined && t.default !== null
            ? String(t.default)
            : t.example !== undefined && t.example !== null && !isSecret
              ? String(t.example)
              : ""

        const desc = [t.description, t.troubleshooting]
          .filter(Boolean)
          .join(" ")

        newItems.push({
          key: cleanKey,
          label: t.label?.trim() || cleanKey,
          description: desc || undefined,
          defaultValue: defVal,
          required: Boolean(t.required),
          isSecret,
          dataType,
          options: t.options,
          generateRandomHex: /secret|token/i.test(cleanKey) ? 32 : undefined,
          isFixed: false,
          isHidden: false,
        })
        currentKeys.add(cleanKey.toUpperCase())
        addedCount++
      }

      if (addedCount > 0) {
        setEnvSchema((prev) => [...prev, ...newItems])
        toast.success(
          messages.syncSuccess
            .replace("{count}", String(addedCount))
            .replace("{framework}", json.data.framework || targetQuery)
        )
      } else {
        toast.info(messages.syncAlreadyUpToDate)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : messages.syncError
      toast.error(msg)
    } finally {
      setIsSyncingManifest(false)
    }
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
        if (bp.runtime.runAsUser !== undefined)
          setRunAsUser(
            bp.runtime.runAsUser != null ? String(bp.runtime.runAsUser) : ""
          )
        if (bp.runtime.runAsGroup !== undefined)
          setRunAsGroup(
            bp.runtime.runAsGroup != null ? String(bp.runtime.runAsGroup) : ""
          )
        if (bp.runtime.fsGroup !== undefined)
          setRuntimeFsGroup(
            bp.runtime.fsGroup != null ? String(bp.runtime.fsGroup) : ""
          )
        if (bp.runtime.readOnlyRootFilesystem !== undefined)
          setReadOnlyRootFilesystem(Boolean(bp.runtime.readOnlyRootFilesystem))
        if (bp.runtime.deploymentType)
          setDeploymentType(bp.runtime.deploymentType)
        if (bp.runtime.additionalPorts)
          setAdditionalPorts(bp.runtime.additionalPorts)
        if (Array.isArray(bp.runtime.command))
          setRuntimeCommand(bp.runtime.command.join(" "))
        else if (bp.runtime.command === undefined) setRuntimeCommand("")
        if (Array.isArray(bp.runtime.args))
          setRuntimeArgs(bp.runtime.args.join(" "))
        else if (bp.runtime.args === undefined) setRuntimeArgs("")
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
                  {messages.official}
                </Badge>
              )}
              {isFeatured && (
                <Badge variant="default" className="gap-1 text-xs">
                  <Star className="size-3 fill-amber-400" />
                  {messages.featured}
                </Badge>
              )}
            </div>
            {isNew ? (
              <p className="text-xs text-muted-foreground">
                {messages.subtitle}
              </p>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">
                  {messages.version} {version}
                </span>
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
                  title={messages.copyId}
                >
                  <Copy className="size-3" />
                  <span>
                    {messages.idPrefix}{" "}
                    {initialData?.id ? `${initialData.id.slice(0, 12)}...` : ""}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
              >
                <DotsThreeVertical className="size-4" />
                <span>{messages.moreActions || "More Actions"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => setShowImportDialog(true)}
                className="cursor-pointer gap-2"
              >
                <UploadSimple className="size-4" />
                <span>{messages.importJson}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportJson}
                className="cursor-pointer gap-2"
              >
                <DownloadSimple className="size-4" />
                <span>{messages.exportJson}</span>
              </DropdownMenuItem>
              {!isNew && initialData?.id && (
                <>
                  {onToggleFeatured && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setIsFeatured(!isFeatured)
                          onToggleFeatured(initialData.id)
                        }}
                        className="cursor-pointer gap-2"
                      >
                        <Star
                          className={`size-4 ${
                            isFeatured ? "fill-amber-400 text-amber-400" : ""
                          }`}
                        />
                        <span>{isFeatured ? "Unfeature" : "Feature"}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  {initialData.visibility === "PENDING_REVIEW" && onApprove && (
                    <DropdownMenuItem
                      onClick={() => onApprove(initialData.id)}
                      className="cursor-pointer gap-2 text-emerald-600 focus:text-emerald-700"
                    >
                      <CheckCircle className="size-4" />
                      <span>{messages.approve}</span>
                    </DropdownMenuItem>
                  )}
                  {initialData.visibility === "PENDING_REVIEW" && onReject && (
                    <DropdownMenuItem
                      onClick={() => setShowRejectDialog(true)}
                      className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                    >
                      <XCircle className="size-4" />
                      <span>{messages.reject}</span>
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                        className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash className="size-4" />
                        <span>{messages.delete}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

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
          <TabsTrigger value="general">{messages.tabs.generalDocs}</TabsTrigger>
          <TabsTrigger value="runtime">
            {messages.tabs.runtimeServices}
          </TabsTrigger>
          <TabsTrigger value="env">{messages.tabs.envSchema}</TabsTrigger>
          {!isNew && initialData?.id && (
            <TabsTrigger value="installations">
              {messages.tabs.installations}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: General Info */}
        <TabsContent value="general" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {messages.identity.title}
                </CardTitle>
                <CardDescription>
                  {messages.identity.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="template-name">
                    {messages.identity.displayName}
                  </Label>
                  <Input
                    id="template-name"
                    data-testid="template-name-input"
                    value={name}
                    onChange={(e) => handleSlugAutoFill(e.target.value)}
                    placeholder={messages.identity.displayNamePlaceholder}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-slug">
                    {messages.identity.slug}
                  </Label>
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
                  <Label htmlFor="template-tagline">
                    {messages.identity.tagline}
                  </Label>
                  <Input
                    id="template-tagline"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder={messages.identity.taglinePlaceholder}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-desc">
                    {messages.identity.descriptionLabel}
                  </Label>
                  <Textarea
                    id="template-desc"
                    data-testid="template-desc-input"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={messages.identity.descriptionPlaceholder}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-icon">
                    {messages.identity.iconUrl}
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
                      placeholder={messages.identity.iconUrlPlaceholder}
                      className="flex-1 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {messages.catalogPricing.title}
                </CardTitle>
                <CardDescription>
                  {messages.catalogPricing.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="template-category">
                      {messages.catalogPricing.category}
                    </Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="template-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AI">
                          {messages.catalogPricing.categories.ai}
                        </SelectItem>
                        <SelectItem value="AUTOMATION">
                          {messages.catalogPricing.categories.automation}
                        </SelectItem>
                        <SelectItem value="CMS">
                          {messages.catalogPricing.categories.cms}
                        </SelectItem>
                        <SelectItem value="DATABASE">
                          {messages.catalogPricing.categories.database}
                        </SelectItem>
                        <SelectItem value="DEVELOPER_TOOLS">
                          {messages.catalogPricing.categories.developerTools}
                        </SelectItem>
                        <SelectItem value="ANALYTICS">
                          {messages.catalogPricing.categories.analytics}
                        </SelectItem>
                        <SelectItem value="UTILITIES">
                          {messages.catalogPricing.categories.utilities}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="template-visibility">
                      {messages.catalogPricing.visibility}
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
                        <SelectItem value="PUBLIC">
                          {messages.catalogPricing.publicLive}
                        </SelectItem>
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
                    <Label htmlFor="template-version">
                      {messages.catalogPricing.releaseVersion}
                    </Label>
                    <Input
                      id="template-version"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0.0"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="template-price">
                      {messages.catalogPricing.monthlyPrice}
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
                        {messages.catalogPricing.officialBadgeTitle}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {messages.catalogPricing.officialBadgeDescription}
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
                        {messages.catalogPricing.featuredBadgeTitle}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {messages.catalogPricing.featuredBadgeDescription}
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
                  {messages.documentation.title}
                </CardTitle>
                <CardDescription>
                  {messages.documentation.description}
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
                  {messages.documentation.writeTab}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={readmeTab === "preview" ? "secondary" : "ghost"}
                  onClick={() => setReadmeTab("preview")}
                  className="h-7 px-2.5 text-xs"
                >
                  {messages.documentation.previewTab}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {readmeTab === "write" ? (
                <Textarea
                  rows={12}
                  value={readmeMarkdown}
                  onChange={(e) => setReadmeMarkdown(e.target.value)}
                  placeholder={messages.documentation.placeholder}
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
                      {messages.documentation.empty}
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
                  <Cpu className="size-4" /> {messages.runtime.title}
                </CardTitle>
                <CardDescription>
                  {messages.runtime.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="runtime-image">
                    {messages.runtime.dockerImage}
                  </Label>
                  <Input
                    id="runtime-image"
                    value={runtimeImage}
                    onChange={(e) => setRuntimeImage(e.target.value)}
                    placeholder={messages.runtime.dockerImagePlaceholder}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="runtime-port">
                      {messages.runtime.defaultPort}
                    </Label>
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
                      {messages.runtime.workloadType}
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
                        <SelectItem value="deployment">
                          {messages.runtime.deployment}
                        </SelectItem>
                        <SelectItem value="statefulset">
                          {messages.runtime.statefulSet}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="runtime-command">
                      {messages.runtime.containerCommand}
                    </Label>
                    <Input
                      id="runtime-command"
                      value={runtimeCommand}
                      onChange={(e) => setRuntimeCommand(e.target.value)}
                      placeholder={messages.runtime.containerCommandPlaceholder}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {messages.runtime.containerCommandHelp}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="runtime-args">
                      {messages.runtime.containerArgs}
                    </Label>
                    <Input
                      id="runtime-args"
                      value={runtimeArgs}
                      onChange={(e) => setRuntimeArgs(e.target.value)}
                      placeholder={messages.runtime.containerArgsPlaceholder}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {messages.runtime.containerArgsHelp}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      {messages.runtime.probesTitle}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {messages.runtime.probesDescription}
                    </p>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="runtime-health" className="text-xs">
                      {messages.runtime.livenessPath}
                    </Label>
                    <Input
                      id="runtime-health"
                      value={healthCheckPath}
                      onChange={(e) => setHealthCheckPath(e.target.value)}
                      placeholder={messages.runtime.livenessPathPlaceholder}
                      className="h-8 text-xs"
                    />
                  </div>

                  {healthCheckPath.trim() ? (
                    <div className="space-y-3 border-t pt-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="startup-probe" className="text-xs">
                            {messages.runtime.startupPath}
                          </Label>
                          <Input
                            id="startup-probe"
                            value={startupProbePath}
                            onChange={(e) =>
                              setStartupProbePath(e.target.value)
                            }
                            placeholder={
                              messages.runtime.startupPathPlaceholder
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="startup-delay" className="text-xs">
                            {messages.runtime.startupDelay}
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
                            {messages.runtime.startupThreshold}
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
                            {messages.runtime.readinessPath}
                          </Label>
                          <Input
                            id="readiness-probe"
                            value={readinessProbePath}
                            onChange={(e) =>
                              setReadinessProbePath(e.target.value)
                            }
                            placeholder={
                              messages.runtime.readinessPathPlaceholder
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="readiness-delay" className="text-xs">
                            {messages.runtime.readinessDelay}
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
                      {messages.runtime.probesHelp}
                    </div>
                  )}
                </div>
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">
                        {messages.runtime.additionalPortsTitle}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {messages.runtime.additionalPortsDescription}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAdditionalPort}
                      className="gap-1 text-xs"
                    >
                      <Plus className="size-3.5" /> {messages.runtime.addPort}
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
                        placeholder={messages.runtime.portNamePlaceholder}
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
                <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-1.5 text-sm font-semibold">
                        <ShieldCheck className="size-4 text-foreground" />
                        {messages.runtime.securityContextTitle}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {messages.runtime.securityContextDescription}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="security-preset"
                        className="text-xs font-medium"
                      >
                        {messages.runtime.securityPresetLabel}
                      </Label>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {activePreset === "custom"
                          ? messages.runtime.presetCustom
                          : "Auto"}
                      </span>
                    </div>
                    <Select
                      value={activePreset}
                      onValueChange={handlePresetChange}
                    >
                      <SelectTrigger
                        id="security-preset"
                        className="h-8 bg-background text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="root_default">
                          {messages.runtime.presetRootDefault}
                        </SelectItem>
                        <SelectItem value="strict_non_root">
                          {messages.runtime.presetStrictNonRoot}
                        </SelectItem>
                        <SelectItem value="standard_non_root">
                          {messages.runtime.presetStandardNonRoot}
                        </SelectItem>
                        <SelectItem value="image_default_non_root">
                          {messages.runtime.presetImageDefaultNonRoot}
                        </SelectItem>
                        <SelectItem value="custom">
                          {messages.runtime.presetCustom}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      {messages.runtime.securityPresetHint}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="sec-runAsUser"
                        className="text-xs font-medium"
                      >
                        {messages.runtime.runAsUserLabel}
                      </Label>
                      <Input
                        id="sec-runAsUser"
                        type="number"
                        min={0}
                        value={runAsUser}
                        onChange={(e) => setRunAsUser(e.target.value)}
                        placeholder="e.g. 10001"
                        className="h-8 font-mono text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {messages.runtime.runAsUserHint}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="sec-runAsGroup"
                        className="text-xs font-medium"
                      >
                        {messages.runtime.runAsGroupLabel}
                      </Label>
                      <Input
                        id="sec-runAsGroup"
                        type="number"
                        min={0}
                        value={runAsGroup}
                        onChange={(e) => setRunAsGroup(e.target.value)}
                        placeholder="e.g. 10001"
                        className="h-8 font-mono text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {messages.runtime.runAsGroupHint}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="sec-fsGroup"
                        className="text-xs font-medium"
                      >
                        {messages.runtime.fsGroupLabel}
                      </Label>
                      <Input
                        id="sec-fsGroup"
                        type="number"
                        min={1}
                        value={runtimeFsGroup}
                        onChange={(e) => setRuntimeFsGroup(e.target.value)}
                        placeholder="e.g. 1000"
                        className="h-8 font-mono text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {messages.runtime.fsGroupHint}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border/50 pt-2">
                    <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="sec-runAsNonRoot"
                          className="text-xs font-medium"
                        >
                          {messages.runtime.runAsNonRoot}
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          {messages.runtime.runAsNonRootDescription}
                        </p>
                      </div>
                      <Switch
                        id="sec-runAsNonRoot"
                        checked={runAsNonRoot}
                        onCheckedChange={setRunAsNonRoot}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="sec-readOnlyRoot"
                          className="text-xs font-medium"
                        >
                          {messages.runtime.readOnlyRootLabel}
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          {messages.runtime.readOnlyRootHint}
                        </p>
                      </div>
                      <Switch
                        id="sec-readOnlyRoot"
                        checked={readOnlyRootFilesystem}
                        onCheckedChange={setReadOnlyRootFilesystem}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HardDrive className="size-4" />{" "}
                  {messages.resourcesStorage.title}
                </CardTitle>
                <CardDescription>
                  {messages.resourcesStorage.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="res-cpu">
                        {messages.resourcesStorage.cpuLabel}
                      </Label>
                      <span className="text-[11px] text-muted-foreground">
                        = {(defaultCpu / 1000).toFixed(2)}{" "}
                        {messages.resourcesStorage.cpuHint}
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
                      placeholder={messages.resourcesStorage.cpuPlaceholder}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="res-mem">
                        {messages.resourcesStorage.memoryLabel}
                      </Label>
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
                        {messages.resourcesStorage.storageTitle}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {messages.resourcesStorage.storageDescription}
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
                        <Label htmlFor="storage-mount">
                          {messages.resourcesStorage.mountPath}
                        </Label>
                        <Input
                          id="storage-mount"
                          value={storageMountPath}
                          onChange={(e) => setStorageMountPath(e.target.value)}
                          placeholder="/data"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="storage-size">
                          {messages.resourcesStorage.sizeGb}
                        </Label>
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
                        {messages.resourcesStorage.singleNodeConstraintTitle}
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        {
                          messages.resourcesStorage
                            .singleNodeConstraintDescription
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Additional Volume Mounts (ConfigMap, Secret, PVC, EmptyDir) */}
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      {messages.resourcesStorage.volumeMountsTitle}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {messages.resourcesStorage.volumeMountsDescription}
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
                                {messages.resourcesStorage.readOnlyBadge}
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
                      {messages.resourcesStorage.addMountButton}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">
                          {messages.resourcesStorage.mountType}
                        </Label>
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
                            <SelectItem value="configmap">
                              {messages.resourcesStorage.mountTypes.configMap}
                            </SelectItem>
                            <SelectItem value="secret">
                              {messages.resourcesStorage.mountTypes.secret}
                            </SelectItem>
                            <SelectItem value="pvc">
                              {messages.resourcesStorage.mountTypes.pvc}
                            </SelectItem>
                            <SelectItem value="emptyDir">
                              {messages.resourcesStorage.mountTypes.emptyDir}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">
                          {messages.resourcesStorage.volumeName}
                        </Label>
                        <Input
                          value={newMountName}
                          onChange={(e) => setNewMountName(e.target.value)}
                          placeholder={
                            messages.resourcesStorage.volumeNamePlaceholder
                          }
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">
                          {messages.resourcesStorage.mountPathLabel}
                        </Label>
                        <Input
                          value={newMountPath}
                          onChange={(e) => setNewMountPath(e.target.value)}
                          placeholder={
                            messages.resourcesStorage.mountPathPlaceholder
                          }
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">
                          {messages.resourcesStorage.sourceName}
                        </Label>
                        <Input
                          value={newMountSourceName}
                          onChange={(e) =>
                            setNewMountSourceName(e.target.value)
                          }
                          placeholder={
                            messages.resourcesStorage.sourceNamePlaceholder
                          }
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
                          {messages.resourcesStorage.readOnlySwitch}
                        </Label>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addMount}
                        className="h-7 gap-1 text-xs"
                      >
                        <Plus className="size-3" />{" "}
                        {messages.resourcesStorage.submitMount}
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
                <Database className="size-4" /> {messages.dependencies.title}
              </CardTitle>
              <CardDescription>
                {messages.dependencies.description}
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
                            <Label className="text-xs">
                              {messages.dependencies.envPrefix}
                            </Label>
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
                  <Key className="size-4" /> {messages.envSchema.title}
                </CardTitle>
                <CardDescription>
                  {messages.envSchema.description}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSyncFromManifest}
                  disabled={isSyncingManifest}
                  className="gap-1.5 text-xs"
                  title={messages.syncFromManifestTitle}
                >
                  <CloudArrowDown className="size-3.5" />
                  <span>
                    {isSyncingManifest
                      ? messages.syncing
                      : messages.syncFromManifest}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEnvVar}
                  className="gap-1 text-xs"
                >
                  <Plus className="size-3.5" /> {messages.envSchema.addVariable}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {envSchema.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  <p className="text-sm">{messages.envSchema.empty}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addEnvVar}
                    className="mt-2 text-xs text-primary"
                  >
                    {messages.envSchema.addFirst}
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
                              {messages.envSchema.key}{" "}
                              <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              value={item.key}
                              onChange={(e) =>
                                updateEnvVar(idx, { key: e.target.value })
                              }
                              placeholder={messages.envSchema.keyPlaceholder}
                              className="h-8 font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              {messages.envSchema.label}{" "}
                              <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              value={item.label}
                              onChange={(e) =>
                                updateEnvVar(idx, { label: e.target.value })
                              }
                              placeholder={messages.envSchema.labelPlaceholder}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              {messages.envSchema.type}
                            </Label>
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
                                <SelectItem value="string">
                                  {messages.envSchema.types.string}
                                </SelectItem>
                                <SelectItem value="number">
                                  {messages.envSchema.types.number}
                                </SelectItem>
                                <SelectItem value="boolean">
                                  {messages.envSchema.types.boolean}
                                </SelectItem>
                                <SelectItem value="select">
                                  {messages.envSchema.types.select}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">
                              {messages.envSchema.defaultValue}
                            </Label>
                            <Input
                              value={item.defaultValue || ""}
                              onChange={(e) =>
                                updateEnvVar(idx, {
                                  defaultValue: e.target.value,
                                })
                              }
                              placeholder={
                                messages.envSchema.defaultValuePlaceholder
                              }
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
                            {messages.envSchema.descriptionLabel}
                          </Label>
                          <Input
                            value={item.description || ""}
                            onChange={(e) =>
                              updateEnvVar(idx, {
                                description: e.target.value,
                              })
                            }
                            placeholder={
                              messages.envSchema.descriptionPlaceholder
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-muted-foreground">
                            {messages.envSchema.randomHex}
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
                            placeholder={
                              messages.envSchema.randomHexPlaceholder
                            }
                            className="h-8 font-mono text-xs"
                          />
                        </div>
                      </div>

                      {item.dataType === "select" && (
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-muted-foreground">
                            {messages.envSchema.options}
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
                            placeholder={messages.envSchema.optionsPlaceholder}
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
                          <span className="font-medium">
                            {messages.envSchema.required}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {messages.envSchema.requiredHint}
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
                            {messages.envSchema.secret}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {messages.envSchema.secretHint}
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
                            {messages.envSchema.fixed}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {messages.envSchema.fixedHint}
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
                            {messages.envSchema.hidden}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {messages.envSchema.hiddenHint}
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
                          {messages.envSchema.previewTitle}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {messages.envSchema.previewDescription}
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
                                  <EyeSlash className="size-3" />{" "}
                                  {messages.envSchema.hiddenBadge}
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
                                      <PushPin className="size-2.5" />{" "}
                                      {messages.envSchema.lockedBadge}
                                    </Badge>
                                  )}
                                  {item.isSecret && (
                                    <Badge
                                      variant="outline"
                                      className="h-4 gap-0.5 px-1 text-[10px] text-amber-600 dark:text-amber-400"
                                    >
                                      <Lock className="size-2.5" />{" "}
                                      {messages.envSchema.secretBadge}
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
            <AlertDialogTitle>{messages.dialogs.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {messages.dialogs.deleteDescriptionBefore}
              {name}
              {messages.dialogs.deleteDescriptionAfter}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {messages.dialogs.deleteCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              {messages.dialogs.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Note Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.dialogs.rejectTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {messages.dialogs.rejectDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              rows={3}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder={messages.dialogs.rejectPlaceholder}
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {messages.dialogs.rejectCancel}
            </AlertDialogCancel>
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
              {messages.dialogs.rejectConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import JSON Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.dialogs.importTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {messages.dialogs.importDescription}
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
                <UploadSimple className="size-3.5" />{" "}
                {messages.dialogs.uploadFile}
              </Button>
              {importJsonText && (
                <span className="text-xs text-muted-foreground">
                  {messages.dialogs.fileLoadedBefore}
                  {importJsonText.length}
                  {messages.dialogs.fileLoadedAfter}
                </span>
              )}
            </div>
            <Textarea
              rows={10}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder={messages.dialogs.importPlaceholder}
              className="font-mono text-xs"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setImportJsonText("")}>
              {messages.dialogs.importCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleApplyImport(importJsonText)}
              disabled={!importJsonText.trim()}
              className="bg-primary text-primary-foreground"
            >
              {messages.dialogs.importApply}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

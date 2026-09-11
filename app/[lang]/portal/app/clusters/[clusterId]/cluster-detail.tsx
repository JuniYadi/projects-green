"use client"

import { useEffect, useMemo, useState } from "react"

import { eden } from "@/lib/eden"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowSquareOut,
  ArrowsClockwise,
  Check,
  CheckCircle,
  Copy,
  Cpu,
  DownloadSimple,
  FileText,
  Gear,
  GitBranch,
  HardDrives,
  MagnifyingGlass,
  Pencil,
  Power,
  Pulse,
  Sparkle,
  TerminalWindow,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react"

import {
  INTEGRATION_TYPES,
  INTEGRATION_TYPE_LABELS,
  clusterMetadataSchema,
  jenkinsMetadataSchema,
  gitopsMetadataSchema,
  registryMetadataSchema,
  argocdMetadataSchema,
  kubeconfigMetadataSchema,
  opensearchMetadataSchema,
  prometheusMetadataSchema,
  jenkinsSecretsPatchSchema,
  gitopsSecretsPatchSchema,
  registrySecretsPatchSchema,
  argocdSecretsPatchSchema,
  kubeconfigSecretsPatchSchema,
  opensearchSecretsPatchSchema,
  prometheusSecretsPatchSchema,
  integrationFieldLabels,
  integrationFieldDescriptions,
  integrationDefaultValues,
  formStateToPayload,
  type ClusterMetadataInput,
  clusterIntegrationsImportSchema,
} from "@/modules/deploy/cluster-integration.schema"
type ClusterIntegration = {
  id: string
  type: string
  metaJson: unknown
  secretPreview: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type ClusterEndpointDTO = {
  managedBaseDomain: string
  cnameTarget: string
  ipv4Addresses: string[]
  ipv6Addresses: string[]
  isActive: boolean
}
function isClusterEndpointDTO(value: unknown): value is ClusterEndpointDTO {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.managedBaseDomain === "string" &&
    typeof candidate.cnameTarget === "string" &&
    Array.isArray(candidate.ipv4Addresses) &&
    candidate.ipv4Addresses.every((address) => typeof address === "string") &&
    Array.isArray(candidate.ipv6Addresses) &&
    candidate.ipv6Addresses.every((address) => typeof address === "string") &&
    typeof candidate.isActive === "boolean"
  )
}

type ServiceRegionOption = {
  id: string
  code: string
  name: string
  country: string
  flag: string | null
  isActive: boolean
}

type ClusterAdminDTO = {
  id: string
  code: string
  name: string
  region: string
  regionId?: string | null
  status: "PLANNED" | "ACTIVE" | "DEPRECATED"
  isDefault: boolean
  metadataJson: unknown | null
  integrations: ClusterIntegration[]
  createdAt: string
  updatedAt: string
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  ACTIVE: "success",
  PLANNED: "secondary",
  DEPRECATED: "destructive",
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PLANNED: "Planned",
  DEPRECATED: "Deprecated",
}

type ClusterDetailProps = {
  clusterId: string
}

type FieldErrors = Record<string, string | undefined>

function getMetadataSchema(type: string) {
  switch (type) {
    case "JENKINS":
      return jenkinsMetadataSchema
    case "GITOPS":
      return gitopsMetadataSchema
    case "REGISTRY":
      return registryMetadataSchema
    case "ARGOCD":
      return argocdMetadataSchema
    case "KUBECONFIG":
      return kubeconfigMetadataSchema
    case "OPENSEARCH":
      return opensearchMetadataSchema
    case "PROMETHEUS":
      return prometheusMetadataSchema
    default:
      return null
  }
}

function getSecretsSchema(type: string) {
  switch (type) {
    case "JENKINS":
      return jenkinsSecretsPatchSchema
    case "GITOPS":
      return gitopsSecretsPatchSchema
    case "REGISTRY":
      return registrySecretsPatchSchema
    case "ARGOCD":
      return argocdSecretsPatchSchema
    case "KUBECONFIG":
      return kubeconfigSecretsPatchSchema
    case "OPENSEARCH":
      return opensearchSecretsPatchSchema
    case "PROMETHEUS":
      return prometheusSecretsPatchSchema
    default:
      return null
  }
}

export function ClusterDetail({ clusterId }: ClusterDetailProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const router = useRouter()

  const [cluster, setCluster] = useState<ClusterAdminDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  const [editingIntegration, setEditingIntegration] =
    useState<ClusterIntegration | null>(null)
  const [integrationMeta, setIntegrationMeta] = useState<
    Record<string, unknown>
  >({})
  const [integrationSecrets, setIntegrationSecrets] = useState<
    Record<string, unknown>
  >({})
  const [integrationFieldErrors, setIntegrationFieldErrors] =
    useState<FieldErrors>({})
  const [integrationSaving, setIntegrationSaving] = useState(false)
  const [integrationError, setIntegrationError] = useState<string | null>(null)
  const [testingIntegrationType, setTestingIntegrationType] = useState<
    string | null
  >(null)
  const [integrationTestResults, setIntegrationTestResults] = useState<
    Record<string, { ok: boolean; message: string; durationMs?: number }>
  >({})

  const [endpoint, setEndpoint] = useState<ClusterEndpointDTO>({
    managedBaseDomain: "",
    cnameTarget: "",
    ipv4Addresses: [],
    ipv6Addresses: [],
    isActive: false,
  })
  const [endpointLoading, setEndpointLoading] = useState(true)
  const [endpointError, setEndpointError] = useState<string | null>(null)
  const [endpointFieldErrors, setEndpointFieldErrors] = useState<FieldErrors>(
    {}
  )
  const [endpointSaving, setEndpointSaving] = useState(false)
  const [endpointRetry, setEndpointRetry] = useState(0)
  const [statusSaving, setStatusSaving] = useState(false)
  const [clusterName, setClusterName] = useState("")
  const [clusterRegion, setClusterRegion] = useState("")
  const [selectedRegionId, setSelectedRegionId] = useState("")
  const [regions, setRegions] = useState<ServiceRegionOption[]>([])
  const [regionsLoading, setRegionsLoading] = useState(true)
  const [clusterMetadata, setClusterMetadata] = useState<ClusterMetadataInput>(
    {}
  )
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [metadataFieldErrors, setMetadataFieldErrors] = useState<FieldErrors>(
    {}
  )
  const [metadataSaving, setMetadataSaving] = useState(false)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const configuredIntegrationTypes = useMemo(
    () =>
      new Set(
        cluster?.integrations.map((integration) => integration.type) ?? []
      ),
    [cluster?.integrations]
  )
  const availableIntegrationTypes = useMemo(
    () =>
      INTEGRATION_TYPES.filter((type) => !configuredIntegrationTypes.has(type)),
    [configuredIntegrationTypes]
  )
  const [selectedIntegrationType, setSelectedIntegrationType] = useState<
    (typeof INTEGRATION_TYPES)[number] | null
  >(null)
  const effectiveNewIntegrationType =
    (selectedIntegrationType &&
    availableIntegrationTypes.includes(selectedIntegrationType)
      ? selectedIntegrationType
      : availableIntegrationTypes[0]) ?? INTEGRATION_TYPES[0]
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importJsonText, setImportJsonText] = useState("")
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("overview")
  const [logSearchQuery, setLogSearchQuery] = useState("")
  const [logLevelFilter, setLogLevelFilter] = useState<string>("ALL")
  const [logComponentFilter, setLogComponentFilter] = useState<string>("ALL")
  const [isTestingAll, setIsTestingAll] = useState(false)

  const handleTestAllIntegrations = async () => {
    if (!cluster || cluster.integrations.length === 0) return
    setIsTestingAll(true)
    try {
      await Promise.allSettled(
        cluster.integrations.map((item) => handleIntegrationTest(item.type))
      )
      toast.success("All integration connection tests completed")
    } finally {
      setIsTestingAll(false)
    }
  }

  const copyLogsToClipboard = (text: string) => {
    if (!text) return
    void navigator.clipboard.writeText(text)
    toast.success("Logs copied to clipboard")
  }
  const copyToClipboard = (text: string, fieldKey: string) => {
    if (!text) return
    void navigator.clipboard.writeText(text)
    setCopiedField(fieldKey)
    setTimeout(() => setCopiedField(null), 2000)
  }
  useEffect(() => {
    let cancelled = false

    const loadRegions = async () => {
      try {
        const { data: payload, error: resError } =
          await eden.api.admin.regions.get()
        if (resError || !payload || !payload.ok) {
          const errPayload = (resError?.value || payload) as
            { message?: string } | undefined
          throw new Error(errPayload?.message || "Failed to load regions")
        }
        if (cancelled) return
        const rawList = Array.isArray(payload.data)
          ? (payload.data as ServiceRegionOption[])
          : []
        const activeRegions = rawList.filter((r) => r.isActive)
        setRegions(activeRegions)
      } catch (err) {
        console.error("Failed to load regions:", err)
      } finally {
        if (!cancelled) setRegionsLoading(false)
      }
    }

    void loadRegions()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: payload } =
          await eden.api.admin["app-hosting"].clusters[clusterId].get()
        if (!payload || !payload.ok || !payload.data) {
          throw new Error(payload?.message ?? "Unable to load cluster.")
        }
        if (cancelled) return
        setCluster(payload.data)
        setClusterName(payload.data.name)
        setClusterRegion(payload.data.region)
        setSelectedRegionId(payload.data.regionId ?? "")
        setClusterMetadata(
          (payload.data.metadataJson as ClusterMetadataInput) ?? {}
        )
      } catch (cause) {
        if (cancelled) return
        setCluster(null)
        setError(
          cause instanceof Error ? cause.message : "Unable to load cluster."
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [clusterId, retry])
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setEndpointLoading(true)
      setEndpointError(null)

      try {
        const { data: payload } =
          await eden.api.admin["app-hosting"].clusters[clusterId].endpoint.get()
        if (!payload || !payload.ok || !isClusterEndpointDTO(payload.data)) {
          const message =
            payload &&
            typeof payload === "object" &&
            "message" in payload &&
            typeof payload.message === "string"
              ? payload.message
              : "Unable to load edge endpoint."
          throw new Error(message)
        }

        if (cancelled) return
        setEndpoint(payload.data)
      } catch (cause) {
        if (cancelled) return
        setEndpointError(
          cause instanceof Error
            ? cause.message
            : "Unable to load edge endpoint."
        )
      } finally {
        if (!cancelled) setEndpointLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [clusterId, endpointRetry])

  const handleStatusChange = async (
    newStatus: string,
    isDefault = cluster?.isDefault
  ) => {
    if (!cluster) return
    setStatusSaving(true)

    try {
      const { data: payload } = await eden.api.admin["app-hosting"].clusters[
        clusterId
      ].status.patch({
        status: newStatus as ClusterAdminDTO["status"],
        ...(isDefault !== undefined ? { isDefault } : {}),
      })

      if (!payload || !payload.ok) {
        throw new Error(payload?.message ?? "Failed to update status.")
      }

      setRetry((v) => v + 1)
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Failed to update status.")
    } finally {
      setStatusSaving(false)
    }
  }

  const handleMetadataSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setMetadataSaving(true)
    setMetadataError(null)
    setMetadataFieldErrors({})
    try {
      const result = clusterMetadataSchema.safeParse(clusterMetadata)
      if (!result.success) {
        const fieldErrors: FieldErrors = {}
        for (const issue of result.error.issues) {
          if (issue.path.length > 0) {
            fieldErrors[issue.path[0] as string] = issue.message
          }
        }
        setMetadataFieldErrors(fieldErrors)
        throw new Error("Please fix the errors below.")
      }
      const selectedRegion = regions.find((r) => r.id === selectedRegionId)
      const finalRegionName = selectedRegion
        ? selectedRegion.name
        : clusterRegion.trim()
      if (!clusterName.trim() || !finalRegionName) {
        throw new Error("Name and region are required.")
      }

      const { data: payload } = await eden.api.admin["app-hosting"].clusters[
        clusterId
      ].patch({
        name: clusterName.trim(),
        region: finalRegionName,
        regionId: selectedRegion
          ? selectedRegion.id
          : selectedRegionId || undefined,
        metadataJson: result.data as Record<string, unknown>,
      })

      if (!payload || !payload.ok) {
        throw new Error(payload?.message ?? "Failed to update cluster.")
      }
      setRetry((v) => v + 1)
    } catch (cause) {
      setMetadataError(
        cause instanceof Error ? cause.message : "Failed to update cluster."
      )
    } finally {
      setMetadataSaving(false)
    }
  }
  const handleEndpointSave = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    setEndpointSaving(true)
    setEndpointError(null)
    setEndpointFieldErrors({})

    const splitAddresses = (value: string) =>
      value
        .split(/[\n,]/)
        .map((address) => address.trim())
        .filter(Boolean)
    const formData = new FormData(event.currentTarget)
    const formValue = (name: string, fallback: string) =>
      String(formData.get(name) ?? fallback)

    try {
      const { data: response } = await eden.api.admin["app-hosting"].clusters[
        clusterId
      ].endpoint.put({
        managedBaseDomain: formValue(
          "managedBaseDomain",
          endpoint.managedBaseDomain
        ).trim(),
        cnameTarget: formValue("cnameTarget", endpoint.cnameTarget).trim(),
        ipv4Addresses: splitAddresses(
          formValue("ipv4Addresses", endpoint.ipv4Addresses.join("\n"))
        ),
        ipv6Addresses: splitAddresses(
          formValue("ipv6Addresses", endpoint.ipv6Addresses.join("\n"))
        ),
        isActive: formData.get("isActive") === "on",
      })

      if (!response || !response.ok) {
        const failure = response as unknown as {
          message?: string
          fieldErrors?: Record<string, string[] | string>
          fields?: Record<string, string[] | string>
        }
        const errorSource = failure.fieldErrors || failure.fields
        if (errorSource) {
          const fieldErrors: FieldErrors = {}
          for (const [key, messages] of Object.entries(errorSource)) {
            const field = key.replace(/^endpoint\./, "").replace(/\.\d+$/, "")
            fieldErrors[field] = Array.isArray(messages)
              ? messages[0]
              : messages
          }
          setEndpointFieldErrors(fieldErrors)
        }
        setEndpointError(failure.message ?? "Failed to update edge endpoint.")
        return
      }
      if (isClusterEndpointDTO(response.data)) setEndpoint(response.data)
    } catch (cause) {
      setEndpointError(
        cause instanceof Error
          ? cause.message
          : "Failed to update edge endpoint."
      )
    } finally {
      setEndpointSaving(false)
    }
  }
  const handleIntegrationEdit = (integration: ClusterIntegration) => {
    setEditingIntegration(integration)
    setIntegrationMeta((integration.metaJson as Record<string, unknown>) ?? {})
    setIntegrationSecrets({})
    setIntegrationFieldErrors({})
    setIntegrationError(null)
  }

  const handleIntegrationCreate = () => {
    const typeToCreate =
      selectedIntegrationType &&
      availableIntegrationTypes.includes(selectedIntegrationType)
        ? selectedIntegrationType
        : availableIntegrationTypes[0]
    if (!typeToCreate) return
    const now = new Date().toISOString()
    const defaults = (integrationDefaultValues[typeToCreate] ?? {}) as Record<
      string,
      unknown
    >
    setEditingIntegration({
      id: `new-${typeToCreate}`,
      type: typeToCreate,
      metaJson: { ...defaults },
      secretPreview: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    setIntegrationMeta({ ...defaults })
    setIntegrationSecrets({})
    setIntegrationFieldErrors({})
    setIntegrationError(null)
  }

  const handleIntegrationSave = async () => {
    if (!editingIntegration) return
    setIntegrationSaving(true)
    setIntegrationError(null)
    setIntegrationFieldErrors({})

    try {
      const metaSchema = getMetadataSchema(editingIntegration.type)
      const secretsSchema = getSecretsSchema(editingIntegration.type)

      if (!metaSchema) {
        throw new Error(`Unknown integration type: ${editingIntegration.type}`)
      }

      // Validate metadata fields
      const metaResult = metaSchema.safeParse(integrationMeta)
      if (!metaResult.success) {
        const fieldErrors: FieldErrors = {}
        for (const issue of metaResult.error.issues) {
          if (issue.path.length > 0) {
            fieldErrors[issue.path[0] as string] = issue.message
          }
        }
        setIntegrationFieldErrors(fieldErrors)
        throw new Error("Please fix the errors below.")
      }

      // Validate only supplied secret fields; backend merges them with stored secrets.
      if (Object.keys(integrationSecrets).length > 0) {
        if (!secretsSchema) {
          throw new Error(
            `Unknown integration type: ${editingIntegration.type}`
          )
        }
        const secretsResult = secretsSchema.safeParse(integrationSecrets)
        if (!secretsResult.success) {
          const fieldErrors: FieldErrors = {}
          for (const issue of secretsResult.error.issues) {
            if (issue.path.length > 0) {
              fieldErrors[`secret_${String(issue.path[0])}`] = issue.message
            }
          }
          setIntegrationFieldErrors(fieldErrors)
          throw new Error("Please fix the errors below.")
        }
      }

      // Build form state for formStateToPayload
      const formState: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(integrationMeta)) {
        if (value !== undefined && value !== null && value !== "") {
          formState[key] = value
        }
      }
      for (const [key, value] of Object.entries(integrationSecrets)) {
        if (value !== undefined && value !== null && value !== "") {
          formState[`secret_${key}`] = value
        }
      }

      const payload = formStateToPayload(formState)

      const { data: response } =
        await eden.api.admin["app-hosting"].clusters[clusterId].integrations[
          editingIntegration.type
        ].put(payload)

      if (!response || !response.ok) {
        const failure = response as unknown as {
          message?: string
          fieldErrors?: Record<string, string[]>
        }
        if (failure.fieldErrors) {
          const fieldErrors: FieldErrors = {}
          for (const [key, messages] of Object.entries(failure.fieldErrors)) {
            const field = key
              .replace(/^metaJson\./, "")
              .replace(/^secrets\./, "secret_")
            fieldErrors[field] = messages[0]
          }
          setIntegrationFieldErrors(fieldErrors)
        }
        throw new Error(failure.message ?? "Failed to update integration.")
      }

      setEditingIntegration(null)
      setRetry((v) => v + 1)
    } catch (cause) {
      setIntegrationError(
        cause instanceof Error ? cause.message : "Failed to update integration."
      )
    } finally {
      setIntegrationSaving(false)
    }
  }

  const handleIntegrationToggle = async (integration: ClusterIntegration) => {
    try {
      const { data: payload } = await eden.api.admin["app-hosting"].clusters[
        clusterId
      ].integrations[integration.type].status.patch({
        isActive: !integration.isActive,
      })

      if (!payload || !payload.ok) {
        throw new Error(payload?.message ?? "Failed to toggle integration.")
      }

      setCluster((previous) =>
        previous
          ? {
              ...previous,
              integrations: previous.integrations.map((item) =>
                item.id === integration.id
                  ? { ...item, isActive: !item.isActive }
                  : item
              ),
            }
          : previous
      )
    } catch (cause) {
      console.error("Failed to toggle integration status:", cause)
      alert(
        cause instanceof Error ? cause.message : "Failed to toggle integration."
      )
    }
  }
  const handleIntegrationTest = async (type: string) => {
    setTestingIntegrationType(type)
    try {
      const { data: body } = await eden.api.admin["app-hosting"].clusters[
        clusterId
      ].integrations[type as (typeof INTEGRATION_TYPES)[number]].test.post({
        metaJson: {},
        secrets: {},
      })

      if (body && body.ok && body.data) {
        setIntegrationTestResults((prev) => ({
          ...prev,
          [type]: body.data as {
            ok: boolean
            message: string
            durationMs?: number
          },
        }))
      } else {
        setIntegrationTestResults((prev) => ({
          ...prev,
          [type]: { ok: false, message: "Failed to run connection probe" },
        }))
      }
    } catch (err) {
      setIntegrationTestResults((prev) => ({
        ...prev,
        [type]: {
          ok: false,
          message:
            err instanceof Error ? err.message : "Connection probe failed",
        },
      }))
    } finally {
      setTestingIntegrationType(null)
    }
  }

  const handleIntegrationDelete = async (integration: ClusterIntegration) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the ${INTEGRATION_TYPE_LABELS[integration.type] ?? integration.type} integration?`
    )
    if (!confirmDelete) return

    try {
      const { data: payload } =
        await eden.api.admin["app-hosting"].clusters[clusterId].integrations[
          integration.type
        ].delete()
      if (!payload || !payload.ok) {
        throw new Error(payload?.message ?? "Unable to delete integration.")
      }
      setCluster((previous) =>
        previous
          ? {
              ...previous,
              integrations: previous.integrations.filter(
                (item) => item.id !== integration.id
              ),
            }
          : previous
      )
    } catch (cause) {
      console.error("Failed to delete integration:", cause)
      alert(
        cause instanceof Error ? cause.message : "Unable to delete integration."
      )
    }
  }

  const handleExportJson = async () => {
    setExporting(true)
    try {
      const { data: payload } =
        await eden.api.admin["app-hosting"].clusters[
          clusterId
        ].integrations.export.get()
      if (!payload || !payload.ok || !("data" in payload) || !payload.data) {
        const errMsg =
          payload && !payload.ok && "message" in payload
            ? String(payload.message)
            : "Unable to export integrations."
        throw new Error(errMsg)
      }
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(payload.data, null, 2)
      )}`
      const downloadAnchor = document.createElement("a")
      downloadAnchor.setAttribute("href", jsonString)
      downloadAnchor.setAttribute(
        "download",
        `cluster-${cluster?.code ?? clusterId}-integrations.json`
      )
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
    } catch (cause) {
      console.error("Failed to export integrations:", cause)
      alert(
        cause instanceof Error
          ? cause.message
          : "Unable to export integrations."
      )
    } finally {
      setExporting(false)
    }
  }

  const handleImportJson = async () => {
    setImportError(null)
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(importJsonText)
    } catch {
      setImportError("Invalid JSON syntax. Please check the JSON format.")
      return
    }

    const validation = clusterIntegrationsImportSchema.safeParse(parsedJson)
    if (!validation.success) {
      const issueMsg = validation.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ")
      setImportError(`Validation error: ${issueMsg}`)
      return
    }

    setImporting(true)
    try {
      const { data: payload } = await eden.api.admin["app-hosting"].clusters[
        clusterId
      ].integrations.import.post(validation.data)
      if (!payload || !payload.ok) {
        const errMsg =
          payload && !payload.ok && "message" in payload
            ? String(payload.message)
            : "Unable to import integrations."
        throw new Error(errMsg)
      }
      setImportJsonText("")
    } catch (cause) {
      console.error("Failed to import integrations:", cause)
      setImportError(
        cause instanceof Error
          ? cause.message
          : "Failed to import integrations."
      )
    } finally {
      setImporting(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) setImportJsonText(content)
    }
    reader.readAsText(file)
  }

  const getIntegration = (type: string) =>
    cluster?.integrations.find((i) => i.type === type)

  const getIntegrationMeta = (type: string): Record<string, unknown> => {
    const item = getIntegration(type)
    if (!item || !item.metaJson || typeof item.metaJson !== "object") return {}
    return item.metaJson as Record<string, unknown>
  }

  const jenkinsMeta = getIntegrationMeta("JENKINS")
  const argocdMeta = getIntegrationMeta("ARGOCD")
  const opensearchMeta = getIntegrationMeta("OPENSEARCH")
  const prometheusMeta = getIntegrationMeta("PROMETHEUS")
  const gitopsMeta = getIntegrationMeta("GITOPS")
  const registryMeta = getIntegrationMeta("REGISTRY")
  const kubeconfigMeta = getIntegrationMeta("KUBECONFIG")

  const jenkinsUrl =
    typeof jenkinsMeta.baseUrl === "string" ? jenkinsMeta.baseUrl : null
  const argocdUrl =
    typeof argocdMeta.apiUrl === "string" ? argocdMeta.apiUrl : null
  const opensearchUrl =
    typeof opensearchMeta.nodeUrl === "string" ? opensearchMeta.nodeUrl : null
  const prometheusUrl =
    typeof prometheusMeta.serverUrl === "string"
      ? prometheusMeta.serverUrl
      : null
  const gitopsUrl =
    typeof gitopsMeta.repo === "string"
      ? `https://github.com/${gitopsMeta.repo}`
      : null

  const clusterLogs = useMemo(() => {
    const cCode = cluster?.code ?? "cluster"
    const storageClass = clusterMetadata.storageClass ?? "openebs-lvmpv"
    const cname = endpoint.cnameTarget || "cname-sg.pfnapp.com"
    const domain = endpoint.managedBaseDomain || "pfnapp.dev"
    return [
      {
        id: "log-1",
        timestamp: "10:42:01",
        level: "INFO",
        component: "kubelet",
        message: `Node pool health check passed for ${cluster?.name ?? "cluster"}. 8 nodes reporting Ready with storageClass=${storageClass}.`,
      },
      {
        id: "log-2",
        timestamp: "10:42:08",
        level: "INFO",
        component: "argocd-server",
        message: `Argo CD application controller verified cluster ${cCode}. Manifest git revision aligned with GitOps target.`,
      },
      {
        id: "log-3",
        timestamp: "10:42:15",
        level: "INFO",
        component: "ingress-nginx",
        message: `Edge routing rules loaded for ${domain} -> ${cname}. TLS certificates verified and active.`,
      },
      {
        id: "log-4",
        timestamp: "10:42:24",
        level: "INFO",
        component: "jenkins-agent",
        message: `Jenkins agent heartbeat OK. Dynamic build runner pool idle, awaiting webhook trigger.`,
      },
      {
        id: "log-5",
        timestamp: "10:42:32",
        level: "WARN",
        component: "openebs-provisioner",
        message: `Storage volume pool utilization on ${storageClass} reached 28.4%. Threshold is normal (< 75%).`,
      },
      {
        id: "log-6",
        timestamp: "10:42:45",
        level: "INFO",
        component: "prometheus",
        message: `Scrape interval completed (15s). 42 metrics targets in cluster ${cCode} returned HTTP 200.`,
      },
      {
        id: "log-7",
        timestamp: "10:42:50",
        level: "INFO",
        component: "container-registry",
        message: `Image pull secrets validated for active namespaces on cluster ${cCode}.`,
      },
      {
        id: "log-8",
        timestamp: "10:43:02",
        level: "INFO",
        component: "vault-agent",
        message: `Dynamic secrets lease renewed for cluster ${cluster?.id ?? "cluster"} integrations. Path: admin/clusters/${cluster?.code ?? "sgp"}.`,
      },
      {
        id: "log-9",
        timestamp: "10:43:18",
        level: "ERROR",
        component: "ingress-nginx",
        message: `Upstream connection timeout on edge probe (attempt 1/3). Auto-recovered on retry.`,
      },
    ]
  }, [
    cluster?.code,
    cluster?.name,
    cluster?.id,
    clusterMetadata.storageClass,
    endpoint.cnameTarget,
    endpoint.managedBaseDomain,
  ])

  const filteredLogs = useMemo(() => {
    return clusterLogs.filter((log) => {
      if (logLevelFilter !== "ALL" && log.level !== logLevelFilter) return false
      if (logComponentFilter !== "ALL" && log.component !== logComponentFilter)
        return false
      if (
        logSearchQuery.trim() &&
        !log.message.toLowerCase().includes(logSearchQuery.toLowerCase()) &&
        !log.component.toLowerCase().includes(logSearchQuery.toLowerCase())
      ) {
        return false
      }
      return true
    })
  }, [clusterLogs, logLevelFilter, logComponentFilter, logSearchQuery])

  const ECOSYSTEM_PILLARS = [
    {
      type: "KUBECONFIG",
      name: "Kubernetes Engine",
      subtitle: "Control Plane & Scheduling",
      icon: Cpu,
      color: "text-blue-500",
      description:
        "Direct API server connectivity and pod scheduling control plane.",
      configured: !!getIntegration("KUBECONFIG"),
      metaPreview: kubeconfigMeta.apiServerUrl
        ? String(kubeconfigMeta.apiServerUrl)
        : "Standard In-Cluster / Token Auth",
      tabTarget: "settings",
    },
    {
      type: "ARGOCD",
      name: "Argo CD",
      subtitle: "Declarative GitOps Delivery",
      icon: ArrowsClockwise,
      color: "text-amber-500",
      description:
        "Automated application deployment and manifest state reconciliation.",
      configured: !!getIntegration("ARGOCD"),
      metaPreview:
        argocdUrl ??
        `App Namespace: ${String(argocdMeta.appNamespace ?? "argocd")}`,
      externalUrl: argocdUrl,
      tabTarget: "gitops",
    },
    {
      type: "JENKINS",
      name: "Jenkins CI/CD",
      subtitle: "Build & Pipeline Automation",
      icon: TerminalWindow,
      color: "text-red-500",
      description:
        "Dynamic build runners and container image generation workflows.",
      configured: !!getIntegration("JENKINS"),
      metaPreview:
        jenkinsUrl ??
        (jenkinsMeta.dslRepo
          ? `DSL: ${String(jenkinsMeta.dslOwner)}/${String(jenkinsMeta.dslRepo)}`
          : "Standard CI runner"),
      externalUrl: jenkinsUrl,
      tabTarget: "cicd",
    },
    {
      type: "OPENSEARCH",
      name: "OpenSearch",
      subtitle: "Cluster Logs & Analytics",
      icon: FileText,
      color: "text-emerald-500",
      description: "Centralized logging and runtime error indexing.",
      configured: !!getIntegration("OPENSEARCH"),
      metaPreview:
        opensearchUrl ?? `Index: logs-cluster-${cluster?.code ?? "sgp"}-*`,
      externalUrl: opensearchUrl,
      tabTarget: "logs",
    },
    {
      type: "PROMETHEUS",
      name: "Prometheus",
      subtitle: "Metrics & Observability",
      icon: Pulse,
      color: "text-orange-500",
      description:
        "Real-time metrics, node-exporter scraping, and telemetry rules.",
      configured: !!getIntegration("PROMETHEUS"),
      metaPreview: prometheusUrl ?? "Scrape Interval: 15s (kube-state-metrics)",
      externalUrl: prometheusUrl,
      tabTarget: "metrics",
    },
    {
      type: "GITOPS",
      name: "GitOps Manifests",
      subtitle: "Manifest Source of Truth",
      icon: GitBranch,
      color: "text-purple-500",
      description:
        "Git repository storing Helm values and application manifests.",
      configured: !!getIntegration("GITOPS"),
      metaPreview: gitopsMeta.repo
        ? `${String(gitopsMeta.repo)} (${String(gitopsMeta.branch ?? "main")})`
        : "Not configured",
      externalUrl: gitopsUrl,
      tabTarget: "gitops",
    },
    {
      type: "REGISTRY",
      name: "Container Registry",
      subtitle: "Docker & OCI Artifacts",
      icon: HardDrives,
      color: "text-cyan-500",
      description:
        "Target registry for build artifacts and image pull secrets.",
      configured: !!getIntegration("REGISTRY"),
      metaPreview: registryMeta.serverUrl
        ? String(registryMeta.serverUrl)
        : "Standard Registry",
      tabTarget: "settings",
    },
  ]
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
        Loading cluster...
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        role="alert"
      >
        <span>{error}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRetry((v) => v + 1)}
        >
          Retry
        </Button>
      </div>
    )
  }

  if (!cluster) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              router.push(
                localizePathname({ pathname: "/portal/app/clusters", locale })
              )
            }
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{cluster.name}</h2>
              <Badge variant={STATUS_VARIANT[cluster.status] ?? "outline"}>
                {STATUS_LABEL[cluster.status] ?? cluster.status}
              </Badge>
              {cluster.isDefault && <Badge variant="success">Default</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Code: <span className="font-mono">{cluster.code}</span> • Region:{" "}
              {cluster.region}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cluster.integrations.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleTestAllIntegrations}
              disabled={isTestingAll}
              title="Test connectivity across all configured cluster integrations"
            >
              <Pulse
                size={14}
                className={cn("mr-1.5", isTestingAll && "animate-spin")}
              />
              {isTestingAll ? "Testing All..." : "Test All Integrations"}
            </Button>
          )}
          {argocdUrl && (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <a href={argocdUrl} target="_blank" rel="noopener noreferrer">
                Open Argo CD <ArrowSquareOut size={13} />
              </a>
            </Button>
          )}
          {jenkinsUrl && (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <a href={jenkinsUrl} target="_blank" rel="noopener noreferrer">
                Open Jenkins <ArrowSquareOut size={13} />
              </a>
            </Button>
          )}
          {opensearchUrl && (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <a href={opensearchUrl} target="_blank" rel="noopener noreferrer">
                Open OpenSearch <ArrowSquareOut size={13} />
              </a>
            </Button>
          )}
          {!cluster.isDefault && cluster.status === "ACTIVE" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleStatusChange("ACTIVE", true)}
              disabled={statusSaving}
            >
              Set as Default
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={cluster.status === "ACTIVE" ? "destructive" : "default"}
            onClick={() =>
              void handleStatusChange(
                cluster.status === "ACTIVE" ? "DEPRECATED" : "ACTIVE",
                cluster.isDefault
              )
            }
            disabled={statusSaving}
          >
            {cluster.status === "ACTIVE"
              ? "Deactivate Cluster"
              : "Activate Cluster"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/50 p-2.5 text-xs">
        <span className="mr-1 font-medium text-muted-foreground">
          Ecosystem:
        </span>
        {ECOSYSTEM_PILLARS.map((pillar) => {
          const testRes = integrationTestResults[pillar.type]
          const isConfigured = pillar.configured
          return (
            <button
              key={pillar.type}
              type="button"
              onClick={() => setActiveTab(pillar.tabTarget)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors",
                testRes
                  ? testRes.ok
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-destructive/20 bg-destructive/10 text-destructive"
                  : isConfigured
                    ? "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  testRes
                    ? testRes.ok
                      ? "bg-emerald-500"
                      : "bg-destructive"
                    : isConfigured
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/40"
                )}
              />
              <span className="font-medium">{pillar.name}</span>
            </button>
          )
        })}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="overview" className="gap-1.5 px-3 py-1.5">
            <Cpu size={15} /> Overview & Health
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 px-3 py-1.5">
            <FileText size={15} /> Logs (OpenSearch)
          </TabsTrigger>
          <TabsTrigger value="gitops" className="gap-1.5 px-3 py-1.5">
            <GitBranch size={15} /> GitOps (Argo CD)
          </TabsTrigger>
          <TabsTrigger value="cicd" className="gap-1.5 px-3 py-1.5">
            <TerminalWindow size={15} /> CI/CD (Jenkins)
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-1.5 px-3 py-1.5">
            <Pulse size={15} /> Metrics (Prometheus)
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 px-3 py-1.5">
            <Gear size={15} /> Settings & Vault
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="overview"
          forceMount
          className="space-y-6 data-[state=inactive]:hidden"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Integration Health
                </span>
                <Pulse size={16} className="text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold">
                {cluster.integrations.length} / 7
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Connected infrastructure services
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Hosting Region
                </span>
                <Cpu size={16} className="text-blue-500" />
              </div>
              <div className="mt-2 truncate text-2xl font-bold">
                {cluster.region}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Code: <span className="font-mono">{cluster.code}</span>
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Storage Engine
                </span>
                <HardDrives size={16} className="text-purple-500" />
              </div>
              <div className="mt-2 truncate font-mono text-xl font-bold">
                {clusterMetadata.storageClass || "openebs-lvmpv"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Persistent storage class
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Edge Base Domain
                </span>
                <ArrowSquareOut size={16} className="text-amber-500" />
              </div>
              <div className="mt-2 truncate font-mono text-xl font-bold">
                {endpoint.managedBaseDomain || "pfnapp.dev"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Routing: {endpoint.cnameTarget || "cname-sg.pfnapp.com"}
              </p>
            </Card>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  Cluster Integration Matrix
                </h3>
                <p className="text-xs text-muted-foreground">
                  Real-time connectivity and operational hubs for container
                  orchestration, build, and observability.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("settings")}
              >
                <Gear size={14} className="mr-1.5" />
                Manage Secrets
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ECOSYSTEM_PILLARS.map((pillar) => {
                const IconComponent = pillar.icon
                const testRes = integrationTestResults[pillar.type]
                const isTesting = testingIntegrationType === pillar.type
                return (
                  <Card
                    key={pillar.type}
                    className="flex flex-col justify-between border-border/80 transition-colors hover:border-border"
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "rounded-lg bg-muted/60 p-2",
                              pillar.color
                            )}
                          >
                            <IconComponent size={20} />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold">
                              {pillar.name}
                            </CardTitle>
                            <p className="text-[11px] text-muted-foreground">
                              {pillar.subtitle}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={pillar.configured ? "success" : "outline"}
                          className="text-[10px]"
                        >
                          {pillar.configured ? "Active" : "Not Configured"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4 pt-1">
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {pillar.description}
                      </p>
                      <div className="truncate rounded-md border border-border/40 bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
                        {pillar.metaPreview}
                      </div>

                      {testRes && (
                        <div
                          className={cn(
                            "flex items-start gap-1.5 rounded-md border p-2 text-xs",
                            testRes.ok
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "border-destructive/20 bg-destructive/10 text-destructive"
                          )}
                        >
                          {testRes.ok ? (
                            <CheckCircle
                              size={14}
                              className="mt-0.5 shrink-0"
                            />
                          ) : (
                            <WarningCircle
                              size={14}
                              className="mt-0.5 shrink-0"
                            />
                          )}
                          <span className="truncate">{testRes.message}</span>
                          {testRes.durationMs !== undefined && (
                            <span className="ml-auto shrink-0 font-mono text-muted-foreground">
                              {testRes.durationMs}ms
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        {pillar.configured ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={isTesting}
                            onClick={() =>
                              void handleIntegrationTest(pillar.type)
                            }
                            title="Test connection using saved credentials"
                          >
                            <Pulse
                              size={13}
                              className={cn(
                                "mr-1",
                                isTesting && "animate-spin"
                              )}
                            />
                            {isTesting ? "Testing..." : "Test Connection"}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => setActiveTab("settings")}
                          >
                            Set up
                          </Button>
                        )}

                        {pillar.externalUrl && (
                          <Button
                            asChild
                            variant="ghost"
                            size="xs"
                            className="gap-1 text-xs"
                          >
                            <a
                              href={pillar.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Launch <ArrowSquareOut size={12} />
                            </a>
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setActiveTab(pillar.tabTarget)}
                        >
                          View Tab →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Pod Placement & Scheduling Summary
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Configured node labels, taints, and volume storage parameters
                  for pod deployment.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setActiveTab("settings")}
              >
                Update Scheduling
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Node Selectors
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(clusterMetadata.nodeSelector ?? {})
                      .length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        None
                      </span>
                    ) : (
                      Object.entries(clusterMetadata.nodeSelector ?? {}).map(
                        ([k, v]) => (
                          <Badge
                            key={k}
                            variant="secondary"
                            className="font-mono text-xs"
                          >
                            {k}={v}
                          </Badge>
                        )
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Tolerations
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(clusterMetadata.tolerations ?? []).length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        None
                      </span>
                    ) : (
                      (clusterMetadata.tolerations ?? []).map((tol, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="font-mono text-xs"
                        >
                          {tol.key}:{tol.effect}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Edge Routing CNAME
                  </span>
                  <p className="font-mono text-xs text-foreground">
                    {endpoint.cnameTarget || "cname-sg.pfnapp.com"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="logs"
          forceMount
          className="space-y-6 data-[state=inactive]:hidden"
        >
          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">
                    OpenSearch Cluster Log Stream
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400"
                  >
                    Synthetic Sample Stream
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Live audit and system logs aggregated from pod sandboxes,
                  ingress, and Kubernetes system components.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {opensearchUrl && (
                  <Button asChild size="sm" variant="outline" className="gap-1">
                    <a
                      href={opensearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      OpenSearch Dashboards <ArrowSquareOut size={13} />
                    </a>
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copyLogsToClipboard(
                      filteredLogs
                        .map(
                          (l) =>
                            `[${l.timestamp}] [${l.level}] [${l.component}] ${l.message}`
                        )
                        .join("\n")
                    )
                  }
                >
                  <Copy size={14} className="mr-1" />
                  Copy Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                <WarningCircle size={16} className="shrink-0 text-amber-500" />
                <span>
                  Sample log stream for cluster {cluster.code}. For live
                  production search, open the OpenSearch Dashboards endpoint
                  directly or ingest via OpenSearch queue.
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[200px] flex-1">
                  <MagnifyingGlass
                    size={15}
                    className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    placeholder="Filter cluster logs (e.g. error, kubelet, nginx, pod)..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="h-9 pl-9 font-mono text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap text-muted-foreground">
                    Level:
                  </Label>
                  <Select
                    value={logLevelFilter}
                    onValueChange={setLogLevelFilter}
                  >
                    <SelectTrigger
                      aria-label="Log level"
                      className="h-9 w-[110px] text-xs"
                    >
                      <SelectValue placeholder="All Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Levels</SelectItem>
                      <SelectItem value="INFO">INFO</SelectItem>
                      <SelectItem value="WARN">WARN</SelectItem>
                      <SelectItem value="ERROR">ERROR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap text-muted-foreground">
                    Service:
                  </Label>
                  <Select
                    value={logComponentFilter}
                    onValueChange={setLogComponentFilter}
                  >
                    <SelectTrigger
                      aria-label="Log service"
                      className="h-9 w-[170px] text-xs"
                    >
                      <SelectValue placeholder="All Services" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Services</SelectItem>
                      <SelectItem value="kubelet">kubelet</SelectItem>
                      <SelectItem value="argocd-server">
                        argocd-server
                      </SelectItem>
                      <SelectItem value="jenkins-agent">
                        jenkins-agent
                      </SelectItem>
                      <SelectItem value="ingress-nginx">
                        ingress-nginx
                      </SelectItem>
                      <SelectItem value="container-registry">
                        container-registry
                      </SelectItem>
                      <SelectItem value="openebs-provisioner">
                        openebs-provisioner
                      </SelectItem>
                      <SelectItem value="prometheus">prometheus</SelectItem>
                      <SelectItem value="vault-agent">vault-agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-zinc-950 p-4 font-mono text-xs text-zinc-100 shadow-inner">
                <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-2 text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-full bg-red-500/80" />
                    <span className="inline-block size-2.5 rounded-full bg-yellow-500/80" />
                    <span className="inline-block size-2.5 rounded-full bg-green-500/80" />
                    <span className="ml-2 text-[11px] font-semibold text-zinc-300">
                      CLUSTER {cluster.code.toUpperCase()} • OPENSEARCH
                      SYNTHETIC BUFFER
                    </span>
                  </div>
                  <span className="text-[11px]">
                    Showing {filteredLogs.length} of {clusterLogs.length} events
                  </span>
                </div>

                <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-2">
                  {filteredLogs.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500">
                      No log entries match the selected filter criteria.
                    </div>
                  ) : (
                    filteredLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex flex-col gap-2 rounded border-b border-zinc-900/60 px-1.5 py-0.5 transition-colors hover:bg-zinc-900/40 sm:flex-row sm:items-baseline"
                      >
                        <span className="shrink-0 text-zinc-500 select-none">
                          {log.timestamp}
                        </span>
                        <span
                          className={cn(
                            "py-0.2 shrink-0 rounded px-1.5 text-[10px] font-bold",
                            log.level === "INFO" &&
                              "border border-blue-800/40 bg-blue-950/80 text-blue-400",
                            log.level === "WARN" &&
                              "border border-amber-800/40 bg-amber-950/80 text-amber-400",
                            log.level === "ERROR" &&
                              "border border-red-800/40 bg-red-950/80 text-red-400"
                          )}
                        >
                          {log.level}
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold text-zinc-400">
                          [{log.component}]
                        </span>
                        <span className="break-all text-zinc-200">
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="gitops"
          forceMount
          className="space-y-6 data-[state=inactive]:hidden"
        >
          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">
                    Argo CD GitOps Rollout
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400"
                  >
                    Sample Rollout Overview
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Automated manifest synchronization from GitOps repository to
                  cluster {cluster.name}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {argocdUrl ? (
                  <Button asChild size="sm" className="gap-1">
                    <a
                      href={argocdUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ArrowsClockwise size={14} className="mr-1.5" />
                      Open in Argo CD <ArrowSquareOut size={13} />
                    </a>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    title="Argo CD API URL not configured"
                  >
                    <ArrowsClockwise size={14} className="mr-1.5" />
                    Managed by Argo CD Controller
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                <WarningCircle size={16} className="shrink-0 text-amber-500" />
                <span>
                  Sample application rollout overview. Live reconciliation and
                  synchronization are continuously executed by the Argo CD
                  Application controller.
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1 rounded-lg border border-border p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Target GitOps Repository
                  </span>
                  <p className="truncate font-mono text-xs font-semibold">
                    {String(gitopsMeta.repo ?? "pfnapp/gitops-deployments")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Branch: {String(gitopsMeta.branch ?? "main")}
                  </p>
                </div>

                <div className="space-y-1 rounded-lg border border-border p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Argo CD Server Endpoint
                  </span>
                  <p className="truncate font-mono text-xs font-semibold">
                    {argocdUrl ?? "https://argocd.pfnapp.internal"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Namespace: {String(argocdMeta.appNamespace ?? "argocd")}
                  </p>
                </div>

                <div className="space-y-1 rounded-lg border border-border p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Sync Status
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      100% In-Sync (4 Applications)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Auto-prune & self-heal enabled
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  <span>Application Stacks on Cluster</span>
                  <Button
                    asChild
                    variant="ghost"
                    size="xs"
                    className="gap-1 text-xs"
                  >
                    <a
                      href={localizePathname({
                        pathname: "/portal/app/deployments",
                        locale,
                      })}
                    >
                      Manage Deployments <ArrowSquareOut size={12} />
                    </a>
                  </Button>
                </div>
                <div className="divide-y divide-border text-xs">
                  {[
                    {
                      name: "web-frontend",
                      path: "apps/web-frontend",
                      rev: "main @ 4b91f0a",
                      sync: "Synced",
                      health: "Healthy",
                      last: "2m ago",
                    },
                    {
                      name: "api-backend",
                      path: "apps/api-backend",
                      rev: "main @ 4b91f0a",
                      sync: "Synced",
                      health: "Healthy",
                      last: "4m ago",
                    },
                    {
                      name: "redis-cluster",
                      path: "apps/redis-cluster",
                      rev: "main @ 1c04e28",
                      sync: "Synced",
                      health: "Healthy",
                      last: "1h ago",
                    },
                    {
                      name: "worker-queue",
                      path: "apps/worker-queue",
                      rev: "main @ 4b91f0a",
                      sync: "Synced",
                      health: "Healthy",
                      last: "8m ago",
                    },
                  ].map((app) => (
                    <div
                      key={app.name}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-muted/20"
                    >
                      <div>
                        <span className="font-semibold text-foreground">
                          {app.name}
                        </span>
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                          {app.path}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {app.rev}
                        </span>
                        <Badge variant="success" className="text-[10px]">
                          {app.sync}
                        </Badge>
                        <Badge variant="success" className="text-[10px]">
                          {app.health}
                        </Badge>
                        <Button asChild variant="outline" size="xs">
                          <a
                            href={
                              argocdUrl ||
                              localizePathname({
                                pathname: "/portal/app/deployments",
                                locale,
                              })
                            }
                            target={argocdUrl ? "_blank" : undefined}
                            rel={argocdUrl ? "noopener noreferrer" : undefined}
                          >
                            Details
                            <ArrowSquareOut size={11} className="ml-1" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="cicd"
          forceMount
          className="space-y-6 data-[state=inactive]:hidden"
        >
          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">
                    Jenkins CI/CD Automation
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400"
                  >
                    Sample Pipeline History
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Automated container build agents and dynamic pipeline jobs
                  connected to cluster {cluster.name}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {jenkinsUrl && (
                  <Button asChild size="sm" variant="outline" className="gap-1">
                    <a
                      href={jenkinsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Jenkins Console <ArrowSquareOut size={13} />
                    </a>
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={testingIntegrationType === "JENKINS"}
                  onClick={() => void handleIntegrationTest("JENKINS")}
                >
                  <Pulse
                    size={14}
                    className={cn(
                      "mr-1.5",
                      testingIntegrationType === "JENKINS" && "animate-spin"
                    )}
                  />
                  Test Webhook & Runner
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                <WarningCircle size={16} className="shrink-0 text-amber-500" />
                <span>
                  Sample pipeline build execution history. Real-time build jobs,
                  webhooks, and console streams are managed through the
                  connected Jenkins server.
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1 rounded-lg border border-border p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Jenkins Master URL
                  </span>
                  <p className="truncate font-mono text-xs font-semibold">
                    {jenkinsUrl ?? "https://jenkins.pfnapp.internal"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Credential ID:{" "}
                    {String(jenkinsMeta.gitCredentialId ?? "git-creds")}
                  </p>
                </div>

                <div className="space-y-1 rounded-lg border border-border p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Pipeline DSL Repository
                  </span>
                  <p className="truncate font-mono text-xs font-semibold">
                    {jenkinsMeta.dslRepo
                      ? `${String(jenkinsMeta.dslOwner)}/${String(jenkinsMeta.dslRepo)}`
                      : "pfnapp/jenkins-pipelines"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Library:{" "}
                    {String(jenkinsMeta.sharedLibraryName ?? "pfn-shared-lib")}
                  </p>
                </div>

                <div className="space-y-1 rounded-lg border border-border p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Agent Capacity
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      3 Runners Online
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Auto-scaling agent pool active
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  Recent Pipeline Executions on Cluster
                </div>
                <div className="divide-y divide-border text-xs">
                  {[
                    {
                      id: "#142",
                      job: `deploy-cluster-${cluster.code}`,
                      branch: "main @ 4b91f0a",
                      trigger: "GitHub Webhook",
                      status: "Success",
                      duration: "45s",
                      time: "10m ago",
                    },
                    {
                      id: "#141",
                      job: "helm-manifest-render",
                      branch: "main @ 2e19c08",
                      trigger: "GitOps Sync",
                      status: "Success",
                      duration: "18s",
                      time: "1h ago",
                    },
                    {
                      id: "#140",
                      job: "cluster-health-check",
                      branch: "cron-hourly",
                      trigger: "Periodic Runner",
                      status: "Success",
                      duration: "12s",
                      time: "2h ago",
                    },
                  ].map((run) => (
                    <div
                      key={run.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-muted/20"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">
                          {run.id}
                        </span>
                        <span className="font-medium text-foreground">
                          {run.job}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          ({run.branch})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-muted-foreground">
                          {run.trigger}
                        </span>
                        <Badge variant="success" className="text-[10px]">
                          {run.status}
                        </Badge>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {run.duration}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {run.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="metrics"
          forceMount
          className="space-y-6 data-[state=inactive]:hidden"
        >
          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">
                    Prometheus Observability & Metrics
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400"
                  >
                    Estimated Quotas & Telemetry
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Real-time telemetry and resource quotas for nodes, pods, and
                  storage on cluster {cluster.name}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {prometheusUrl && (
                  <Button asChild size="sm" variant="outline" className="gap-1">
                    <a
                      href={prometheusUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Prometheus Web <ArrowSquareOut size={13} />
                    </a>
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={testingIntegrationType === "PROMETHEUS"}
                  onClick={() => void handleIntegrationTest("PROMETHEUS")}
                >
                  <Pulse
                    size={14}
                    className={cn(
                      "mr-1.5",
                      testingIntegrationType === "PROMETHEUS" && "animate-spin"
                    )}
                  />
                  Test Telemetry Endpoint
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                <WarningCircle size={16} className="shrink-0 text-amber-500" />
                <span>
                  Estimated cluster resource quotas and capacity allocations.
                  Real-time metric time-series and alert thresholds are scraped
                  by the Prometheus server.
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1 rounded-lg border border-border p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Node Pool Health
                  </span>
                  <p className="text-xl font-bold text-foreground">
                    8 / 8 Nodes Ready
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    100% capacity available
                  </p>
                </div>

                <div className="space-y-1 rounded-lg border border-border p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Pod Allocation
                  </span>
                  <p className="text-xl font-bold text-foreground">
                    42 / 110 Pods
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    38.2% cluster pod capacity
                  </p>
                </div>

                <div className="space-y-1 rounded-lg border border-border p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    CPU Allocation
                  </span>
                  <p className="text-xl font-bold text-foreground">
                    2.4 / 16 Cores
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    15.0% utilized
                  </p>
                </div>

                <div className="space-y-1 rounded-lg border border-border p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Memory Allocation
                  </span>
                  <p className="text-xl font-bold text-foreground">
                    18.2 / 64 GB
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    28.4% utilized
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    OpenEBS Local PV Storage Utilization
                  </span>
                  <span className="font-mono text-muted-foreground">
                    142 GB / 500 GB (28.4%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[28.4%] rounded-full bg-emerald-500" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Volume StorageClass:{" "}
                  <span className="font-mono">
                    {clusterMetadata.storageClass || "openebs-lvmpv"}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="settings"
          forceMount
          className="space-y-6 data-[state=inactive]:hidden"
        >
          <Card>
            <CardHeader>
              <CardTitle>Cluster & Scheduling Settings</CardTitle>
              <p className="text-xs text-muted-foreground">
                Core configuration and default pod scheduling parameters for
                this cluster.
              </p>
            </CardHeader>
            <CardContent>
              {metadataError && (
                <div
                  className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  role="alert"
                >
                  {metadataError}
                </div>
              )}
              <form onSubmit={handleMetadataSave} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="cluster-name"
                      className="text-xs font-medium"
                    >
                      Name
                    </Label>
                    <Input
                      id="cluster-name"
                      value={clusterName}
                      onChange={(event) => setClusterName(event.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="cluster-region"
                      className="text-xs font-medium"
                    >
                      Region
                    </Label>
                    <Select
                      value={selectedRegionId}
                      onValueChange={(val) => {
                        setSelectedRegionId(val)
                        const r = regions.find((x) => x.id === val)
                        if (r) setClusterRegion(r.name)
                      }}
                      disabled={regionsLoading || regions.length === 0}
                    >
                      <SelectTrigger
                        id="cluster-region"
                        className="h-8 text-xs"
                      >
                        <SelectValue
                          placeholder={
                            regionsLoading
                              ? "Loading..."
                              : regions.length === 0
                                ? "No regions"
                                : "Select region"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((r) => (
                          <SelectItem
                            key={r.id}
                            value={r.id}
                            className="text-xs"
                          >
                            {r.flag ? `${r.flag} ` : ""}
                            {r.name} ({r.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="cluster-storage-class"
                      className="text-xs font-medium"
                    >
                      Storage Class
                    </Label>
                    <Input
                      id="cluster-storage-class"
                      value={clusterMetadata.storageClass ?? ""}
                      onChange={(event) =>
                        setClusterMetadata((prev: ClusterMetadataInput) => ({
                          ...prev,
                          storageClass: event.target.value || undefined,
                        }))
                      }
                      placeholder="e.g. openebs-lvmpv"
                      className="h-8 font-mono text-xs"
                    />
                    {metadataFieldErrors.storageClass && (
                      <p className="text-xs text-destructive">
                        {metadataFieldErrors.storageClass}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Compact Node Selectors & Tolerations side-by-side or stacked ── */}
                <div className="grid gap-3 lg:grid-cols-2">
                  {/* ── Node Selectors ── */}
                  <div className="flex flex-col justify-between rounded-xl border border-border bg-card/40 p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs font-semibold">
                            Node Selectors
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Target node labels for pod placement.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            const current = {
                              ...(clusterMetadata.nodeSelector ?? {}),
                            }
                            current[`label-${Date.now()}`] = ""
                            setClusterMetadata(
                              (prev: ClusterMetadataInput) => ({
                                ...prev,
                                nodeSelector: current,
                              })
                            )
                          }}
                        >
                          + Add Label
                        </Button>
                      </div>

                      {Object.entries(clusterMetadata.nodeSelector ?? {})
                        .length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/80 p-2.5 text-center text-xs text-muted-foreground">
                          No node selectors (default scheduling)
                        </div>
                      ) : (
                        <div className="max-h-[180px] space-y-1.5 overflow-y-auto pr-1">
                          {Object.entries(
                            clusterMetadata.nodeSelector ?? {}
                          ).map(([key, val], idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5"
                            >
                              <Input
                                placeholder="Key"
                                value={key}
                                onChange={(e) => {
                                  const newKey = e.target.value
                                  const entries = Object.entries(
                                    clusterMetadata.nodeSelector ?? {}
                                  )
                                  const updated: Record<string, string> = {}
                                  entries.forEach(([k, v], i) => {
                                    if (i === idx) {
                                      updated[newKey] = v
                                    } else {
                                      updated[k] = v
                                    }
                                  })
                                  setClusterMetadata(
                                    (prev: ClusterMetadataInput) => ({
                                      ...prev,
                                      nodeSelector: updated,
                                    })
                                  )
                                }}
                                className="h-7 flex-1 font-mono text-xs"
                              />
                              <span className="text-xs text-muted-foreground">
                                :
                              </span>
                              <Input
                                placeholder="Value"
                                value={val}
                                onChange={(e) => {
                                  const current = {
                                    ...(clusterMetadata.nodeSelector ?? {}),
                                  }
                                  current[key] = e.target.value
                                  setClusterMetadata(
                                    (prev: ClusterMetadataInput) => ({
                                      ...prev,
                                      nodeSelector: current,
                                    })
                                  )
                                }}
                                className="h-7 flex-1 font-mono text-xs"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  const current = {
                                    ...(clusterMetadata.nodeSelector ?? {}),
                                  }
                                  delete current[key]
                                  setClusterMetadata(
                                    (prev: ClusterMetadataInput) => ({
                                      ...prev,
                                      nodeSelector:
                                        Object.keys(current).length > 0
                                          ? current
                                          : undefined,
                                    })
                                  )
                                }}
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Tolerations ── */}
                  <div className="flex flex-col justify-between rounded-xl border border-border bg-card/40 p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs font-semibold">
                            Tolerations
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Node taint tolerances for pods.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            const current = [
                              ...(clusterMetadata.tolerations ?? []),
                            ]
                            current.push({
                              key: "",
                              operator: "Equal",
                              value: "",
                              effect: "NoSchedule",
                            })
                            setClusterMetadata(
                              (prev: ClusterMetadataInput) => ({
                                ...prev,
                                tolerations: current,
                              })
                            )
                          }}
                        >
                          + Add Toleration
                        </Button>
                      </div>

                      {(clusterMetadata.tolerations ?? []).length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/80 p-2.5 text-center text-xs text-muted-foreground">
                          No tolerations configured
                        </div>
                      ) : (
                        <div className="max-h-[180px] space-y-1.5 overflow-y-auto pr-1">
                          {(clusterMetadata.tolerations ?? []).map(
                            (tol, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/50 p-1.5"
                              >
                                <Input
                                  placeholder="Key"
                                  value={tol.key}
                                  onChange={(e) => {
                                    const current = [
                                      ...(clusterMetadata.tolerations ?? []),
                                    ]
                                    current[idx] = {
                                      ...current[idx],
                                      key: e.target.value,
                                    }
                                    setClusterMetadata(
                                      (prev: ClusterMetadataInput) => ({
                                        ...prev,
                                        tolerations: current,
                                      })
                                    )
                                  }}
                                  className="h-7 w-24 font-mono text-xs"
                                />
                                <Select
                                  value={tol.operator ?? "Equal"}
                                  onValueChange={(val) => {
                                    const current = [
                                      ...(clusterMetadata.tolerations ?? []),
                                    ]
                                    current[idx] = {
                                      ...current[idx],
                                      operator: val as "Equal" | "Exists",
                                    }
                                    setClusterMetadata(
                                      (prev: ClusterMetadataInput) => ({
                                        ...prev,
                                        tolerations: current,
                                      })
                                    )
                                  }}
                                >
                                  <SelectTrigger className="h-7 w-20 text-[11px]">
                                    <SelectValue placeholder="Op" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem
                                      value="Equal"
                                      className="text-xs"
                                    >
                                      Equal
                                    </SelectItem>
                                    <SelectItem
                                      value="Exists"
                                      className="text-xs"
                                    >
                                      Exists
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  placeholder="Value"
                                  value={tol.value ?? ""}
                                  disabled={tol.operator === "Exists"}
                                  onChange={(e) => {
                                    const current = [
                                      ...(clusterMetadata.tolerations ?? []),
                                    ]
                                    current[idx] = {
                                      ...current[idx],
                                      value: e.target.value,
                                    }
                                    setClusterMetadata(
                                      (prev: ClusterMetadataInput) => ({
                                        ...prev,
                                        tolerations: current,
                                      })
                                    )
                                  }}
                                  className="h-7 flex-1 font-mono text-xs"
                                />
                                <Select
                                  value={tol.effect ?? "NoSchedule"}
                                  onValueChange={(val) => {
                                    const current = [
                                      ...(clusterMetadata.tolerations ?? []),
                                    ]
                                    current[idx] = {
                                      ...current[idx],
                                      effect: val as
                                        | "NoSchedule"
                                        | "PreferNoSchedule"
                                        | "NoExecute",
                                    }
                                    setClusterMetadata(
                                      (prev: ClusterMetadataInput) => ({
                                        ...prev,
                                        tolerations: current,
                                      })
                                    )
                                  }}
                                >
                                  <SelectTrigger className="h-7 w-28 text-[11px]">
                                    <SelectValue placeholder="Effect" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem
                                      value="NoSchedule"
                                      className="text-xs"
                                    >
                                      NoSchedule
                                    </SelectItem>
                                    <SelectItem
                                      value="PreferNoSchedule"
                                      className="text-xs"
                                    >
                                      PreferNoSchedule
                                    </SelectItem>
                                    <SelectItem
                                      value="NoExecute"
                                      className="text-xs"
                                    >
                                      NoExecute
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-1.5 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    const current = [
                                      ...(clusterMetadata.tolerations ?? []),
                                    ]
                                    current.splice(idx, 1)
                                    setClusterMetadata(
                                      (prev: ClusterMetadataInput) => ({
                                        ...prev,
                                        tolerations:
                                          current.length > 0
                                            ? current
                                            : undefined,
                                      })
                                    )
                                  }}
                                >
                                  ×
                                </Button>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cluster-notes">Notes</Label>
                  <textarea
                    id="cluster-notes"
                    value={clusterMetadata.notes ?? ""}
                    onChange={(event) =>
                      setClusterMetadata((prev: ClusterMetadataInput) => ({
                        ...prev,
                        notes: event.target.value || undefined,
                      }))
                    }
                    rows={3}
                    className="w-full rounded-xl border border-border bg-input/50 px-3 py-2 text-sm"
                  />
                  {metadataFieldErrors.notes && (
                    <p className="text-xs text-destructive">
                      {metadataFieldErrors.notes}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button type="submit" size="sm" disabled={metadataSaving}>
                    {metadataSaving ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Edge Endpoint</CardTitle>
              <p className="text-sm text-muted-foreground">
                Region-specific routing for {cluster.region}. This configuration
                is separate from cluster integrations.
              </p>
            </CardHeader>
            <CardContent>
              {endpointError && (
                <div
                  className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  role="alert"
                >
                  <span>{endpointError}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setEndpointRetry((value) => value + 1)}
                  >
                    Retry
                  </Button>
                </div>
              )}
              {endpointLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading edge endpoint...
                </p>
              ) : (
                <form onSubmit={handleEndpointSave} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="endpoint-managed-base-domain"
                          className="text-xs font-medium"
                        >
                          Managed Base Domain
                        </Label>
                        {endpoint.managedBaseDomain && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              copyToClipboard(
                                endpoint.managedBaseDomain,
                                "baseDomain"
                              )
                            }
                          >
                            {copiedField === "baseDomain" ? (
                              <>
                                <Check size={12} className="text-emerald-500" />
                                <span className="text-emerald-500">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <Input
                        id="endpoint-managed-base-domain"
                        name="managedBaseDomain"
                        value={endpoint.managedBaseDomain}
                        onChange={(event) =>
                          setEndpoint((previous) => ({
                            ...previous,
                            managedBaseDomain: event.target.value,
                          }))
                        }
                        className="font-mono text-xs"
                        placeholder="e.g. pfnapp.dev"
                        aria-invalid={Boolean(
                          endpointFieldErrors.managedBaseDomain
                        )}
                      />
                      {endpointFieldErrors.managedBaseDomain && (
                        <p className="text-xs text-destructive">
                          {endpointFieldErrors.managedBaseDomain}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="endpoint-cname-target"
                          className="text-xs font-medium"
                        >
                          CNAME Target
                        </Label>
                        {endpoint.cnameTarget && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              copyToClipboard(endpoint.cnameTarget, "cname")
                            }
                          >
                            {copiedField === "cname" ? (
                              <>
                                <Check size={12} className="text-emerald-500" />
                                <span className="text-emerald-500">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <Input
                        id="endpoint-cname-target"
                        name="cnameTarget"
                        value={endpoint.cnameTarget}
                        onChange={(event) =>
                          setEndpoint((previous) => ({
                            ...previous,
                            cnameTarget: event.target.value,
                          }))
                        }
                        className="font-mono text-xs"
                        placeholder="e.g. cname-sg.pfnapp.com"
                        aria-invalid={Boolean(endpointFieldErrors.cnameTarget)}
                      />
                      {endpointFieldErrors.cnameTarget && (
                        <p className="text-xs text-destructive">
                          {endpointFieldErrors.cnameTarget}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="endpoint-ipv4-addresses">
                        IPv4 Addresses
                      </Label>
                      <textarea
                        id="endpoint-ipv4-addresses"
                        name="ipv4Addresses"
                        rows={3}
                        value={endpoint.ipv4Addresses.join("\n")}
                        onChange={(event) =>
                          setEndpoint((previous) => ({
                            ...previous,
                            ipv4Addresses: event.target.value.split(/[\n,]/),
                          }))
                        }
                        className="w-full rounded-xl border border-border bg-input/50 px-3 py-2 text-sm"
                        placeholder="One address per line"
                        aria-invalid={Boolean(
                          endpointFieldErrors.ipv4Addresses
                        )}
                      />
                      {endpointFieldErrors.ipv4Addresses && (
                        <p className="text-xs text-destructive">
                          {endpointFieldErrors.ipv4Addresses}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endpoint-ipv6-addresses">
                        IPv6 Addresses
                      </Label>
                      <textarea
                        id="endpoint-ipv6-addresses"
                        name="ipv6Addresses"
                        rows={3}
                        value={endpoint.ipv6Addresses.join("\n")}
                        onChange={(event) =>
                          setEndpoint((previous) => ({
                            ...previous,
                            ipv6Addresses: event.target.value.split(/[\n,]/),
                          }))
                        }
                        className="w-full rounded-xl border border-border bg-input/50 px-3 py-2 text-sm"
                        placeholder="One address per line"
                        aria-invalid={Boolean(
                          endpointFieldErrors.ipv6Addresses
                        )}
                      />
                      {endpointFieldErrors.ipv6Addresses && (
                        <p className="text-xs text-destructive">
                          {endpointFieldErrors.ipv6Addresses}
                        </p>
                      )}
                    </div>
                  </div>
                  <label
                    htmlFor="endpoint-active"
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      id="endpoint-active"
                      name="isActive"
                      type="checkbox"
                      checked={endpoint.isActive}
                      onChange={(event) =>
                        setEndpoint((previous) => ({
                          ...previous,
                          isActive: event.target.checked,
                        }))
                      }
                    />
                    <span>Endpoint Active</span>
                  </label>
                  {endpointFieldErrors.isActive && (
                    <p className="text-xs text-destructive">
                      {endpointFieldErrors.isActive}
                    </p>
                  )}
                  <Button type="submit" size="sm" disabled={endpointSaving}>
                    {endpointSaving ? "Saving..." : "Save Endpoint"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Integrations</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportJson}
                  disabled={exporting || cluster.integrations.length === 0}
                  title="Export all configured integrations as JSON with Vault references"
                >
                  <DownloadSimple size={14} className="mr-1" />
                  {exporting ? "Exporting..." : "Export Config"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportError(null)
                    setIsImportModalOpen(true)
                  }}
                  title="Bulk import integrations via JSON"
                >
                  <UploadSimple size={14} className="mr-1" />
                  Import Config
                </Button>
                {availableIntegrationTypes.length > 0 && (
                  <>
                    <select
                      aria-label="Integration type"
                      value={effectiveNewIntegrationType}
                      onChange={(event) =>
                        setSelectedIntegrationType(
                          event.target
                            .value as (typeof INTEGRATION_TYPES)[number]
                        )
                      }
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {availableIntegrationTypes.map((type) => (
                        <option key={type} value={type}>
                          {INTEGRATION_TYPE_LABELS[type] ?? type}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleIntegrationCreate}
                    >
                      Add integration
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {cluster.integrations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No integrations configured for this cluster.
                </p>
              ) : (
                <div className="space-y-4">
                  {cluster.integrations.map((integration) => (
                    <div
                      key={integration.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {INTEGRATION_TYPE_LABELS[integration.type] ??
                              integration.type}
                          </span>
                        </div>
                        {integration.secretPreview && (
                          <p className="text-xs text-muted-foreground">
                            Secret: {integration.secretPreview}
                          </p>
                        )}
                        {integrationTestResults[integration.type] && (
                          <p
                            className={`text-xs ${
                              integrationTestResults[integration.type].ok
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-destructive"
                            }`}
                          >
                            {integrationTestResults[integration.type].ok
                              ? "✓ "
                              : "✗ "}
                            {integrationTestResults[integration.type].message}
                            {integrationTestResults[integration.type]
                              .durationMs !== undefined && (
                              <span className="ml-1 text-muted-foreground">
                                (
                                {
                                  integrationTestResults[integration.type]
                                    .durationMs
                                }
                                ms)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={testingIntegrationType === integration.type}
                          onClick={() =>
                            void handleIntegrationTest(integration.type)
                          }
                          title="Test connection using saved credentials"
                        >
                          <Pulse size={14} className="mr-1" />
                          {testingIntegrationType === integration.type
                            ? "Testing..."
                            : "Test"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => handleIntegrationEdit(integration)}
                        >
                          <Pencil size={14} className="mr-1" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className={
                            integration.isActive
                              ? "text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                              : "text-muted-foreground hover:bg-muted"
                          }
                          onClick={() => handleIntegrationToggle(integration)}
                          title={
                            integration.isActive
                              ? "Click to Deactivate"
                              : "Click to Activate"
                          }
                        >
                          <Power size={14} className="mr-1" />
                          {integration.isActive ? "Active" : "Inactive"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            void handleIntegrationDelete(integration)
                          }
                          title="Delete integration"
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editingIntegration && (
        <IntegrationEditModal
          integration={editingIntegration}
          meta={integrationMeta}
          secrets={integrationSecrets}
          fieldErrors={integrationFieldErrors}
          formError={integrationError}
          saving={integrationSaving}
          onMetaChange={setIntegrationMeta}
          onSecretsChange={setIntegrationSecrets}
          onSave={handleIntegrationSave}
          onCancel={() => setEditingIntegration(null)}
        />
      )}

      {isImportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl space-y-4 rounded-xl border border-border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Import Integrations (JSON)
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsImportModalOpen(false)}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste a valid JSON configuration or upload a JSON file. Supports
              either plaintext <code>secrets</code> or pre-provisioned{" "}
              <code>secretsRef</code> (e.g.{" "}
              <code>vault:admin/clusters/...</code>).
            </p>
            {importError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {importError}
              </div>
            )}
            <div>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-input file:bg-background file:px-2 file:py-1 file:text-xs file:font-medium hover:file:bg-muted"
              />
            </div>
            <div>
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder={`{\n  "version": "1.0",\n  "integrations": [\n    {\n      "type": "ARGOCD",\n      "isActive": true,\n      "metadata": { ... },\n      "secrets": { ... }\n    }\n  ]\n}`}
                rows={12}
                className="w-full rounded-md border border-input bg-muted/20 p-3 font-mono text-xs focus:ring-1 focus:ring-ring focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsImportModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleImportJson}
                disabled={importing || !importJsonText.trim()}
              >
                {importing ? "Importing..." : "Apply Import"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getFieldType(schema: unknown): string {
  let s = schema as {
    type?: string
    def?: { type?: string; innerType?: unknown }
    unwrap?: () => unknown
    _def?: { typeName?: string; innerType?: unknown }
  }
  while (s) {
    if (typeof s.unwrap === "function") {
      s = s.unwrap() as typeof s
    } else if (s.def?.innerType) {
      s = s.def.innerType as typeof s
    } else if (s._def?.innerType) {
      s = s._def.innerType as typeof s
    } else {
      break
    }
  }
  return (
    s?.type ||
    s?.def?.type ||
    s?._def?.typeName ||
    (s as { constructor?: { name?: string } })?.constructor?.name ||
    ""
  )
}

function IntegrationEditModal({
  integration,
  meta,
  secrets,
  fieldErrors,
  formError,
  saving,
  onMetaChange,
  onSecretsChange,
  onSave,
  onCancel,
}: {
  integration: ClusterIntegration
  meta: Record<string, unknown>
  secrets: Record<string, unknown>
  fieldErrors: FieldErrors
  formError: string | null
  saving: boolean
  onMetaChange: (value: Record<string, unknown>) => void
  onSecretsChange: (value: Record<string, unknown>) => void
  onSave: () => void
  onCancel: () => void
}) {
  const type = integration.type

  const metaSchema = getMetadataSchema(type)
  const secretsSchema = getSecretsSchema(type)
  const labels = integrationFieldLabels[type] ?? {}
  const descriptions = integrationFieldDescriptions[type] ?? {}

  if (!metaSchema) return null

  const metaFields = Object.keys(metaSchema.shape)
  const secretFields = secretsSchema ? Object.keys(secretsSchema.shape) : []

  const handleMetaChange = (key: string, value: unknown) => {
    onMetaChange({
      ...meta,
      [key]: value === "" || value === undefined ? undefined : value,
    })
  }

  const handleSecretChange = (key: string, value: string) => {
    onSecretsChange({ ...secrets, [key]: value || undefined })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">
              {integration.id.startsWith("new-") ? "Add" : "Edit"}{" "}
              {INTEGRATION_TYPE_LABELS[type] ?? type}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {integration.id.startsWith("new-")
                ? "Configure metadata and secrets for this integration."
                : "Update metadata and secrets for this integration."}
            </p>
          </div>
          {integrationDefaultValues[type] && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="shrink-0"
              onClick={() => {
                const defaults = integrationDefaultValues[type] ?? {}
                onMetaChange({ ...defaults, ...meta })
              }}
              title="Auto-fill recommended defaults"
            >
              <Sparkle size={13} className="mr-1 text-primary" />
              Auto-fill Defaults
            </Button>
          )}
        </div>

        {formError && (
          <div
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            role="alert"
          >
            {formError}
          </div>
        )}

        <div className="mt-4 space-y-4">
          {metaFields.map((field) => {
            const schema = (metaSchema.shape as Record<string, unknown>)[field]
            const fieldType = getFieldType(schema)
            const isBool = fieldType === "boolean" || fieldType === "ZodBoolean"
            const isNum = fieldType === "number" || fieldType === "ZodNumber"
            const label = labels[field] ?? field
            const description = descriptions[field]
            const error = fieldErrors[field]

            return (
              <div key={field} className="space-y-2">
                <Label htmlFor={`int-meta-${field}`}>
                  {label}
                  {description && (
                    <span className="block text-xs text-muted-foreground">
                      {description}
                    </span>
                  )}
                </Label>
                {field === "connectionMode" ? (
                  <Select
                    value={String(meta[field] ?? "INTERNAL")}
                    onValueChange={(value) => handleMetaChange(field, value)}
                  >
                    <SelectTrigger id={`int-meta-${field}`}>
                      <SelectValue placeholder="Select connection mode..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INTERNAL">
                        Internal (In-Cluster ServiceAccount)
                      </SelectItem>
                      <SelectItem value="EXTERNAL">
                        External (Kubeconfig / Remote Token)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : isBool ? (
                  <Select
                    value={
                      meta[field] === undefined || meta[field] === null
                        ? ""
                        : String(meta[field])
                    }
                    onValueChange={(value) =>
                      handleMetaChange(field, value === "true")
                    }
                  >
                    <SelectTrigger id={`int-meta-${field}`}>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                ) : isNum ? (
                  <Input
                    id={`int-meta-${field}`}
                    type="number"
                    value={String(meta[field] ?? "")}
                    onChange={(event) =>
                      handleMetaChange(
                        field,
                        event.target.value
                          ? Number(event.target.value)
                          : undefined
                      )
                    }
                  />
                ) : (
                  <Input
                    id={`int-meta-${field}`}
                    value={String(meta[field] ?? "")}
                    placeholder={
                      field === "apiUrl" && type === "ARGOCD"
                        ? "https://argocd.example.com"
                        : ((integrationDefaultValues[type]?.[field] as
                            string | undefined) ?? "")
                    }
                    onChange={(event) =>
                      handleMetaChange(field, event.target.value)
                    }
                  />
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            )
          })}
          {type === "KUBECONFIG" &&
            (meta.connectionMode === "INTERNAL" || !meta.connectionMode) && (
              <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">
                    In-Cluster ServiceAccount Mode Active
                  </p>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    Zero External Secrets
                  </span>
                </div>
                <p>
                  Elysia connects directly to{" "}
                  <code>https://kubernetes.default.svc</code> using the attached
                  pod ServiceAccount (
                  <code>/var/run/secrets/kubernetes.io/serviceaccount</code>).
                  External network round trips are bypassed. Secrets below are
                  optional overrides.
                </p>
                <details className="cursor-pointer rounded border border-border bg-background/60 p-2">
                  <summary className="font-medium text-foreground hover:underline">
                    View Kubernetes RBAC setup manifest
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 font-mono text-[11px] text-foreground">
                    {`apiVersion: v1
kind: ServiceAccount
metadata:
  name: elysia-api-sa
  namespace: projects-green
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: elysia-pod-exec-role
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/exec"]
    verbs: ["create", "get"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: elysia-pod-exec-binding
subjects:
  - kind: ServiceAccount
    name: elysia-api-sa
    namespace: projects-green
roleRef:
  kind: ClusterRole
  name: elysia-pod-exec-role
  apiGroup: rbac.authorization.k8s.io`}
                  </pre>
                </details>
              </div>
            )}

          {type === "KUBECONFIG" && meta.connectionMode === "EXTERNAL" && (
            <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">
                  External Remote Cluster Mode
                </p>
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  Network API Access
                </span>
              </div>
              <p>
                Requires public or routable Kubernetes API Server URL and bearer
                token or Kubeconfig. Ensure your cluster firewall allows traffic
                from this server.
              </p>
              <details className="cursor-pointer rounded border border-border bg-background/60 p-2">
                <summary className="font-medium text-foreground hover:underline">
                  How to generate token for external cluster
                </summary>
                <div className="mt-2 space-y-1 font-mono text-[11px] text-foreground">
                  <p className="font-sans text-muted-foreground">
                    1. Create ServiceAccount & RBAC on remote cluster:
                  </p>
                  <pre className="overflow-x-auto rounded bg-muted p-2">
                    {`kubectl create serviceaccount elysia-remote-sa -n kube-system
kubectl create clusterrolebinding elysia-remote-binding \\
  --clusterrole=cluster-admin \\
  --serviceaccount=kube-system:elysia-remote-sa`}
                  </pre>
                  <p className="font-sans text-muted-foreground">
                    2. Generate bearer token:
                  </p>
                  <pre className="overflow-x-auto rounded bg-muted p-2">
                    {`kubectl create token elysia-remote-sa -n kube-system --duration=8760h`}
                  </pre>
                  <p className="font-sans text-muted-foreground">
                    3. Fill in API Server URL, token, and optional CA cert
                    below.
                  </p>
                </div>
              </details>
            </div>
          )}

          {secretFields.map((field) => {
            const label = labels[field] ?? field
            const description = descriptions[field]
            const error = fieldErrors[`secret_${field}`]
            const isInternalKube =
              type === "KUBECONFIG" &&
              (meta.connectionMode === "INTERNAL" || !meta.connectionMode)
            const secretPlaceholder = isInternalKube
              ? "Optional override (defaults to in-cluster ServiceAccount)"
              : "Leave blank to keep existing secrets"

            return (
              <div key={field} className="space-y-2">
                <Label htmlFor={`int-secret-${field}`}>
                  {label}
                  {description && (
                    <span className="block text-xs text-muted-foreground">
                      {description}
                    </span>
                  )}
                </Label>
                {field === "caCertificate" || field === "kubeconfig" ? (
                  <textarea
                    id={`int-secret-${field}`}
                    value={String(secrets[field] ?? "")}
                    onChange={(event) =>
                      handleSecretChange(field, event.target.value)
                    }
                    placeholder={secretPlaceholder}
                    rows={5}
                    className="w-full rounded-xl border border-border bg-input/50 px-3 py-2 font-mono text-sm"
                  />
                ) : (
                  <Input
                    id={`int-secret-${field}`}
                    type={field === "username" ? "text" : "password"}
                    value={String(secrets[field] ?? "")}
                    onChange={(event) =>
                      handleSecretChange(field, event.target.value)
                    }
                    placeholder={secretPlaceholder}
                  />
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save Integration"}
          </Button>
        </div>
      </div>
    </div>
  )
}

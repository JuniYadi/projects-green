"use client"

import { useEffect, useState } from "react"

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
import {
  ArrowLeft,
  Check,
  Copy,
  DownloadSimple,
  Pencil,
  Power,
  Trash,
  UploadSimple,
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
  const [newIntegrationType, setNewIntegrationType] = useState<
    (typeof INTEGRATION_TYPES)[number]
  >(INTEGRATION_TYPES[0])
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importJsonText, setImportJsonText] = useState("")
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
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
    const now = new Date().toISOString()
    setEditingIntegration({
      id: `new-${newIntegrationType}`,
      type: newIntegrationType,
      metaJson: {},
      secretPreview: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    setIntegrationMeta({})
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

  const configuredIntegrationTypes = new Set(
    cluster.integrations.map((integration) => integration.type)
  )
  const availableIntegrationTypes = INTEGRATION_TYPES.filter(
    (type) => !configuredIntegrationTypes.has(type)
  )

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
        <div className="flex items-center gap-2">
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

      <Card>
        <CardHeader>
          <CardTitle>Cluster & Scheduling Settings</CardTitle>
          <p className="text-xs text-muted-foreground">
            Core configuration and default pod scheduling parameters for this
            cluster.
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
                <Label htmlFor="cluster-name" className="text-xs font-medium">
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
                <Label htmlFor="cluster-region" className="text-xs font-medium">
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
                  <SelectTrigger id="cluster-region" className="h-8 text-xs">
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
                      <SelectItem key={r.id} value={r.id} className="text-xs">
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
                        setClusterMetadata((prev: ClusterMetadataInput) => ({
                          ...prev,
                          nodeSelector: current,
                        }))
                      }}
                    >
                      + Add Label
                    </Button>
                  </div>

                  {Object.entries(clusterMetadata.nodeSelector ?? {}).length ===
                  0 ? (
                    <div className="rounded-lg border border-dashed border-border/80 p-2.5 text-center text-xs text-muted-foreground">
                      No node selectors (default scheduling)
                    </div>
                  ) : (
                    <div className="max-h-[180px] space-y-1.5 overflow-y-auto pr-1">
                      {Object.entries(clusterMetadata.nodeSelector ?? {}).map(
                        ([key, val], idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
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
                        )
                      )}
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
                        const current = [...(clusterMetadata.tolerations ?? [])]
                        current.push({
                          key: "",
                          operator: "Equal",
                          value: "",
                          effect: "NoSchedule",
                        })
                        setClusterMetadata((prev: ClusterMetadataInput) => ({
                          ...prev,
                          tolerations: current,
                        }))
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
                      {(clusterMetadata.tolerations ?? []).map((tol, idx) => (
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
                              <SelectItem value="Equal" className="text-xs">
                                Equal
                              </SelectItem>
                              <SelectItem value="Exists" className="text-xs">
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
                              <SelectItem value="NoExecute" className="text-xs">
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
                                    current.length > 0 ? current : undefined,
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
            Region-specific routing for {cluster.region}. This configuration is
            separate from cluster integrations.
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
                    aria-invalid={Boolean(endpointFieldErrors.ipv4Addresses)}
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
                    aria-invalid={Boolean(endpointFieldErrors.ipv6Addresses)}
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
                  value={newIntegrationType}
                  onChange={(event) =>
                    setNewIntegrationType(
                      event.target.value as (typeof INTEGRATION_TYPES)[number]
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
                  </div>
                  <div className="flex items-center gap-2">
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
                      onClick={() => void handleIntegrationDelete(integration)}
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
          clusterId={clusterId}
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
  clusterId,
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
  clusterId: string
}) {
  const type = integration.type
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)

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

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const payload = {
        metaJson: meta,
        secrets,
      }
      const { data: body } =
        await eden.api.admin["app-hosting"].clusters[clusterId].integrations[
          type
        ].test.post(payload)

      if (body && body.ok && body.data) {
        setTestResult(body.data as { ok: boolean; message: string })
      } else {
        setTestResult({ ok: false, message: "Failed to run connection probe" })
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error ? err.message : "Connection failed or timed out",
      })
    } finally {
      setTesting(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-lg">
        <h3 className="text-lg font-semibold">
          Edit {INTEGRATION_TYPE_LABELS[type] ?? type}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Update metadata and secrets for this integration.
        </p>

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
            const schema = (
              metaSchema.shape as Record<string, { _type?: string }>
            )[field]
            const isBool = schema?._type === "ZodBoolean"
            const isNum = schema?._type === "ZodNumber"
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
                {isBool ? (
                  <Select
                    value={String(meta[field] ?? "")}
                    onValueChange={(value) =>
                      handleMetaChange(field, value === "true")
                    }
                  >
                    <SelectTrigger>
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
                    onChange={(event) =>
                      handleMetaChange(field, event.target.value)
                    }
                  />
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            )
          })}

          {secretFields.map((field) => {
            const label = labels[field] ?? field
            const description = descriptions[field]
            const error = fieldErrors[`secret_${field}`]

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
                    placeholder="Leave blank to keep existing secrets"
                    rows={5}
                    className="w-full rounded-xl border border-border bg-input/50 px-3 py-2 font-mono text-sm"
                  />
                ) : (
                  <Input
                    id={`int-secret-${field}`}
                    type="password"
                    value={String(secrets[field] ?? "")}
                    onChange={(event) =>
                      handleSecretChange(field, event.target.value)
                    }
                    placeholder="Leave blank to keep existing secrets"
                  />
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            )
          })}
        </div>

        {testResult && (
          <div
            className={`mt-4 rounded-lg border p-3 text-xs ${
              testResult.ok
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
            }`}
          >
            <span className="font-semibold">
              {testResult.ok
                ? "✓ Connection Successful"
                : "✗ Connection Failed"}
              :
            </span>{" "}
            {testResult.message}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || saving}
            data-testid="test-connection-btn"
          >
            {testing ? "Testing..." : "Test Connection"}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : "Save Integration"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
import { ArrowLeft, Pencil, Power } from "@phosphor-icons/react"

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
  const [metadataFieldErrors, setMetadataFieldErrors] = useState<FieldErrors>(
    {}
  )
  const [metadataSaving, setMetadataSaving] = useState(false)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [newIntegrationType, setNewIntegrationType] = useState<
    (typeof INTEGRATION_TYPES)[number]
  >(INTEGRATION_TYPES[0])

  useEffect(() => {
    let cancelled = false

    const loadRegions = async () => {
      try {
        const { data: payload, error: resError } =
          await eden.api.admin.regions.get()
        if (resError || !payload || !payload.ok) {
          const errPayload = (resError?.value || payload) as
            | { message?: string }
            | undefined
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

      setRetry((v) => v + 1)
    } catch (cause) {
      alert(
        cause instanceof Error ? cause.message : "Failed to toggle integration."
      )
    }
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
      <div className="flex items-center gap-4">
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
          <h2 className="text-xl font-semibold">{cluster.name}</h2>
          <p className="text-sm text-muted-foreground">
            {cluster.code} — {cluster.region}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cluster-name">Name</Label>
                <Input
                  id="cluster-name"
                  value={clusterName}
                  onChange={(event) => setClusterName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cluster-region">Region</Label>
                <Select
                  value={selectedRegionId}
                  onValueChange={(val) => {
                    setSelectedRegionId(val)
                    const r = regions.find((x) => x.id === val)
                    if (r) setClusterRegion(r.name)
                  }}
                  disabled={regionsLoading || regions.length === 0}
                >
                  <SelectTrigger id="cluster-region">
                    <SelectValue
                      placeholder={
                        regionsLoading
                          ? "Loading regions..."
                          : regions.length === 0
                            ? "No active regions available"
                            : "Select a region"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.flag ? `${r.flag} ` : ""}
                        {r.name} ({r.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cluster-kubernetes-version">
                Kubernetes Version
              </Label>
              <Input
                id="cluster-kubernetes-version"
                value={clusterMetadata.kubernetesVersion ?? ""}
                onChange={(event) =>
                  setClusterMetadata((prev: ClusterMetadataInput) => ({
                    ...prev,
                    kubernetesVersion: event.target.value || undefined,
                  }))
                }
                placeholder="e.g. 1.28"
              />
              {metadataFieldErrors.kubernetesVersion && (
                <p className="text-xs text-destructive">
                  {metadataFieldErrors.kubernetesVersion}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cluster-node-pool-name">Node Pool Name</Label>
              <Input
                id="cluster-node-pool-name"
                value={clusterMetadata.nodePoolName ?? ""}
                onChange={(event) =>
                  setClusterMetadata((prev: ClusterMetadataInput) => ({
                    ...prev,
                    nodePoolName: event.target.value || undefined,
                  }))
                }
              />
              {metadataFieldErrors.nodePoolName && (
                <p className="text-xs text-destructive">
                  {metadataFieldErrors.nodePoolName}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cluster-node-pool-instance-type">
                  Node Pool Instance Type
                </Label>
                <Input
                  id="cluster-node-pool-instance-type"
                  value={clusterMetadata.nodePoolInstanceType ?? ""}
                  onChange={(event) =>
                    setClusterMetadata((prev: ClusterMetadataInput) => ({
                      ...prev,
                      nodePoolInstanceType: event.target.value || undefined,
                    }))
                  }
                />
                {metadataFieldErrors.nodePoolInstanceType && (
                  <p className="text-xs text-destructive">
                    {metadataFieldErrors.nodePoolInstanceType}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cluster-node-count">Node Count</Label>
                <Input
                  id="cluster-node-count"
                  type="number"
                  min="1"
                  value={clusterMetadata.nodeCount ?? ""}
                  onChange={(event) =>
                    setClusterMetadata((prev: ClusterMetadataInput) => ({
                      ...prev,
                      nodeCount: event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    }))
                  }
                />
                {metadataFieldErrors.nodeCount && (
                  <p className="text-xs text-destructive">
                    {metadataFieldErrors.nodeCount}
                  </p>
                )}
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
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={metadataSaving}>
                {metadataSaving ? "Saving..." : "Save Cluster"}
              </Button>
              <Badge variant={STATUS_VARIANT[cluster.status] ?? "outline"}>
                {STATUS_LABEL[cluster.status] ?? cluster.status}
              </Badge>
              {cluster.isDefault ? (
                <Badge variant="success">Default</Badge>
              ) : cluster.status === "ACTIVE" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleStatusChange("ACTIVE", true)}
                  disabled={statusSaving}
                >
                  Set as default
                </Button>
              ) : null}
            </div>
          </form>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="mt-1">
                {new Date(cluster.createdAt).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="mt-1">
                {new Date(cluster.updatedAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
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
                <div className="space-y-2">
                  <Label htmlFor="endpoint-managed-base-domain">
                    Managed Base Domain
                  </Label>
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
                <div className="space-y-2">
                  <Label htmlFor="endpoint-cname-target">CNAME Target</Label>
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
          {availableIntegrationTypes.length > 0 && (
            <div className="flex items-center gap-2">
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
              <Button type="button" size="sm" onClick={handleIntegrationCreate}>
                Add integration
              </Button>
            </div>
          )}
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
                      <span className="font-medium">
                        {INTEGRATION_TYPE_LABELS[integration.type] ??
                          integration.type}
                      </span>
                      <Badge
                        variant={integration.isActive ? "success" : "secondary"}
                      >
                        {integration.isActive ? "Active" : "Inactive"}
                      </Badge>
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
                      size="icon-xs"
                      onClick={() => handleIntegrationToggle(integration)}
                      title={integration.isActive ? "Deactivate" : "Activate"}
                    >
                      {integration.isActive ? (
                        <Power size={14} />
                      ) : (
                        <Power size={14} />
                      )}
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
        />
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

        <div className="mt-6 flex justify-end gap-2">
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

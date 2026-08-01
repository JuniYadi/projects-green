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

type ClusterIntegration = {
  id: string
  type: string
  metaJson: unknown
  secretPreview: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type ClusterAdminDTO = {
  id: string
  code: string
  name: string
  region: string
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

const INTEGRATION_TYPE_LABEL: Record<string, string> = {
  JENKINS: "Jenkins",
  GITOPS: "GitOps",
  REGISTRY: "Registry",
  ARGOCD: "Argo CD",
  KUBECONFIG: "Kubeconfig",
  OPENSEARCH: "OpenSearch",
  PROMETHEUS: "Prometheus",
}
const SUPPORTED_INTEGRATION_TYPES = [
  "JENKINS",
  "GITOPS",
  "REGISTRY",
  "ARGOCD",
  "KUBECONFIG",
] as const

type ClusterDetailProps = {
  clusterId: string
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
  const [integrationMeta, setIntegrationMeta] = useState("")
  const [integrationSecrets, setIntegrationSecrets] = useState("")
  const [integrationSaving, setIntegrationSaving] = useState(false)
  const [integrationError, setIntegrationError] = useState<string | null>(null)

  const [statusSaving, setStatusSaving] = useState(false)
  const [clusterName, setClusterName] = useState("")
  const [clusterRegion, setClusterRegion] = useState("")
  const [clusterMetadataJson, setClusterMetadataJson] = useState("{}")
  const [metadataSaving, setMetadataSaving] = useState(false)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [newIntegrationType, setNewIntegrationType] = useState<
    (typeof SUPPORTED_INTEGRATION_TYPES)[number]
  >(SUPPORTED_INTEGRATION_TYPES[0])

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
        setClusterMetadataJson(
          JSON.stringify(payload.data.metadataJson ?? {}, null, 2)
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

    try {
      const parsedMetadata = JSON.parse(clusterMetadataJson)
      if (
        !parsedMetadata ||
        typeof parsedMetadata !== "object" ||
        Array.isArray(parsedMetadata)
      ) {
        throw new Error("Metadata must be a JSON object.")
      }
      if (!clusterName.trim() || !clusterRegion.trim()) {
        throw new Error("Name and region are required.")
      }

      const { data: payload } = await eden.api.admin["app-hosting"].clusters[
        clusterId
      ].patch({
        name: clusterName.trim(),
        region: clusterRegion.trim(),
        metadataJson: parsedMetadata as Record<string, unknown>,
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
  const handleIntegrationEdit = (integration: ClusterIntegration) => {
    setEditingIntegration(integration)
    setIntegrationMeta(JSON.stringify(integration.metaJson, null, 2))
    setIntegrationSecrets("")
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
    setIntegrationMeta("{}")
    setIntegrationSecrets("")
    setIntegrationError(null)
  }

  const handleIntegrationSave = async () => {
    if (!editingIntegration) return
    setIntegrationSaving(true)
    setIntegrationError(null)

    try {
      let metaJson: Record<string, unknown>
      try {
        const parsed = JSON.parse(integrationMeta)
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Metadata must be a JSON object.")
        }
        metaJson = parsed as Record<string, unknown>
      } catch (cause) {
        if (
          cause instanceof Error &&
          cause.message === "Metadata must be a JSON object."
        ) {
          throw cause
        }
        throw new Error("Invalid JSON in meta fields.")
      }

      let secrets: Record<string, unknown> | undefined
      if (integrationSecrets.trim()) {
        const parsed = JSON.parse(integrationSecrets)
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Secrets must be a JSON object.")
        }
        secrets = parsed as Record<string, unknown>
      }

      const body: {
        metaJson: Record<string, unknown>
        secrets?: Record<string, unknown>
      } = {
        metaJson,
        ...(secrets ? { secrets } : {}),
      }

      const { data: payload } =
        await eden.api.admin["app-hosting"].clusters[clusterId].integrations[
          editingIntegration.type
        ].put(body)

      if (!payload || !payload.ok) {
        throw new Error(payload?.message ?? "Failed to update integration.")
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
  const availableIntegrationTypes = SUPPORTED_INTEGRATION_TYPES.filter(
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
                <Input
                  id="cluster-region"
                  value={clusterRegion}
                  onChange={(event) => setClusterRegion(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cluster-metadata">Cluster metadata (JSON)</Label>
              <textarea
                id="cluster-metadata"
                value={clusterMetadataJson}
                onChange={(event) => setClusterMetadataJson(event.target.value)}
                rows={5}
                className="w-full rounded-xl border border-border bg-input/50 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cluster-status">Status</Label>
              <Select
                value={cluster.status}
                onValueChange={(value) => void handleStatusChange(value)}
                disabled={statusSaving}
              >
                <SelectTrigger id="cluster-status" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNED">Planned</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                </SelectContent>
              </Select>
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
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Integrations</CardTitle>
          {availableIntegrationTypes.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                aria-label="Integration type"
                value={newIntegrationType}
                onChange={(event) =>
                  setNewIntegrationType(
                    event.target
                      .value as (typeof SUPPORTED_INTEGRATION_TYPES)[number]
                  )
                }
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {availableIntegrationTypes.map((type) => (
                  <option key={type} value={type}>
                    {INTEGRATION_TYPE_LABEL[type] ?? type}
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
                        {INTEGRATION_TYPE_LABEL[integration.type] ??
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold">
              Edit{" "}
              {INTEGRATION_TYPE_LABEL[editingIntegration.type] ??
                editingIntegration.type}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Update metadata and secrets for this integration.
            </p>

            {integrationError && (
              <div
                className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                role="alert"
              >
                {integrationError}
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="integration-meta">Metadata (JSON)</Label>
                <textarea
                  id="integration-meta"
                  value={integrationMeta}
                  onChange={(e) => setIntegrationMeta(e.target.value)}
                  rows={8}
                  className="w-full rounded-xl border border-border bg-input/50 px-3 py-2 font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="integration-secrets">
                  Secrets (JSON, write-only)
                </Label>
                <Input
                  id="integration-secrets"
                  type="password"
                  value={integrationSecrets}
                  onChange={(e) => setIntegrationSecrets(e.target.value)}
                  placeholder="Leave blank to keep existing secrets"
                />
                <p className="text-xs text-muted-foreground">
                  Secret fields are write-only and will never be prepopulated.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingIntegration(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleIntegrationSave}
                disabled={integrationSaving}
              >
                {integrationSaving ? "Saving..." : "Save Integration"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

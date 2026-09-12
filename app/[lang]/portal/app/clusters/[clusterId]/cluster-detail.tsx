"use client"

import { useEffect, useMemo, useState } from "react"

import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { ClusterMessages } from "@/lib/i18n/messages/types"
import { useParams, useRouter, useSearchParams } from "next/navigation"
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
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowSquareOut,
  Check,
  Copy,
  DownloadSimple,
  Pencil,
  Power,
  Pulse,
  Sparkle,
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
  integrationDefaultValues,
  formStateToPayload,
  type ClusterMetadataInput,
  clusterIntegrationsImportSchema,
} from "@/modules/deploy/cluster-integration.schema"
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
import { ClusterOperationsTabs } from "./cluster-operations-tabs"
type ClusterIntegration = {
  id: string
  type: string
  metaJson: unknown
  secretPreview: string | null
  isActive: boolean
  lastTestAt: string | null
  lastTestOk: boolean | null
  lastTestMessage: string | null
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

const STATUS_LABEL_KEY: Record<string, "active" | "planned" | "deprecated"> = {
  ACTIVE: "active",
  PLANNED: "planned",
  DEPRECATED: "deprecated",
}

const interpolate = (
  template: string,
  values: Record<string, string | number>
) =>
  Object.entries(values).reduce(
    (text, [token, value]) => text.replaceAll(`{${token}}`, String(value)),
    template
  )

const OPERATION_TAB_VALUES = [
  "health",
  "logs",
  "deployments",
  "builds",
  "metrics",
  "settings",
] as const

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
  const messages = getMessages(locale).console.app.clusters
  const router = useRouter()
  const searchParams = useSearchParams()

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
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
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
  const [isTestingAll, setIsTestingAll] = useState(false)
  const [integrationToDelete, setIntegrationToDelete] =
    useState<ClusterIntegration | null>(null)

  // The tab lives in the URL so it is linkable and survives a reload; state
  // mirrors it so the switch renders without waiting on a navigation.
  const tabParam = searchParams?.get("tab") ?? null
  const urlTab = (OPERATION_TAB_VALUES as readonly string[]).includes(
    tabParam ?? ""
  )
    ? (tabParam as string)
    : null
  const [activeTab, setActiveTabState] = useState<string>(urlTab ?? "health")
  useEffect(() => {
    if (urlTab) setActiveTabState(urlTab)
  }, [urlTab])
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab)
    const next = new URLSearchParams(searchParams?.toString() ?? "")
    next.set("tab", tab)
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  const handleTestAllIntegrations = async () => {
    if (!cluster || cluster.integrations.length === 0) return
    setIsTestingAll(true)
    try {
      await Promise.allSettled(
        cluster.integrations.map((item) => handleIntegrationTest(item.type))
      )
      toast.success(messages.settings.testAllDone)
      setRetry((value) => value + 1)
    } finally {
      setIsTestingAll(false)
    }
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
          throw new Error(
            errPayload?.message || messages.settings.failedToLoadRegions
          )
        }
        if (cancelled) return
        const rawList = Array.isArray(payload.data)
          ? (payload.data as ServiceRegionOption[])
          : []
        setRegions(rawList.filter((region) => region.isActive))
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
  }, [messages.settings.failedToLoadRegions])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: payload } =
          await eden.api.admin["app-hosting"].clusters[clusterId].get()
        if (!payload || !payload.ok || !payload.data) {
          throw new Error(
            payload?.message ?? messages.settings.failedToLoadCluster
          )
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
          cause instanceof Error
            ? cause.message
            : messages.settings.failedToLoadCluster
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [clusterId, messages.settings.failedToLoadCluster, retry])

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
              : messages.settings.failedToLoadEndpoint
          throw new Error(message)
        }

        if (cancelled) return
        setEndpoint(payload.data)
      } catch (cause) {
        if (cancelled) return
        setEndpointError(
          cause instanceof Error
            ? cause.message
            : messages.settings.failedToLoadEndpoint
        )
      } finally {
        if (!cancelled) setEndpointLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [clusterId, endpointRetry, messages.settings.failedToLoadEndpoint])

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
        throw new Error(
          payload?.message ?? messages.settings.statusUpdateFailed
        )
      }

      setRetry((v) => v + 1)
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : messages.settings.statusUpdateFailed
      )
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
        return
      }
      const selectedRegion = regions.find(
        (region) => region.id === selectedRegionId
      )
      const finalRegionName = selectedRegion
        ? selectedRegion.name
        : clusterRegion.trim()
      if (!clusterName.trim() || !finalRegionName) {
        setMetadataFieldErrors({
          ...(clusterName.trim()
            ? {}
            : { name: messages.settings.nameRegionRequired }),
          ...(finalRegionName
            ? {}
            : { region: messages.settings.nameRegionRequired }),
        })
        return
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
        throw new Error(
          payload?.message ?? messages.settings.failedToUpdateCluster
        )
      }
      setRetry((value) => value + 1)
    } catch (cause) {
      setMetadataError(
        cause instanceof Error
          ? cause.message
          : messages.settings.failedToUpdateCluster
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
          for (const [key, fieldMessages] of Object.entries(errorSource)) {
            const field = key.replace(/^endpoint\./, "").replace(/\.\d+$/, "")
            fieldErrors[field] = Array.isArray(fieldMessages)
              ? fieldMessages[0]
              : fieldMessages
          }
          setEndpointFieldErrors(fieldErrors)
          return
        }
        setEndpointError(
          failure.message ?? messages.settings.failedToUpdateEndpoint
        )
        return
      }
      if (isClusterEndpointDTO(response.data)) setEndpoint(response.data)
    } catch (cause) {
      setEndpointError(
        cause instanceof Error
          ? cause.message
          : messages.settings.failedToUpdateEndpoint
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
      lastTestAt: null,
      lastTestOk: null,
      lastTestMessage: null,
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
        throw new Error(
          messages.settings.unknownIntegrationType.replace(
            "{type}",
            editingIntegration.type
          )
        )
      }

      const metaResult = metaSchema.safeParse(integrationMeta)
      if (!metaResult.success) {
        const fieldErrors: FieldErrors = {}
        for (const issue of metaResult.error.issues) {
          if (issue.path.length > 0) {
            fieldErrors[issue.path[0] as string] = issue.message
          }
        }
        setIntegrationFieldErrors(fieldErrors)
        return
      }

      if (Object.keys(integrationSecrets).length > 0) {
        if (!secretsSchema) {
          throw new Error(
            messages.settings.unknownIntegrationType.replace(
              "{type}",
              editingIntegration.type
            )
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
          return
        }
      }

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
          for (const [key, fieldMessages] of Object.entries(
            failure.fieldErrors
          )) {
            const field = key
              .replace(/^metaJson\./, "")
              .replace(/^secrets\./, "secret_")
            fieldErrors[field] = fieldMessages[0]
          }
          setIntegrationFieldErrors(fieldErrors)
          return
        }
        throw new Error(
          failure.message ?? messages.settings.failedToUpdateIntegration
        )
      }

      setEditingIntegration(null)
      setRetry((value) => value + 1)
    } catch (cause) {
      setIntegrationError(
        cause instanceof Error
          ? cause.message
          : messages.settings.failedToUpdateIntegration
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
        throw new Error(payload?.message ?? messages.settings.toggleFailed)
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
      toast.error(
        cause instanceof Error ? cause.message : messages.settings.toggleFailed
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
          [type]: { ok: false, message: messages.settings.failedToRunProbe },
        }))
      }
    } catch (err) {
      setIntegrationTestResults((prev) => ({
        ...prev,
        [type]: {
          ok: false,
          message:
            err instanceof Error
              ? err.message
              : messages.settings.connectionProbeFailed,
        },
      }))
    } finally {
      setTestingIntegrationType(null)
    }
  }

  const handleIntegrationDelete = async (integration: ClusterIntegration) => {
    try {
      const { data: payload } =
        await eden.api.admin["app-hosting"].clusters[clusterId].integrations[
          integration.type
        ].delete()
      if (!payload || !payload.ok) {
        throw new Error(payload?.message ?? messages.settings.deleteFailed)
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
      toast.error(
        cause instanceof Error ? cause.message : messages.settings.deleteFailed
      )
    } finally {
      setIntegrationToDelete(null)
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
            : messages.settings.exportFailed
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
      toast.error(
        cause instanceof Error ? cause.message : messages.settings.exportFailed
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
      setImportError(messages.settings.invalidJson)
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
            : messages.settings.failedToImport
        throw new Error(errMsg)
      }
      setImportJsonText("")
    } catch (cause) {
      console.error("Failed to import integrations:", cause)
      setImportError(
        cause instanceof Error
          ? cause.message
          : messages.settings.failedToImport
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

  const getIntegrationMeta = (type: string): Record<string, unknown> => {
    const item = cluster?.integrations.find(
      (integration) => integration.type === type
    )
    if (!item || !item.metaJson || typeof item.metaJson !== "object") return {}
    return item.metaJson as Record<string, unknown>
  }

  const jenkinsMeta = getIntegrationMeta("JENKINS")
  const argocdMeta = getIntegrationMeta("ARGOCD")
  const opensearchMeta = getIntegrationMeta("OPENSEARCH")

  const jenkinsUrl =
    typeof jenkinsMeta.baseUrl === "string" ? jenkinsMeta.baseUrl : null
  const argocdUrl =
    typeof argocdMeta.apiUrl === "string" ? argocdMeta.apiUrl : null
  const opensearchUrl =
    typeof opensearchMeta.nodeUrl === "string" ? opensearchMeta.nodeUrl : null
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
        {messages.settings.loadingCluster}
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
          {messages.common.retry}
        </Button>
      </div>
    )
  }

  if (!cluster) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
        <span>{messages.settings.clusterMissing}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(
              localizePathname({ pathname: "/portal/app/clusters", locale })
            )
          }
        >
          {messages.settings.back}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={messages.settings.back}
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
                {messages.clusterStatus[STATUS_LABEL_KEY[cluster.status]] ??
                  cluster.status}
              </Badge>
              {cluster.isDefault && (
                <Badge variant="success">
                  {messages.settings.defaultLabel}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {messages.settings.code}:{" "}
              <span className="font-mono">{cluster.code}</span> •{" "}
              {messages.settings.region}: {cluster.region}
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
              title={messages.settings.testConfigurationTitle}
            >
              <Pulse
                size={14}
                className={cn("mr-1.5", isTestingAll && "animate-spin")}
              />
              {isTestingAll
                ? messages.settings.testingAll
                : messages.settings.testAll}
            </Button>
          )}
          {argocdUrl && (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <a href={argocdUrl} target="_blank" rel="noopener noreferrer">
                {messages.settings.openArgo} <ArrowSquareOut size={13} />
              </a>
            </Button>
          )}
          {jenkinsUrl && (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <a href={jenkinsUrl} target="_blank" rel="noopener noreferrer">
                {messages.settings.openJenkins} <ArrowSquareOut size={13} />
              </a>
            </Button>
          )}
          {opensearchUrl && (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <a href={opensearchUrl} target="_blank" rel="noopener noreferrer">
                {messages.settings.openOpenSearch} <ArrowSquareOut size={13} />
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
              {messages.settings.setDefault}
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <ClusterOperationsTabs
          clusterId={clusterId}
          activeTab={activeTab}
          locale={locale}
          messages={messages}
          onTabChange={setActiveTab}
        />

        <TabsContent
          value="settings"
          forceMount
          className="space-y-6 data-[state=inactive]:hidden"
        >
          <Card>
            <CardHeader>
              <CardTitle>{messages.settings.coreHeading}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {messages.settings.coreDescription}
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
                      {messages.settings.name}
                    </Label>
                    <Input
                      id="cluster-name"
                      name="cluster.name"
                      value={clusterName}
                      onChange={(event) => setClusterName(event.target.value)}
                      className="h-8 text-xs"
                    />
                    {metadataFieldErrors.name && (
                      <p className="text-xs text-destructive">
                        {metadataFieldErrors.name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="cluster-region"
                      className="text-xs font-medium"
                    >
                      {messages.settings.region}
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
                        name="cluster.region"
                        className="h-8 text-xs"
                      >
                        <SelectValue
                          placeholder={
                            regionsLoading
                              ? messages.settings.regionLoading
                              : regions.length === 0
                                ? messages.settings.regionEmpty
                                : messages.settings.regionPlaceholder
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
                    {metadataFieldErrors.region && (
                      <p className="text-xs text-destructive">
                        {metadataFieldErrors.region}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="cluster-storage-class"
                      className="text-xs font-medium"
                    >
                      {messages.settings.storageClass}
                    </Label>
                    <Input
                      id="cluster-storage-class"
                      name="cluster.metadata.storageClass"
                      value={clusterMetadata.storageClass ?? ""}
                      onChange={(event) =>
                        setClusterMetadata((prev: ClusterMetadataInput) => ({
                          ...prev,
                          storageClass: event.target.value || undefined,
                        }))
                      }
                      placeholder={messages.settings.storageClassPlaceholder}
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
                            {messages.settings.nodeSelectors}
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            {messages.settings.nodeSelectorsDescription}
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
                          {messages.settings.addLabel}
                        </Button>
                      </div>

                      {Object.entries(clusterMetadata.nodeSelector ?? {})
                        .length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/80 p-2.5 text-center text-xs text-muted-foreground">
                          {messages.settings.noNodeSelectors}
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
                                id={`node-selector-key-${idx}`}
                                name={`nodeSelector.${idx}.key`}
                                aria-label={messages.settings.keyPlaceholder}
                                placeholder={messages.settings.keyPlaceholder}
                                value={key}
                                onChange={(e) => {
                                  const newKey = e.target.value
                                  const entries = Object.entries(
                                    clusterMetadata.nodeSelector ?? {}
                                  )
                                  const updated: Record<string, string> = {}
                                  entries.forEach(
                                    ([entryKey, entryValue], i) => {
                                      updated[i === idx ? newKey : entryKey] =
                                        entryValue
                                    }
                                  )
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
                                id={`node-selector-value-${idx}`}
                                name={`nodeSelector.${idx}.value`}
                                aria-label={messages.settings.valuePlaceholder}
                                placeholder={messages.settings.valuePlaceholder}
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
                                aria-label={messages.settings.removeRow}
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
                            {messages.settings.tolerations}
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            {messages.settings.tolerationsDescription}
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
                          {messages.settings.addToleration}
                        </Button>
                      </div>

                      {(clusterMetadata.tolerations ?? []).length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/80 p-2.5 text-center text-xs text-muted-foreground">
                          {messages.settings.noTolerations}
                        </div>
                      ) : (
                        <div className="max-h-[180px] space-y-1.5 overflow-y-auto pr-1">
                          {(clusterMetadata.tolerations ?? []).map(
                            (tol, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/50 p-1.5"
                              >
                                <Label
                                  htmlFor={`toleration-${idx}-key`}
                                  className="sr-only"
                                >
                                  {messages.settings.keyPlaceholder}
                                </Label>
                                <Input
                                  id={`toleration-${idx}-key`}
                                  name={`tolerations.${idx}.key`}
                                  aria-label={messages.settings.keyPlaceholder}
                                  placeholder={messages.settings.keyPlaceholder}
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
                                  <Label
                                    htmlFor={`toleration-${idx}-operator`}
                                    className="sr-only"
                                  >
                                    {messages.settings.operator}
                                  </Label>
                                  <SelectTrigger
                                    id={`toleration-${idx}-operator`}
                                    name={`tolerations.${idx}.operator`}
                                    aria-label={messages.settings.operator}
                                    className="h-7 w-20 text-[11px]"
                                  >
                                    <SelectValue
                                      placeholder={messages.settings.operator}
                                    />
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
                                <Label
                                  htmlFor={`toleration-${idx}-value`}
                                  className="sr-only"
                                >
                                  {messages.settings.valuePlaceholder}
                                </Label>
                                <Input
                                  id={`toleration-${idx}-value`}
                                  name={`tolerations.${idx}.value`}
                                  aria-label={
                                    messages.settings.valuePlaceholder
                                  }
                                  placeholder={
                                    messages.settings.valuePlaceholder
                                  }
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
                                  <Label
                                    htmlFor={`toleration-${idx}-effect`}
                                    className="sr-only"
                                  >
                                    {messages.settings.effect}
                                  </Label>
                                  <SelectTrigger
                                    id={`toleration-${idx}-effect`}
                                    name={`tolerations.${idx}.effect`}
                                    aria-label={messages.settings.effect}
                                    className="h-7 w-28 text-[11px]"
                                  >
                                    <SelectValue
                                      placeholder={messages.settings.effect}
                                    />
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
                                  aria-label={messages.settings.removeRow}
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
                  <Label htmlFor="cluster-notes">
                    {messages.settings.notes}
                  </Label>
                  <textarea
                    id="cluster-notes"
                    name="cluster.metadata.notes"
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
                    {metadataSaving
                      ? messages.settings.saving
                      : messages.settings.save}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{messages.settings.endpointHeading}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {interpolate(messages.settings.endpointDescription, {
                  region: cluster.region,
                })}
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
                  {messages.settings.endpointLoading}
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
                          {messages.settings.managedBaseDomain}
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
                                <span className="text-emerald-500">
                                  {messages.common.copied}
                                </span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>{messages.common.copy}</span>
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
                        placeholder={
                          messages.settings.managedBaseDomainPlaceholder
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
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="endpoint-cname-target"
                          className="text-xs font-medium"
                        >
                          {messages.settings.cnameTarget}
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
                                <span className="text-emerald-500">
                                  {messages.common.copied}
                                </span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>{messages.common.copy}</span>
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
                        placeholder={messages.settings.cnameTargetPlaceholder}
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
                        {messages.settings.ipv4Addresses}
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
                        placeholder={messages.settings.addressPlaceholder}
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
                        {messages.settings.ipv6Addresses}
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
                        placeholder={messages.settings.addressPlaceholder}
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
                    <span>{messages.settings.endpointActive}</span>
                  </label>
                  {endpointFieldErrors.isActive && (
                    <p className="text-xs text-destructive">
                      {endpointFieldErrors.isActive}
                    </p>
                  )}
                  <Button type="submit" size="sm" disabled={endpointSaving}>
                    {endpointSaving
                      ? messages.settings.savingEndpoint
                      : messages.settings.saveEndpoint}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>{messages.settings.integrationsHeading}</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportJson}
                  disabled={exporting || cluster.integrations.length === 0}
                  title={messages.settings.exportTitle}
                >
                  <DownloadSimple size={14} className="mr-1" />
                  {exporting
                    ? messages.settings.exporting
                    : messages.settings.exportConfig}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportError(null)
                    setIsImportModalOpen(true)
                  }}
                  title={messages.settings.importTitle}
                >
                  <UploadSimple size={14} className="mr-1" />
                  {messages.settings.importConfig}
                </Button>
                {availableIntegrationTypes.length > 0 && (
                  <>
                    <select
                      id="integration-type"
                      name="integration.type"
                      aria-label={messages.settings.addIntegration}
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
                      {messages.settings.addIntegration}
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {cluster.integrations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {messages.settings.noIntegrations}
                </p>
              ) : (
                <div className="space-y-4">
                  {cluster.integrations.map((integration) => (
                    <div
                      key={integration.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">
                            {INTEGRATION_TYPE_LABELS[integration.type] ??
                              integration.type}
                          </span>
                          {/* isActive is a DB flag; the probe is the reachability. */}
                          <span className="text-xs text-muted-foreground">
                            {integration.isActive
                              ? messages.settings.integrationActive
                              : messages.settings.integrationInactive}
                            {" · "}
                            {integration.lastTestAt
                              ? integration.lastTestOk
                                ? messages.settings.testPassed
                                : messages.settings.testFailed
                              : messages.settings.notTested}
                            {integration.lastTestAt && (
                              <span>
                                {" · "}
                                {new Date(
                                  integration.lastTestAt
                                ).toLocaleTimeString(locale)}
                              </span>
                            )}
                          </span>
                        </div>
                        {integration.secretPreview && (
                          <p className="text-xs text-muted-foreground">
                            {messages.settings.secret}:{" "}
                            <span className="font-mono">
                              {integration.secretPreview}
                            </span>{" "}
                            ·{" "}
                            {new Date(
                              integration.updatedAt
                            ).toLocaleDateString()}
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
                          title={messages.settings.testConfigurationTitle}
                        >
                          <Pulse size={14} className="mr-1" />
                          {testingIntegrationType === integration.type
                            ? messages.settings.testing
                            : messages.settings.testConfiguration}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => handleIntegrationEdit(integration)}
                        >
                          <Pencil size={14} className="mr-1" />
                          {messages.settings.edit}
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
                              ? messages.settings.deactivate
                              : messages.settings.activate
                          }
                        >
                          <Power size={14} className="mr-1" />
                          {integration.isActive
                            ? messages.settings.integrationActive
                            : messages.settings.integrationInactive}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setIntegrationToDelete(integration)}
                          title={messages.settings.deleteIntegrationLabel}
                          aria-label={messages.settings.deleteIntegrationLabel}
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
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">
                {messages.settings.dangerHeading}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {messages.settings.dangerDescription}
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {cluster.status === "ACTIVE"
                    ? messages.settings.deactivateHeading
                    : messages.settings.activateHeading}
                </p>
                <p className="text-xs text-muted-foreground">
                  {messages.settings.deactivateDescription}
                </p>
              </div>
              <Button
                type="button"
                variant={
                  cluster.status === "ACTIVE" ? "destructive" : "default"
                }
                disabled={statusSaving}
                onClick={() => {
                  if (cluster.status === "ACTIVE") {
                    setDeactivateDialogOpen(true)
                    return
                  }
                  void handleStatusChange("ACTIVE", cluster.isDefault)
                }}
              >
                {cluster.status === "ACTIVE"
                  ? messages.settings.deactivate
                  : messages.settings.activate}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editingIntegration && (
        <IntegrationEditModal
          integration={editingIntegration}
          meta={integrationMeta}
          messages={messages}
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
          aria-labelledby="integration-import-title"
          aria-describedby="integration-import-description"
        >
          <div className="w-full max-w-2xl space-y-4 rounded-xl border border-border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3
                id="integration-import-title"
                className="text-lg font-semibold"
              >
                {messages.settings.importHeading}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={messages.settings.close}
                onClick={() => setIsImportModalOpen(false)}
              >
                {messages.settings.close}
              </Button>
            </div>
            <p
              id="integration-import-description"
              className="text-xs text-muted-foreground"
            >
              {messages.settings.importHelp}
            </p>
            {importError && (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
                role="alert"
              >
                {importError}
              </div>
            )}
            <div>
              <Label htmlFor="integration-import-file" className="sr-only">
                {messages.settings.importFileLabel}
              </Label>
              <input
                id="integration-import-file"
                name="integrationImportFile"
                type="file"
                accept=".json,application/json"
                aria-label={messages.settings.importFileLabel}
                onChange={handleFileUpload}
                className="text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-input file:bg-background file:px-2 file:py-1 file:text-xs file:font-medium hover:file:bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="integration-import-json" className="sr-only">
                {messages.settings.importJsonLabel}
              </Label>
              <textarea
                id="integration-import-json"
                name="integrationImportJson"
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder={messages.settings.importJsonPlaceholder}
                aria-label={messages.settings.importJsonLabel}
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
                {messages.settings.cancel}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleImportJson}
                disabled={importing || !importJsonText.trim()}
              >
                {importing
                  ? messages.settings.importing
                  : messages.settings.applyImport}
              </Button>
            </div>
          </div>
        </div>
      )}
      <AlertDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {interpolate(messages.settings.deactivateDialogTitle, {
                name: cluster.name,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {messages.settings.deactivateDialogBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusSaving}>
              {messages.settings.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={statusSaving}
              onClick={(event) => {
                event.preventDefault()
                void handleStatusChange(
                  "DEPRECATED",
                  cluster.isDefault
                ).finally(() => setDeactivateDialogOpen(false))
              }}
            >
              {statusSaving
                ? messages.settings.deactivating
                : messages.settings.confirmDeactivation}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={integrationToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setIntegrationToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {messages.settings.deleteIntegration}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {interpolate(messages.settings.deleteConfirm, {
                type: integrationToDelete
                  ? (INTEGRATION_TYPE_LABELS[integrationToDelete.type] ??
                    integrationToDelete.type)
                  : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{messages.settings.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault()
                if (integrationToDelete) {
                  void handleIntegrationDelete(integrationToDelete)
                }
              }}
            >
              {messages.settings.deleteIntegration}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  messages,
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
  messages: ClusterMessages
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="integration-edit-title"
      aria-describedby="integration-edit-description"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="integration-edit-title" className="text-lg font-semibold">
              {(integration.id.startsWith("new-")
                ? messages.settings.addIntegrationTitle
                : messages.settings.editIntegrationTitle
              ).replace("{type}", INTEGRATION_TYPE_LABELS[type] ?? type)}
            </h3>
            <p
              id="integration-edit-description"
              className="mt-1 text-sm text-muted-foreground"
            >
              {integration.id.startsWith("new-")
                ? messages.settings.addIntegrationDescription
                : messages.settings.editIntegrationDescription}
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
              title={messages.settings.autoFillDefaultsTitle}
            >
              <Sparkle size={13} className="mr-1 text-primary" />
              {messages.settings.autoFillDefaults}
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
                    <SelectTrigger
                      id={`int-meta-${field}`}
                      name={`integration.meta.${field}`}
                    >
                      <SelectValue
                        placeholder={
                          messages.settings.connectionModePlaceholder
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INTERNAL">
                        {messages.settings.internalMode}
                      </SelectItem>
                      <SelectItem value="EXTERNAL">
                        {messages.settings.externalMode}
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
                    <SelectTrigger
                      id={`int-meta-${field}`}
                      name={`integration.meta.${field}`}
                    >
                      <SelectValue
                        placeholder={
                          messages.settings.connectionModePlaceholder
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">
                        {messages.settings.trueValue}
                      </SelectItem>
                      <SelectItem value="false">
                        {messages.settings.falseValue}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : isNum ? (
                  <Input
                    id={`int-meta-${field}`}
                    name={`integration.meta.${field}`}
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
                    name={`integration.meta.${field}`}
                    value={String(meta[field] ?? "")}
                    placeholder={
                      field === "apiUrl" && type === "ARGOCD"
                        ? messages.settings.integrationApiUrlPlaceholder
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
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">
                    {messages.settings.internalModeTitle}
                  </p>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {messages.settings.internalModeBadge}
                  </span>
                </div>
                <p>{messages.settings.internalModeDescription}</p>
              </div>
            )}

          {type === "KUBECONFIG" && meta.connectionMode === "EXTERNAL" && (
            <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground">
                  {messages.settings.externalModeTitle}
                </p>
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  {messages.settings.externalModeBadge}
                </span>
              </div>
              <p>{messages.settings.externalModeDescription}</p>
              <p>{messages.settings.externalModeSteps}</p>
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
              ? messages.settings.secretPlaceholderInternal
              : messages.settings.secretPlaceholderExisting

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
                    name={`integration.secrets.${field}`}
                    aria-label={label}
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
                    name={`integration.secrets.${field}`}
                    aria-label={label}
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
            {messages.settings.cancel}
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving
              ? messages.settings.savingIntegration
              : messages.settings.saveIntegration}
          </Button>
        </div>
      </div>
    </div>
  )
}

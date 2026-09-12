"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Eye, Database } from "@phosphor-icons/react"

import { eden } from "@/lib/eden"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getMessages } from "@/lib/i18n/messages"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ClusterCreateDialog } from "./cluster-create-dialog"

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

export function ClusterList() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale).console.app.clusterInventory

  const [clusters, setClusters] = useState<ClusterAdminDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: payload } = await eden.api.admin[
          "app-hosting"
        ].clusters.get({
          $query: { page: 1, limit: 20 },
        })
        if (!payload) {
          throw new Error(messages.loadError)
        }
        if (!payload.ok) {
          throw new Error(payload.message)
        }
        if (!Array.isArray(payload.data)) {
          throw new Error(messages.loadError)
        }
        setClusters(payload.data)
      } catch (cause) {
        if (cancelled) return
        setClusters([])
        setError(cause instanceof Error ? cause.message : messages.loadError)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [messages.loadError, retry])

  const handleRetry = () => setRetry((v) => v + 1)
  const handleCreated = () => {
    setShowCreate(false)
    setRetry((v) => v + 1)
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
        {messages.loading}
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
        <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
          {messages.retry}
        </Button>
      </div>
    )
  }

  const lifecycleLabels = {
    ACTIVE: messages.enabled,
    PLANNED: messages.planned,
    DEPRECATED: messages.disabled,
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {clusters.length === 1
            ? messages.countOne
            : messages.countMany.replace("{count}", String(clusters.length))}
        </p>
        <Button type="button" size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1" />
          {messages.createCluster}
        </Button>
      </div>

      {clusters.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/10 p-12 text-center">
          <Database size={40} className="text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{messages.empty}</p>
            <p className="text-xs text-muted-foreground">
              {messages.emptyDescription}
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} className="mr-1" />
            {messages.createCluster}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{messages.tableName}</TableHead>
                  <TableHead>{messages.tableCode}</TableHead>
                  <TableHead>{messages.tableRegion}</TableHead>
                  <TableHead>{messages.tableRouting}</TableHead>
                  <TableHead>{messages.tableConfiguration}</TableHead>
                  <TableHead>{messages.tableDefault}</TableHead>
                  <TableHead>{messages.tableActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clusters.map((cluster) => {
                  const configured = cluster.integrations.length
                  const enabled = cluster.integrations.filter(
                    (integration) => integration.isActive
                  ).length
                  const detailPath = localizePathname({
                    pathname: `/portal/app/clusters/${cluster.id}`,
                    locale,
                  })
                  return (
                    <TableRow key={cluster.id}>
                      <TableCell className="font-medium">
                        {cluster.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {cluster.code}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cluster.region}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={STATUS_VARIANT[cluster.status] ?? "outline"}
                        >
                          {lifecycleLabels[cluster.status] ?? cluster.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {configured === 0 ? (
                          <Link
                            className="font-medium text-amber-600 hover:underline dark:text-amber-400"
                            href={`${detailPath}?tab=settings`}
                          >
                            {messages.setupNeeded}
                          </Link>
                        ) : (
                          messages.configurationSummary
                            .replace("{active}", String(enabled))
                            .replace("{configured}", String(configured))
                        )}
                      </TableCell>
                      <TableCell>
                        {cluster.isDefault ? (
                          <Badge variant="success">
                            {messages.defaultLabel}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="xs">
                          <Link href={detailPath}>
                            <Eye size={14} className="mr-1" />
                            {messages.view}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {showCreate && (
        <ClusterCreateDialog
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}

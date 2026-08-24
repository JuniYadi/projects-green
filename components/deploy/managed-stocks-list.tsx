"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { eden } from "@/lib/eden"
import type { ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataTable } from "@/components/data-table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ManagedStockDTO } from "@/modules/deploy/app-managed-stock.dto"

type ClusterOption = {
  id: string
  name: string
  code: string
}
const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "success" | "warning"
> = {
  AVAILABLE: "success",
  ALLOCATED: "default",
  DIRTY: "warning",
  MAINTENANCE: "secondary",
}

export function ManagedStocksList() {
  const [stocks, setStocks] = useState<ManagedStockDTO[]>([])
  const [clusters, setClusters] = useState<ClusterOption[]>([])
  const [selectedClusterId, setSelectedClusterId] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingClusters, setLoadingClusters] = useState(true)
  const [importing, setImporting] = useState(false)
  const [maintenanceId, setMaintenanceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadClusters = async () => {
      setLoadingClusters(true)
      try {
        const { data: payload } = await eden.api.admin[
          "app-hosting"
        ].clusters.get({ $query: { page: 1, limit: 100 } })
        const data = Array.isArray((payload as { data?: unknown } | null)?.data)
          ? (payload as { data: ClusterOption[] }).data
          : []
        if (!cancelled) setClusters(data)
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load hosting clusters."
          )
        }
      } finally {
        if (!cancelled) setLoadingClusters(false)
      }
    }

    void loadClusters()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadStocks = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: payload } = await eden.api.admin["managed-stocks"].get({
          $query: selectedClusterId ? { clusterId: selectedClusterId } : {},
        })
        const data = Array.isArray((payload as { data?: unknown } | null)?.data)
          ? (payload as { data: ManagedStockDTO[] }).data
          : []
        if (!cancelled) setStocks(data)
      } catch (cause) {
        if (!cancelled) {
          setStocks([])
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load managed stocks."
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadStocks()
    return () => {
      cancelled = true
    }
  }, [selectedClusterId])

  const handleImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setImporting(true)
    setError(null)

    const form = event.currentTarget
    const values = new FormData(form)
    const label = String(values.get("label") ?? "").trim()
    const serviceType = String(values.get("serviceType") ?? "MYSQL") as
      | "MYSQL"
      | "POSTGRESQL"
      | "REDIS"
    const payload = {
      clusterId: String(values.get("clusterId") ?? ""),
      serviceType,
      ...(label ? { label } : {}),
      endpointHost: String(values.get("endpointHost") ?? "").trim(),
      endpointPort: Number(values.get("endpointPort") ?? 0),
      databaseName: String(values.get("databaseName") ?? "").trim(),
      username: String(values.get("username") ?? "").trim(),
      password: String(values.get("password") ?? ""),
    }

    try {
      const { data: importResult } =
        await eden.api.admin["managed-stocks"].import.post(payload)
      const ok =
        importResult &&
        typeof importResult === "object" &&
        "id" in importResult &&
        "clusterId" in importResult
      if (!ok) {
        throw new Error("The imported stock response was invalid.")
      }
      const typed = importResult as ManagedStockDTO
      if (!selectedClusterId || selectedClusterId === typed.clusterId) {
        setStocks((current) => [...current, typed])
      }
      form.reset()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to import stock."
      )
    } finally {
      setImporting(false)
    }
  }

  const handleMaintenance = async (stock: ManagedStockDTO) => {
    if (stock.status === "ALLOCATED") return

    setMaintenanceId(stock.id)
    setError(null)
    try {
      await eden.api.admin["managed-stocks"]({
        id: stock.id,
      }).maintenance.patch()
      setStocks((current) =>
        current.map((item) =>
          item.id === stock.id ? { ...item, status: "MAINTENANCE" } : item
        )
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to set stock maintenance status."
      )
    } finally {
      setMaintenanceId(null)
    }
  }

  const columns: ColumnDef<ManagedStockDTO, unknown>[] = [
    {
      accessorKey: "label",
      header: "Label",
      cell: ({ row }) => row.original.label ?? "—",
    },
    {
      accessorKey: "serviceType",
      header: "Engine Type",
    },
    {
      id: "endpoint",
      header: "Host:Port",
      accessorFn: (row) => `${row.endpointHost}:${row.endpointPort}`,
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.endpointHost}:{row.original.endpointPort}
        </span>
      ),
    },
    {
      accessorKey: "databaseName",
      header: "Database",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] ?? "secondary"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "vaultPath",
      header: "Vault Path",
      cell: ({ row }) => (
        <span
          className="block max-w-[220px] truncate font-mono text-xs"
          title={row.original.vaultPath}
        >
          {row.original.vaultPath.length <= 32
            ? row.original.vaultPath
            : `${row.original.vaultPath.slice(0, 29)}...`}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created At",
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      cell: ({ row }) => (
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={
            row.original.status === "ALLOCATED" ||
            maintenanceId === row.original.id
          }
          onClick={() => void handleMaintenance(row.original)}
        >
          {maintenanceId === row.original.id
            ? "Updating..."
            : "Set Maintenance"}
        </Button>
      ),
    },
  ]

  const available = stocks.filter(
    (stock) => stock.status === "AVAILABLE"
  ).length
  const allocated = stocks.filter(
    (stock) => stock.status === "ALLOCATED"
  ).length
  const dirty = stocks.filter((stock) => stock.status === "DIRTY").length

  return (
    <div className="space-y-6">
      {error && (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Import Database Stock</CardTitle>
          <CardDescription>
            Add a pre-provisioned database slot to the 1-click deployment pool.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <details open>
            <summary className="mb-4 cursor-pointer text-sm font-medium">
              Import a stock slot
            </summary>
            <form
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              onSubmit={(event) => void handleImport(event)}
            >
              <div className="grid gap-2">
                <Label htmlFor="stock-cluster">Cluster</Label>
                <select
                  id="stock-cluster"
                  name="clusterId"
                  required
                  disabled={loadingClusters || importing}
                  className="h-8 w-full rounded-2xl border border-border bg-background px-2.5 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>
                    {loadingClusters ? "Loading clusters..." : "Select cluster"}
                  </option>
                  {clusters.map((cluster) => (
                    <option key={cluster.id} value={cluster.id}>
                      {cluster.name} ({cluster.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock-service-type">Engine Type</Label>
                <select
                  id="stock-service-type"
                  name="serviceType"
                  required
                  disabled={importing}
                  defaultValue="MYSQL"
                  className="h-8 w-full rounded-2xl border border-border bg-background px-2.5 text-sm"
                >
                  <option value="MYSQL">MYSQL</option>
                  <option value="POSTGRESQL">POSTGRESQL</option>
                  <option value="REDIS">REDIS</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock-label">Label (optional)</Label>
                <Input id="stock-label" name="label" disabled={importing} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock-host">Host</Label>
                <Input
                  id="stock-host"
                  name="endpointHost"
                  required
                  disabled={importing}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock-port">Port</Label>
                <Input
                  id="stock-port"
                  name="endpointPort"
                  type="number"
                  min="1"
                  max="65535"
                  required
                  disabled={importing}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock-database">Database Name</Label>
                <Input
                  id="stock-database"
                  name="databaseName"
                  required
                  disabled={importing}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock-username">Username</Label>
                <Input
                  id="stock-username"
                  name="username"
                  required
                  disabled={importing}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock-password">Password</Label>
                <Input
                  id="stock-password"
                  name="password"
                  type="password"
                  required
                  disabled={importing}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={importing || loadingClusters}>
                  {importing ? "Importing..." : "Import Stock"}
                </Button>
              </div>
            </form>
          </details>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          {available} AVAILABLE / {allocated} ALLOCATED / {dirty} DIRTY
        </p>
        {clusters.length > 1 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <Label htmlFor="stock-cluster-filter">Cluster</Label>
            <select
              id="stock-cluster-filter"
              value={selectedClusterId}
              onChange={(event) => setSelectedClusterId(event.target.value)}
              className="h-8 min-w-40 rounded-2xl border border-border bg-background px-2.5 text-sm"
            >
              <option value="">All clusters</option>
              {clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.name} ({cluster.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          Loading managed stocks...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <DataTable
            tableId="portal-managed-stocks"
            columns={columns}
            data={stocks}
            searchableColumns={[
              "label",
              "serviceType",
              "endpoint",
              "databaseName",
              "status",
              "vaultPath",
            ]}
            searchPlaceholder="Search managed stocks..."
            emptyMessage="No managed database stocks found."
            pageSize={10}
          />
        </div>
      )}
    </div>
  )
}

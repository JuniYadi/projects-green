"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getVpnStatus,
  revokeVpnClient,
  getVpnAdminHealth,
  type VpnClientStatus,
} from "@/lib/vpn-client"
import {
  GlobeIcon,
  DownloadIcon,
  ShieldCheckIcon,
  ShieldWarningIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
} from "@phosphor-icons/react"

type HealthState = {
  ok: boolean
  output: string
} | null

export default function PortalVpnPage() {
  const [clients, setClients] = useState<VpnClientStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState<HealthState>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [revokeLoading, setRevokeLoading] = useState<string | null>(null)

  const loadClients = useCallback(async () => {
    try {
      const status = await getVpnStatus()
      setClients(status.clients)
    } catch {
      // Clients remain empty on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      await loadClients()
    }
    run()
  }, [loadClients])

  const handleHealthCheck = async () => {
    setHealthLoading(true)
    try {
      const result = await getVpnAdminHealth()
      setHealth(result.health)
    } catch {
      setHealth({ ok: false, output: "Health check failed" })
    } finally {
      setHealthLoading(false)
    }
  }

  const handleDownload = (clientId: string) => {
    window.location.assign(`/api/vpn/clients/${clientId}/download`)
  }

  const handleRevoke = async (clientId: string) => {
    setRevokeLoading(clientId)
    try {
      await revokeVpnClient(clientId)
      await loadClients()
    } catch {
      // Error stays visible via state
    } finally {
      setRevokeLoading(null)
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">VPN Clients</h1>
        <p className="text-sm text-muted-foreground">
          Manage OpenVPN clients and check server health.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <GlobeIcon className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">
              Active Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {loading
                ? "-"
                : clients.filter((c) => c.status === "ACTIVE").length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <ShieldCheckIcon className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {loading ? "-" : clients.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            {health?.ok ? (
              <CheckCircleIcon className="h-4 w-4 text-green-600" />
            ) : health && !health.ok ? (
              <XCircleIcon className="h-4 w-4 text-red-600" />
            ) : (
              <ShieldWarningIcon className="h-4 w-4" />
            )}
            <CardTitle className="text-sm font-medium">Server Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {health === null
                ? "Not checked"
                : health.ok
                  ? `Healthy: ${health.output}`
                  : `Unhealthy: ${health.output}`}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleHealthCheck}
              disabled={healthLoading}
            >
              {healthLoading ? "Checking..." : "Check Health"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">VPN Clients</CardTitle>
              <CardDescription>
                All VPN clients across organizations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <GlobeIcon className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No VPN clients found. Clients will appear here after customers
                activate VPN subscriptions.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Period Start</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      {client.clientName}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          client.status === "ACTIVE"
                            ? "text-green-600"
                            : client.status === "PROVISIONING_FAILED"
                              ? "text-red-600"
                              : "text-muted-foreground"
                        }
                      >
                        {client.status}
                      </span>
                    </TableCell>
                    <TableCell>{client.regionCode}</TableCell>
                    <TableCell>
                      {new Date(client.currentPeriodStart).toLocaleDateString(
                        "id-ID",
                        { day: "numeric", month: "short", year: "numeric" }
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(client.currentPeriodEnd).toLocaleDateString(
                        "id-ID",
                        { day: "numeric", month: "short", year: "numeric" }
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {client.status === "ACTIVE" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(client.id)}
                            >
                              <DownloadIcon className="mr-1 h-3 w-3" />
                              Download
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRevoke(client.id)}
                              disabled={revokeLoading === client.id}
                            >
                              <TrashIcon className="mr-1 h-3 w-3" />
                              {revokeLoading === client.id
                                ? "Revoking..."
                                : "Revoke"}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

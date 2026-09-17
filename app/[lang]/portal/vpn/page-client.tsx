"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
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
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
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
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalVpnPageClient

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
      setHealth({ ok: false, output: t.healthCheckFailed })
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
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <GlobeIcon className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">
              {t.activeClients}
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
            <CardTitle className="text-sm font-medium">
              {t.totalClients}
            </CardTitle>
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
            <CardTitle className="text-sm font-medium">
              {t.serverHealth}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {health === null
                ? t.notChecked
                : health.ok
                  ? t.healthy.replace("{output}", health.output)
                  : t.unhealthy.replace("{output}", health.output)}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleHealthCheck}
              disabled={healthLoading}
            >
              {healthLoading ? t.checking : t.checkHealth}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{t.title}</CardTitle>
              <CardDescription>{t.tableDescription}</CardDescription>
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
              <p className="text-sm text-muted-foreground">{t.emptyState}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.colClientName}</TableHead>
                  <TableHead>{t.colStatus}</TableHead>
                  <TableHead>{t.colRegion}</TableHead>
                  <TableHead>{t.colPeriodStart}</TableHead>
                  <TableHead>{t.colPeriodEnd}</TableHead>
                  <TableHead className="text-right">{t.colActions}</TableHead>
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
                              {t.download}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRevoke(client.id)}
                              disabled={revokeLoading === client.id}
                            >
                              <TrashIcon className="mr-1 h-3 w-3" />
                              {revokeLoading === client.id
                                ? t.revoking
                                : t.revoke}
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

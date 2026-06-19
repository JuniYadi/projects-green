"use client"

import { useCallback, useEffect, useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PlusIcon, PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react"

import {
  vpnApi,
  type VpnPackageItem,
  type VpnServerItem,
} from "./vpn-admin-client"
import { PackageForm } from "./package-form"

function formatPrice(price: string, currency: "IDR" | "USD"): string {
  const amount = Number(price)
  if (Number.isNaN(amount)) return `${currency} ${price}`
  return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(amount)
}

export function PackagesTable() {
  const [packages, setPackages] = useState<VpnPackageItem[]>([])
  const [servers, setServers] = useState<VpnServerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<VpnPackageItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pkgRes, serverRes] = await Promise.all([
        vpnApi<{ ok: true; data: VpnPackageItem[] }>("/admin/vpn/packages"),
        vpnApi<{ ok: true; data: VpnServerItem[] }>("/admin/vpn/servers"),
      ])
      setPackages(pkgRes.data)
      setServers(serverRes.data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (pkg: VpnPackageItem) => {
    setEditing(pkg)
    setDialogOpen(true)
  }

  const deactivate = async (pkg: VpnPackageItem) => {
    if (
      !window.confirm(
        `Deactivate package "${pkg.name}"? Existing subscriptions keep running.`
      )
    )
      return
    try {
      await vpnApi(`/admin/vpn/packages/${pkg.id}`, { method: "DELETE" })
      await load()
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate} size="sm">
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Package
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price/mo</TableHead>
              <TableHead>Servers</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : packages.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-sm text-muted-foreground"
                >
                  No packages yet.
                </TableCell>
              </TableRow>
            ) : (
              packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">
                    {pkg.name}
                    {pkg.description && (
                      <p className="text-xs text-muted-foreground">
                        {pkg.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{formatPrice(pkg.price, pkg.currency)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {pkg.servers.map((entry) => (
                        <div key={entry.id} className="text-sm">
                          <span className="font-mono text-muted-foreground uppercase">
                            {entry.server.region.countryCode}
                          </span>{" "}
                          {entry.server.name}
                          <span className="text-xs text-muted-foreground">
                            {entry.protocols.length > 0
                              ? ` (${entry.protocols.join(", ")})`
                              : " (no protocols)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={pkg.isActive ? "default" : "secondary"}>
                      {pkg.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(pkg)}
                        aria-label={`Edit ${pkg.name}`}
                      >
                        <PencilSimpleIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deactivate(pkg)}
                        disabled={!pkg.isActive}
                        aria-label={`Deactivate ${pkg.name}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PackageForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        servers={servers}
        onSaved={load}
      />
    </div>
  )
}

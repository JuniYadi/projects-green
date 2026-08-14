"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"

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
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import {
  listVpnPackages,
  listVpnServers,
  deleteVpnPackage,
  type VpnPackageItem,
  type VpnServerItem,
} from "./vpn-admin-client"
import { PackageForm } from "./package-form"

export function PackagesTable() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
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
        listVpnPackages(),
        listVpnServers(),
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
      await deleteVpnPackage(pkg.id)
      await load()
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  const pricingHref = (pkg: VpnPackageItem) => {
    const editorPath = localizePathname({
      pathname: "/portal/billing/catalog/products/vpn",
      locale,
    })
    const returnPath = localizePathname({
      pathname: "/portal/vpn/packages",
      locale,
    })
    const query = new URLSearchParams({
      planId: pkg.servicePlanId,
      returnTo: returnPath,
      tab: "plans",
    })
    return `${editorPath}?${query.toString()}`
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
              <TableHead>Pricing</TableHead>
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
                  <TableCell>
                    <div className="space-y-1">
                      {pkg.catalogPlan ? (
                        <>
                          <div className="font-medium">
                            {pkg.catalogPlan.name}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {pkg.catalogPlan.code}
                          </div>
                          {pkg.catalogPlan.offers.length > 0 ? (
                            <div className="text-xs text-muted-foreground">
                              {pkg.catalogPlan.offers.map((offer) => (
                                <div key={offer.id}>
                                  {offer.currency} {offer.periodPrice} /{" "}
                                  {offer.billingPeriod
                                    .toLowerCase()
                                    .replace("_", " ")}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <Badge variant="outline">Pricing required</Badge>
                          )}
                          {!pkg.catalogPlan.isActive && (
                            <Badge variant="secondary">Plan inactive</Badge>
                          )}
                          {!pkg.catalogPlan.parentIsActive && (
                            <Badge variant="secondary">
                              Catalog parent inactive
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Badge variant="outline">Pricing required</Badge>
                      )}
                      <div>
                        <Link
                          className="text-sm text-primary hover:underline"
                          href={pricingHref(pkg)}
                        >
                          Manage pricing
                        </Link>
                      </div>
                    </div>
                  </TableCell>
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

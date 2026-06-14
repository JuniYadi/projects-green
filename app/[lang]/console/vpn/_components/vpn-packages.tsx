"use client"

import { useEffect, useState } from "react"

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getVpnPackage,
  listVpnPackages,
  purchaseVpnPackage,
  type VpnPackageDetail,
  type VpnPackageSummary,
} from "@/lib/vpn-client"
import { GlobeIcon } from "@phosphor-icons/react"

type Props = {
  topupUrl: string
  onPurchased: () => void
}

function formatPrice(price: string, currency: string): string {
  const amount = Number(price)
  if (Number.isNaN(amount)) return `${currency} ${price}`
  if (currency === "IDR") {
    return `Rp${amount.toLocaleString("id-ID")}`
  }
  return `${currency} ${amount.toLocaleString("en-US")}`
}

export function VpnPackages({ topupUrl, onPurchased }: Props) {
  const [packages, setPackages] = useState<VpnPackageSummary[] | null>(null)
  const [selected, setSelected] = useState<VpnPackageDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<{ message: string; topup: boolean } | null>(
    null
  )

  useEffect(() => {
    let active = true
    listVpnPackages()
      .then((data) => {
        if (active) setPackages(data)
      })
      .catch(() => {
        if (active) setPackages([])
      })
    return () => {
      active = false
    }
  }, [])

  const openDetail = async (id: string) => {
    setLoadingDetail(true)
    setError(null)
    try {
      const detail = await getVpnPackage(id)
      setSelected(detail)
    } catch {
      setError({ message: "Could not load package details.", topup: false })
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleBuy = async () => {
    if (!selected) return
    setPurchasing(true)
    setError(null)
    try {
      await purchaseVpnPackage(selected.id)
      setSelected(null)
      onPurchased()
    } catch (err: unknown) {
      const e = err as Error & { error?: string }
      setError({
        message: e.message || "Purchase failed. Please try again.",
        topup: e.error === "INSUFFICIENT_BALANCE",
      })
    } finally {
      setPurchasing(false)
    }
  }

  if (packages === null) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    )
  }

  if (packages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No VPN packages are available right now.
      </p>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {packages.map((pkg) => (
          <Card key={pkg.id} className="flex flex-col">
            <CardHeader className="flex flex-row items-center gap-2">
              <GlobeIcon className="h-5 w-5" />
              <CardTitle className="text-base">{pkg.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <p className="text-lg font-semibold">
                {formatPrice(pkg.price, pkg.currency)}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / month
                </span>
              </p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  {pkg.serverCount} server{pkg.serverCount === 1 ? "" : "s"} ·{" "}
                  {pkg.protocolCount} protocol
                  {pkg.protocolCount === 1 ? "" : "s"}
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {pkg.regions.map((region) => (
                    <Badge key={region} variant="secondary">
                      {region}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => openDetail(pkg.id)}
                disabled={loadingDetail}
              >
                Select
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
            setError(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.name} —{" "}
                  {formatPrice(selected.price, selected.currency)}/month
                </DialogTitle>
                <DialogDescription>
                  You&apos;ll get access to all of these in one subscription.
                </DialogDescription>
              </DialogHeader>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Server</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>You get</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.servers.map((server) => (
                    <TableRow key={server.serverId}>
                      <TableCell className="font-medium">
                        {server.name}
                      </TableCell>
                      <TableCell>{server.region.name}</TableCell>
                      <TableCell>{server.protocols.join(" + ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                  <p>{error.message}</p>
                  {error.topup && (
                    <a
                      href={topupUrl}
                      className="mt-1 inline-block font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Top up balance
                    </a>
                  )}
                </div>
              )}

              <Button onClick={handleBuy} disabled={purchasing}>
                {purchasing
                  ? "Processing…"
                  : `Buy Now — ${formatPrice(selected.price, selected.currency)}`}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

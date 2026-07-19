"use client"

import * as React from "react"
import {
  ArrowLeft,
  ShoppingBagOpen,
  ArrowClockwise,
  Image,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useParams, useRouter } from "next/navigation"
import { whatsappClient } from "@/lib/api/whatsapp-client"

type CatalogProduct = {
  id: string
  productRetailerId: string
  name: string
  description?: string | null
  price?: string | null
  currency?: string | null
  imageUrl?: string | null
  url?: string | null
}

export default function CatalogDetailPage() {
  const params = useParams<{ lang?: string; catalogId: string }>()
  const router = useRouter()
  const catalogId = params.catalogId!

  const [catalog, setCatalog] = React.useState<Record<string, unknown> | null>(
    null
  )
  const [products, setProducts] = React.useState<CatalogProduct[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [syncing, setSyncing] = React.useState(false)

  const load = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [catRes, prodRes] = await Promise.all([
        whatsappClient.catalogs.get(catalogId),
        whatsappClient.catalogs.listProducts(catalogId),
      ])
      setCatalog(catRes.data)
      setProducts(prodRes.data ?? [])
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load catalog."
      )
    } finally {
      setIsLoading(false)
    }
  }, [catalogId])

  React.useEffect(() => {
    ;(async () => {
      await load()
    })()
  }, [load])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await whatsappClient.catalogs.sync(catalogId)
      toast.success(`Synced ${res.data.synced} products.`)
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sync failed.")
    } finally {
      setSyncing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!catalog) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <ShoppingBagOpen className="size-16 text-muted-foreground/40" />
        <p className="text-muted-foreground">Catalog not found.</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" /> Back
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{catalog.name as string}</h1>
          <p className="text-sm text-muted-foreground">
            Meta ID: {catalog.metaCatalogId as string} &middot;{" "}
            {products.length} products
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          <ArrowClockwise
            className={`mr-2 size-4 ${syncing ? "animate-spin" : ""}`}
          />
          {syncing ? "Syncing..." : "Sync Products"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            Products cached from Meta Commerce Manager. Click sync to refresh.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <ShoppingBagOpen className="size-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No products synced yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
              >
                Sync Now
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <Card key={p.id} className="overflow-hidden">
                  <div className="flex aspect-video items-center justify-center bg-muted">
                    {p.imageUrl ? (
                      // ponytail: img not Image — external URL, no optimization needed
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      // ponytail: decorative phosphor icon, no alt needed
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <Image className="size-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="truncate font-medium">{p.name}</h3>
                    <p className="truncate text-xs text-muted-foreground">
                      SKU: {p.productRetailerId}
                    </p>
                    {p.price && (
                      <p className="mt-1 text-sm font-semibold">
                        {p.currency ? `${p.currency} ` : ""}
                        {p.price}
                      </p>
                    )}
                    {p.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

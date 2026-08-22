"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  MagnifyingGlassIcon,
  PackageIcon,
  PencilSimpleIcon,
} from "@/components/ui/phosphor-icons"
import {
  getAdminCatalogPackages,
  upsertAdminCatalogPackage,
} from "@/lib/billing-client"
import type { CatalogProduct } from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"
import { toast } from "sonner"

const PRODUCT_LABELS: Record<string, string> = {
  APP_HOSTING: "App Hosting",
  VPN: "VPN",
  WHATSAPP: "WhatsApp",
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400",
  published:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  archived:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
}

export default function PortalBillingCatalogPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState(searchParams.get("q") ?? "")

  // Edit package modal state
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(
    null
  )
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editIsActive, setEditIsActive] = useState(true)
  const [savingPackage, setSavingPackage] = useState(false)

  const loadCatalog = useCallback(async (query: string) => {
    try {
      setLoading(true)
      setError(null)
      const data = await getAdminCatalogPackages()
      const filtered = query
        ? data.products.filter(
            (p) =>
              p.name.toLowerCase().includes(query.toLowerCase()) ||
              p.code.toLowerCase().includes(query.toLowerCase()) ||
              p.description?.toLowerCase().includes(query.toLowerCase())
          )
        : data.products
      setProducts(filtered)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load catalog products"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCatalog(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [loadCatalog, search])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearch(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("q", value)
    } else {
      params.delete("q")
    }
    router.replace(`?${params.toString()}`)
  }

  const getProductStatus = (
    product: CatalogProduct
  ): "published" | "archived" => {
    return product.isActive ? "published" : "archived"
  }

  const openEditModal = (e: React.MouseEvent, product: CatalogProduct) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingProduct(product)
    setEditName(product.name)
    setEditDescription(product.description ?? "")
    setEditIsActive(product.isActive)
  }

  const handleSavePackage = async () => {
    if (!editingProduct) return
    if (!editName.trim()) {
      toast.error("Package name is required")
      return
    }

    setSavingPackage(true)
    try {
      await upsertAdminCatalogPackage({
        code: editingProduct.code,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        isActive: editIsActive,
      })
      toast.success("Package updated successfully")
      setEditingProduct(null)
      void loadCatalog(search)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save package"
      toast.error(message)
    } finally {
      setSavingPackage(false)
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Product Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Manage service packages, plans, and add-ons available for
            subscription.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Input
              placeholder="Search products..."
              value={search}
              onChange={handleSearch}
              className="pl-9"
              aria-label="Search products"
            />
            <MagnifyingGlassIcon className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Link href="/portal/billing/catalog/app_hosting/products">
            <Button size="sm">Manage Products</Button>
          </Link>
          <Link href="/portal/billing/catalog/addons">
            <Button variant="outline" size="sm">
              Add-ons
            </Button>
          </Link>
        </div>
      </header>
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <PackageIcon className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                No products match your search.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const status = getProductStatus(product)
            return (
              <div key={product.code} className="group relative">
                <Link
                  href={`/portal/billing/catalog/${product.code.toLowerCase()}/products`}
                >
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">
                          {PRODUCT_LABELS[product.code] ?? product.code}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={STATUS_COLORS[status] ?? ""}
                          >
                            {status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            aria-label={`Edit ${product.name} package`}
                            onClick={(e) => openEditModal(e, product)}
                          >
                            <PencilSimpleIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {product.description ?? "No description provided."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">
                          {product.plans.length} plan
                          {product.plans.length !== 1 ? "s" : ""}
                        </p>
                        {product.plans.length > 0 && (
                          <div className="space-y-1">
                            {product.plans.slice(0, 2).map((plan) => {
                              const bestOffer = plan.offers.reduce(
                                (best, offer) =>
                                  Number(offer.periodPrice) <
                                  Number(best.periodPrice)
                                    ? offer
                                    : best,
                                plan.offers[0]
                              )
                              return (
                                <div
                                  key={plan.id}
                                  className="flex justify-between"
                                >
                                  <span className="text-muted-foreground">
                                    {plan.name}
                                  </span>
                                  <span className="font-medium">
                                    {bestOffer
                                      ? formatBillingMoney(
                                          bestOffer.periodPrice,
                                          bestOffer.currency
                                        )
                                      : "—"}
                                  </span>
                                </div>
                              )
                            })}
                            {product.plans.length > 2 && (
                              <p className="text-xs text-muted-foreground">
                                +{product.plans.length - 2} more plan
                                {product.plans.length - 2 !== 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Package Metadata Dialog */}
      <Dialog
        open={Boolean(editingProduct)}
        onOpenChange={(open) => {
          if (!open) setEditingProduct(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Package Metadata</DialogTitle>
            <DialogDescription>
              Update display name, description, and catalog availability for{" "}
              <strong>{editingProduct?.code}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pkg-name">Package Name *</Label>
              <Input
                id="pkg-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. App Hosting, WhatsApp"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pkg-desc">Description</Label>
              <Textarea
                id="pkg-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe this service package"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <Label htmlFor="pkg-active" className="text-sm font-medium">
                  Active in Catalog
                </Label>
                <p className="text-xs text-muted-foreground">
                  Controls whether this service package is visible to tenants.
                </p>
              </div>
              <Switch
                id="pkg-active"
                checked={editIsActive}
                onCheckedChange={setEditIsActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingProduct(null)}
              disabled={savingPackage}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePackage} disabled={savingPackage}>
              {savingPackage ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

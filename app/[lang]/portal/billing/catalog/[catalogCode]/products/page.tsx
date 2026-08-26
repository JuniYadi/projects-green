"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArchiveBoxIcon,
  ArrowLeftIcon,
  Copy,
  DotsThreeVertical,
  PackageIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/phosphor-icons"
import {
  getAdminCatalogProductsList,
  getAdminCatalogProductDetail,
  upsertAdminCatalogProduct,
  deleteAdminCatalogProduct,
} from "@/lib/billing-client"
import type { CatalogPlan } from "@/lib/billing-client"
import { CatalogExportImport } from "@/components/billing/admin/catalog/catalog-export-import"
import { toast } from "sonner"
const CATALOG_LABELS: Record<string, string> = {
  APP_HOSTING: "App Hosting",
  VPN: "VPN",
  WHATSAPP: "WhatsApp",
}

const PERIOD_ORDER: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 2,
  SEMI_ANNUAL: 3,
  ANNUAL: 4,
}

const PERIOD_SUFFIX: Record<string, string> = {
  MONTHLY: "mo",
  QUARTERLY: "quarter",
  SEMI_ANNUAL: "6-mo",
  ANNUAL: "yr",
}
export default function CatalogProductsListPage() {
  const router = useRouter()
  const { catalogCode: rawCatalogCode } = useParams<{ catalogCode: string }>()
  const catalogCode = (rawCatalogCode || "").toUpperCase()
  const [products, setProducts] = useState<CatalogPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Action dialog states
  const [deleteProductTarget, setDeleteProductTarget] =
    useState<CatalogPlan | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [referencedArchiveTarget, setReferencedArchiveTarget] =
    useState<CatalogPlan | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)

  const [duplicateTarget, setDuplicateTarget] = useState<CatalogPlan | null>(
    null
  )
  const [duplicateCode, setDuplicateCode] = useState("")
  const [duplicateName, setDuplicateName] = useState("")
  const [isDuplicating, setIsDuplicating] = useState(false)

  const loadProducts = useCallback(async () => {
    if (!catalogCode) return
    setLoading(true)
    setError(null)
    try {
      const response = await getAdminCatalogProductsList(catalogCode)
      setProducts(response.products || [])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load products"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [catalogCode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadProducts])

  const handleDelete = async () => {
    if (!deleteProductTarget) return
    setIsDeleting(true)
    try {
      await deleteAdminCatalogProduct(catalogCode, deleteProductTarget.code)
      toast.success(
        `Product "${deleteProductTarget.name || deleteProductTarget.code}" deleted.`
      )
      setDeleteProductTarget(null)
      await loadProducts()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete product"
      // If product is referenced by subscriptions, offer to archive/disable instead
      if (
        message.toLowerCase().includes("referenced") ||
        message.toLowerCase().includes("subscription")
      ) {
        const target = deleteProductTarget
        setDeleteProductTarget(null)
        setReferencedArchiveTarget(target)
      } else {
        toast.error(message)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const handleArchive = async () => {
    if (!referencedArchiveTarget) return
    setIsArchiving(true)
    try {
      const detail = await getAdminCatalogProductDetail(
        catalogCode,
        referencedArchiveTarget.code
      )
      const p = detail.product
      await upsertAdminCatalogProduct(catalogCode, p.code, {
        name: p.name,
        resources: p.resources,
        billingStrategy: p.billingStrategy,
        stockControl: p.stockControl,
        stockCount: p.stockCount,
        allowBackorder: p.allowBackorder,
        isActive: false,
        prices: (p.offers ?? []).map((offer) => ({
          billingPeriod: offer.billingPeriod,
          chargeUnit: offer.chargeUnit,
          periodPrice: Number.parseFloat(offer.periodPrice) || 0,
          currency: offer.currency,
          effectiveFrom: offer.effectiveFrom,
          effectiveTo: offer.effectiveTo,
          isActive: false,
        })),
      })
      toast.success(
        `Product "${p.name || p.code}" has been archived (disabled).`
      )
      setReferencedArchiveTarget(null)
      await loadProducts()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to archive product"
      toast.error(message)
    } finally {
      setIsArchiving(false)
    }
  }

  const openDuplicateDialog = (product: CatalogPlan) => {
    setDuplicateTarget(product)
    setDuplicateCode(`${product.code}_COPY`.toUpperCase())
    setDuplicateName(`${product.name || product.code} (Copy)`)
  }

  const handleDuplicate = async () => {
    if (!duplicateTarget) return
    const code = duplicateCode.trim().toUpperCase()
    const name = duplicateName.trim()
    if (!code || !name) {
      toast.error("Product code and name are required.")
      return
    }
    if (products.some((p) => p.code.toUpperCase() === code)) {
      toast.error(`Product code "${code}" already exists in this catalog.`)
      return
    }
    setIsDuplicating(true)
    try {
      const detail = await getAdminCatalogProductDetail(
        catalogCode,
        duplicateTarget.code
      )
      const p = detail.product
      await upsertAdminCatalogProduct(catalogCode, code, {
        name,
        code,
        resources: p.resources,
        billingStrategy: p.billingStrategy,
        stockControl: p.stockControl,
        stockCount: p.stockCount,
        allowBackorder: p.allowBackorder,
        isActive: true,
        prices: (p.offers ?? []).map((offer) => ({
          billingPeriod: offer.billingPeriod,
          chargeUnit: offer.chargeUnit,
          periodPrice: Number.parseFloat(offer.periodPrice) || 0,
          currency: offer.currency,
          effectiveFrom: new Date().toISOString().slice(0, 10),
          effectiveTo: offer.effectiveTo,
          isActive: true,
        })),
      })
      toast.success(`Product "${name}" (${code}) duplicated successfully.`)
      setDuplicateTarget(null)
      await loadProducts()
      router.push(
        `/portal/billing/catalog/${catalogCode.toLowerCase()}/products/${code.toLowerCase()}`
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to duplicate product"
      toast.error(message)
    } finally {
      setIsDuplicating(false)
    }
  }

  const catalogTitle = CATALOG_LABELS[catalogCode] || catalogCode
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/portal/billing/catalog">
            <Button variant="ghost" size="icon" aria-label="Back to catalog">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{catalogTitle} Products</h1>
            <p className="text-sm text-muted-foreground">
              Manage product tiers, inventory, specs, and pricing under{" "}
              {catalogTitle}.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CatalogExportImport
            catalogCode={catalogCode}
            catalogTitle={catalogTitle}
            onImportSuccess={() => void loadProducts()}
          />
          <Link
            href={`/portal/billing/catalog/${catalogCode.toLowerCase()}/products/new`}
          >
            <Button size="sm">
              <PlusIcon className="mr-2 h-4 w-4" />
              New Product
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
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <PackageIcon className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium">
                No products found in this catalog.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add plans to create products for this category.
              </p>
            </div>
            <Link
              href={`/portal/billing/catalog/${catalogCode.toLowerCase()}/products/new`}
            >
              <Button size="sm">Add First Product</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const sortedOffers = [...(product.offers ?? [])].sort((a, b) => {
              const orderA = PERIOD_ORDER[a.billingPeriod] ?? 99
              const orderB = PERIOD_ORDER[b.billingPeriod] ?? 99
              if (orderA !== orderB) return orderA - orderB
              return (
                Number.parseFloat(a.periodPrice) -
                Number.parseFloat(b.periodPrice)
              )
            })
            const lowestOffer = sortedOffers[0]
            const suffix = lowestOffer
              ? (PERIOD_SUFFIX[lowestOffer.billingPeriod] ??
                lowestOffer.billingPeriod.toLowerCase())
              : ""
            return (
              <Card key={product.id} className="flex flex-col justify-between">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">
                      {product.name || product.code}
                    </CardTitle>
                    <Badge variant={product.isActive ? "default" : "secondary"}>
                      {product.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs">
                    Code: {product.code}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      {product.billingStrategy === "PRO_RATA"
                        ? "Pro-rata"
                        : "Fixed cycle"}
                    </Badge>
                    {product.stockControl === "TRACKED" ? (
                      <Badge
                        variant={
                          (product.stockCount ?? 0) > 0
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {(product.stockCount ?? 0) > 0
                          ? `${product.stockCount} in stock`
                          : "Out of stock"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unlimited stock</Badge>
                    )}
                  </div>

                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground">
                      Starting from
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {lowestOffer
                        ? `${formatBillingMoney(lowestOffer.periodPrice, lowestOffer.currency)} / ${suffix}`
                        : "Unpriced"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Link
                      href={`/portal/billing/catalog/${catalogCode.toLowerCase()}/products/${product.code.toLowerCase()}`}
                      className="flex-1"
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        <PencilSimpleIcon className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="px-2"
                          aria-label={`More options for ${product.name || product.code}`}
                        >
                          <DotsThreeVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => openDuplicateDialog(product)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteProductTarget(product)}
                        >
                          <TrashIcon className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Confirmation Before Delete */}
      <AlertDialog
        open={Boolean(deleteProductTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteProductTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deleteProductTarget?.name || deleteProductTarget?.code}
              </span>{" "}
              ({deleteProductTarget?.code})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Fallback to Archive when Product is Referenced by Subscriptions */}
      <AlertDialog
        open={Boolean(referencedArchiveTarget)}
        onOpenChange={(open) => {
          if (!open) setReferencedArchiveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArchiveBoxIcon className="h-5 w-5 text-amber-500" />
              Archive Instead of Delete
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>
                Product{" "}
                <span className="font-semibold text-foreground">
                  {referencedArchiveTarget?.name ||
                    referencedArchiveTarget?.code}
                </span>{" "}
                cannot be deleted because active or historical customer
                subscriptions reference it.
              </span>
              <span className="block">
                Would you like to archive and disable it from the public catalog
                instead? Existing subscribers won&apos;t be broken, but new
                orders will be prevented.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleArchive()
              }}
              disabled={isArchiving}
            >
              {isArchiving ? "Archiving..." : "Archive & Disable"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Prompt for Duplicate Product */}
      <Dialog
        open={Boolean(duplicateTarget)}
        onOpenChange={(open) => {
          if (!open) setDuplicateTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate Product</DialogTitle>
            <DialogDescription>
              Create a quick clone of{" "}
              <span className="font-semibold text-foreground">
                {duplicateTarget?.name || duplicateTarget?.code}
              </span>
              . Enter a unique product code and name for the new copy.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleDuplicate()
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label htmlFor="dup-code">New Product Code *</Label>
              <Input
                id="dup-code"
                value={duplicateCode}
                onChange={(e) => setDuplicateCode(e.target.value.toUpperCase())}
                placeholder="e.g. STARTER_V2"
                className="font-mono uppercase"
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Must be unique within the {catalogTitle} catalog.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dup-name">New Product Name *</Label>
              <Input
                id="dup-name"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder="e.g. Starter Plan (2026)"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDuplicateTarget(null)}
                disabled={isDuplicating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isDuplicating}>
                {isDuplicating ? "Duplicating..." : "Create Copy"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}

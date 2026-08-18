"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeftIcon,
  PackageIcon,
  PlusIcon,
} from "@/components/ui/phosphor-icons"
import { getAdminCatalogProductsList } from "@/lib/billing-client"
import type { CatalogPlan } from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"

const CATALOG_LABELS: Record<string, string> = {
  APP_HOSTING: "App Hosting",
  VPN: "VPN",
  WHATSAPP: "WhatsApp",
}

export default function CatalogProductsListPage() {
  const { catalogCode: rawCatalogCode } = useParams<{ catalogCode: string }>()
  const catalogCode = (rawCatalogCode || "").toUpperCase()
  const [products, setProducts] = useState<CatalogPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
            const minMonthlyOffer = product.offers.find(
              (o) => o.billingPeriod === "MONTHLY"
            )
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
                      {minMonthlyOffer
                        ? `${formatBillingMoney(minMonthlyOffer.periodPrice, minMonthlyOffer.currency)} / mo`
                        : "Unpriced"}
                    </p>
                  </div>

                  <div className="pt-2">
                    <Link
                      href={`/portal/billing/catalog/${catalogCode.toLowerCase()}/products/${product.code.toLowerCase()}`}
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        Edit Product
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}

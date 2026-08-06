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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  MagnifyingGlassIcon,
  PackageIcon,
} from "@/components/ui/phosphor-icons"
import { getCatalog } from "@/lib/billing-client"
import type { CatalogProduct, CatalogListResponse } from "@/lib/billing-client"
import { formatBillingMoney } from "@/modules/billing/format-money"

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

  const loadCatalog = useCallback(async (query: string) => {
    setLoading(true)
    setError(null)
    try {
      const response: CatalogListResponse = await getCatalog()
      let filtered = response.products
      if (query.trim()) {
        const q = query.toLowerCase()
        filtered = filtered.filter(
          (p) =>
            p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
        )
      }
      setProducts(filtered)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load catalog"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCatalog(search)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCatalog, search])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value.trim()) {
      params.set("q", e.target.value)
    } else {
      params.delete("q")
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const getProductStatus = (
    product: CatalogProduct
  ): "draft" | "published" | "archived" => {
    // A product is published if it has plans with active offers
    const hasActivePlans = product.plans.length > 0
    return hasActivePlans ? "published" : "draft"
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
              <Link
                key={product.code}
                href={`/portal/billing/catalog/${product.code.toLowerCase()}`}
              >
                <Card className="group transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">
                        {PRODUCT_LABELS[product.code] ?? product.code}
                      </CardTitle>
                      <Badge
                        variant="secondary"
                        className={STATUS_COLORS[status] ?? ""}
                      >
                        {status}
                      </Badge>
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
            )
          })}
        </div>
      )}
    </main>
  )
}

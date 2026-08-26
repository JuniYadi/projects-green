"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getCatalog } from "@/lib/billing-client"
import type { CatalogListResponse, CatalogProduct } from "@/lib/billing-client"
import { CatalogProductCard } from "@/components/billing/catalog/product-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function ServicesPage() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

  const [data, setData] = useState<CatalogListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getCatalog()
        setData(result)
      } catch {
        setError(messages.console.billing.services.errorDescription)
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [messages.console.billing.services.errorDescription])

  const filteredProducts = useMemo<CatalogProduct[]>(() => {
    if (!data?.products) return []
    if (!search.trim()) return data.products

    const q = search.toLowerCase()
    return data.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
    )
  }, [data, search])

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <header className="space-y-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </header>
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {messages.console.billing.services.heading}
        </h1>
        <p className="text-sm text-muted-foreground">
          {messages.console.billing.services.description}
        </p>
        {data && (
          <p className="text-xs text-muted-foreground">{data.currency}</p>
        )}
      </header>

      <div className="flex items-center gap-3">
        <Input
          type="search"
          placeholder={messages.console.billing.services.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onInput={(e) => setSearch(e.currentTarget.value)}
          aria-label={messages.console.billing.services.searchPlaceholder}
        />
        {search && (
          <span className="text-sm text-muted-foreground">
            {messages.console.billing.services.resultsCount.replace(
              "{count}",
              String(filteredProducts.length)
            )}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              setError(null)
              setIsLoading(true)
              void getCatalog()
                .then((result) => {
                  setData(result)
                  setError(null)
                })
                .catch(() => {
                  setError(messages.console.billing.services.errorDescription)
                })
                .finally(() => setIsLoading(false))
            }}
          >
            {messages.console.billing.services.retryButton}
          </Button>
        </div>
      )}

      {!error && filteredProducts.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="text-sm font-medium">
              {messages.console.billing.services.emptyTitle}
            </p>
            <p className="mt-1 text-xs">
              {messages.console.billing.services.emptyDescription}
            </p>
          </CardContent>
        </Card>
      )}

      {!error && filteredProducts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <CatalogProductCard key={product.code} product={product} />
          ))}
        </div>
      )}
    </main>
  )
}

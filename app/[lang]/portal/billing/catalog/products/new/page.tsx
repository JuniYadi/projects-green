"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { PRODUCT_OPTIONS } from "@/components/billing/admin/catalog/catalog-editor.types"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export default function ProductChoicePage() {
  const { lang } = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(lang)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">Choose a product</h1>
        <p className="text-sm text-muted-foreground">
          Select the service package to configure.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        {PRODUCT_OPTIONS.map((product) => (
          <Link
            key={product.value}
            href={`/${locale}/portal/billing/catalog/${product.value}?new=true`}
          >
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>{product.label}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  )
}

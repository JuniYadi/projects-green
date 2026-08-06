"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import type { ProductBasicsForm } from "@/components/billing/admin/catalog/catalog-editor.types"

export function CatalogProductDetailsTab({
  basics,
  onChange,
}: Readonly<{
  basics: ProductBasicsForm
  onChange: (next: Partial<ProductBasicsForm>) => void
}>) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>
            Internal identifiers and product metadata.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="meta-product-code">Internal code</Label>
            <Input
              id="meta-product-code"
              value={basics.code}
              onChange={(e) =>
                onChange({ code: e.target.value as ProductBasicsForm["code"] })
              }
              readOnly
              className="bg-muted font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="meta-product-name">Display name</Label>
            <Input
              id="meta-product-name"
              value={basics.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing metadata</CardTitle>
          <CardDescription>
            Default currency and billing configuration for this product.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="meta-currency">Default currency</Label>
              <Input
                id="meta-currency"
                value={basics.currency ?? "IDR"}
                onChange={(e) =>
                  onChange({ currency: e.target.value.toUpperCase() })
                }
                maxLength={3}
              />
            </div>
            <div className="flex items-center gap-3 pt-8">
              <Switch
                id="meta-active"
                checked={basics.isActive}
                onCheckedChange={(checked) => onChange({ isActive: checked })}
              />
              <Label htmlFor="meta-active" className="mb-0">
                Product is active
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Long description</CardTitle>
          <CardDescription>
            Full product description shown on catalog and checkout pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={basics.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Detailed product description..."
            rows={6}
          />
        </CardContent>
      </Card>
    </div>
  )
}

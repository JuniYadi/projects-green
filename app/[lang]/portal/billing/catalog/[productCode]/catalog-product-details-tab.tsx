"use client"
import { useParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/field"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
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
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalBillingCatalogProductDetailsTab

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.metadataTitle}</CardTitle>
          <CardDescription>{t.metadataDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="meta-product-code">{t.internalCodeLabel}</Label>
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
            <Label htmlFor="meta-product-name">{t.displayNameLabel}</Label>
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
          <CardTitle>{t.pricingMetadataTitle}</CardTitle>
          <CardDescription>{t.pricingMetadataDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="meta-currency">{t.defaultCurrencyLabel}</Label>
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
                {t.productIsActiveLabel}
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.longDescriptionTitle}</CardTitle>
          <CardDescription>{t.longDescriptionDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={basics.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={t.descriptionPlaceholder}
            rows={6}
          />
        </CardContent>
      </Card>
    </div>
  )
}

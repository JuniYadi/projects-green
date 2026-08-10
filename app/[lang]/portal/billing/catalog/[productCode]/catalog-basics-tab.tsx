"use client"

import type { ProductBasicsForm } from "@/components/billing/admin/catalog/catalog-editor.types"
import {
  PRODUCT_OPTIONS,
  SUPPORTED_CURRENCIES,
} from "@/components/billing/admin/catalog/catalog-editor.types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

export function CatalogBasicsTab({
  basics,
  onChange,
}: Readonly<{
  basics: ProductBasicsForm
  onChange: (next: Partial<ProductBasicsForm>) => void
}>) {
  return (
    <form
      className="grid gap-6 md:grid-cols-2"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="space-y-2">
        <Label htmlFor="product-code">Product code</Label>
        <Select
          value={basics.code}
          onValueChange={(value) =>
            onChange({ code: value as ProductBasicsForm["code"] })
          }
        >
          <SelectTrigger id="product-code">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-name">Product name *</Label>
        <Input
          id="product-name"
          value={basics.name}
          onChange={(e) => onChange({ name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="product-description">Description</Label>
        <Textarea
          id="product-description"
          value={basics.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Describe this product and what it includes..."
          rows={4}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="product-is-active"
          checked={basics.isActive}
          onCheckedChange={(checked) => onChange({ isActive: checked })}
        />
        <Label htmlFor="product-is-active" className="mb-0">
          Active
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-currency">Default currency</Label>
        <Select
          value={basics.currency ?? "IDR"}
          onValueChange={(value) => onChange({ currency: value })}
        >
          <SelectTrigger id="product-currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>Enabled currencies</Label>
        <p className="text-xs text-muted-foreground">
          Each enabled currency creates a required price row for every enabled
          term.
        </p>
        <div className="flex flex-wrap gap-4">
          {SUPPORTED_CURRENCIES.map((currency) => {
            const enabled = basics.enabledCurrencies.includes(currency)
            return (
              <div key={currency} className="flex items-center gap-2">
                <Switch
                  id={`enabled-currency-${currency}`}
                  checked={enabled}
                  onCheckedChange={(checked) =>
                    onChange({
                      enabledCurrencies: checked
                        ? [...new Set([...basics.enabledCurrencies, currency])]
                        : basics.enabledCurrencies.filter(
                            (item) => item !== currency
                          ),
                    })
                  }
                />
                <Label htmlFor={`enabled-currency-${currency}`}>
                  {currency}
                </Label>
              </div>
            )
          })}
        </div>
      </div>
    </form>
  )
}

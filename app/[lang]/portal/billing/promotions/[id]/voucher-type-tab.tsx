"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import type { VoucherDetailDTO, VoucherKind } from "@/lib/billing-client"

const KIND_OPTIONS: { value: VoucherKind; label: string; desc: string }[] = [
  {
    value: "BALANCE_CREDIT",
    label: "Balance Credit",
    desc: "Adds a fixed currency amount to the customer's billing balance.",
  },
  {
    value: "PRODUCT_PROMOTION",
    label: "Product Promotion",
    desc: "Applies a percentage or fixed-amount discount to eligible subscriptions or orders.",
  },
]

export function VoucherTypeTab({
  voucher,
  onUpdate,
}: {
  voucher: VoucherDetailDTO
  onUpdate: (updates: Record<string, unknown>) => void
}) {
  const isProductPromo = voucher.kind === "PRODUCT_PROMOTION"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voucher Type</CardTitle>
        <CardDescription>
          Choose how this voucher applies its discount.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Kind</Label>
          {KIND_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-muted/50"
            >
              <input
                type="radio"
                name="kind"
                value={opt.value}
                checked={voucher.kind === opt.value}
                onChange={() => onUpdate({ kind: opt.value })}
                className="mt-0.5 h-4 w-4"
              />
              <div>
                <p className="font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Balance credit amount — shown for both kinds but semantically relevant for credits */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="voucher-amount">
              {isProductPromo ? "Fallback Amount (currency)" : "Credit Amount"}
            </Label>
            <Input
              id="voucher-amount"
              type="number"
              min="0"
              step="0.01"
              value={voucher.amount}
              onChange={(e) => onUpdate({ amount: e.target.value })}
              placeholder="e.g. 50000"
            />
            <p className="text-xs text-muted-foreground">
              {isProductPromo
                ? "Used as fallback credit value when no discount applies."
                : "The fixed credit amount added to the billing balance."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voucher-currency">Currency</Label>
            <Select
              value={voucher.currency ?? "IDR"}
              onValueChange={(val) => onUpdate({ currency: val })}
            >
              <SelectTrigger id="voucher-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IDR">IDR - Indonesian Rupiah</SelectItem>
                <SelectItem value="USD">USD - US Dollar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Product promotion discount fields */}
        {isProductPromo && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="voucher-discount-type">Discount Type</Label>
                <Select
                  value={voucher.discountType ?? ""}
                  onValueChange={(val) =>
                    onUpdate({
                      discountType: val
                        ? (val as "PERCENTAGE" | "FIXED")
                        : null,
                    })
                  }
                >
                  <SelectTrigger id="voucher-discount-type">
                    <SelectValue placeholder="Select discount type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                    <SelectItem value="FIXED">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="voucher-discount-value">Discount Value</Label>
                <Input
                  id="voucher-discount-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={voucher.discountValue ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      discountValue: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  placeholder={
                    voucher.discountType === "PERCENTAGE"
                      ? "e.g. 25"
                      : "e.g. 50000"
                  }
                  disabled={!voucher.discountType}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="voucher-discount-currency">
                  Discount Currency
                </Label>
                <Select
                  value={voucher.discountCurrency ?? ""}
                  onValueChange={(val) =>
                    onUpdate({ discountCurrency: val || null })
                  }
                >
                  <SelectTrigger id="voucher-discount-currency">
                    <SelectValue placeholder="Same as voucher currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Same as voucher currency</SelectItem>
                    <SelectItem value="IDR">IDR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="voucher-currency-policy">Currency Policy</Label>
                <Select
                  value={voucher.currencyPolicy ?? "MATCH_CURRENCY_ONLY"}
                  onValueChange={(val) =>
                    onUpdate({
                      currencyPolicy: val as VoucherDetailDTO["currencyPolicy"],
                    })
                  }
                >
                  <SelectTrigger id="voucher-currency-policy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MATCH_CURRENCY_ONLY">
                      Match currency only
                    </SelectItem>
                    <SelectItem value="CONVERT_AT_CHECKOUT">
                      Convert at checkout
                    </SelectItem>
                    <SelectItem value="CONVERT_AT_REDEMPTION">
                      Convert at redemption
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {voucher.discountType === "PERCENTAGE"
                    ? "Percentage discounts apply regardless of currency."
                    : "Fixed discounts use the configured currency policy."}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label
              htmlFor="voucher-first-checkout-only"
              className="font-medium"
            >
              First checkout only
            </Label>
            <p className="text-xs text-muted-foreground">
              Allow this voucher to be claimed only on the first checkout.
            </p>
          </div>
          <Checkbox
            id="voucher-first-checkout-only"
            checked={voucher.firstCheckoutOnly ?? false}
            onCheckedChange={(checked) =>
              onUpdate({ firstCheckoutOnly: Boolean(checked) })
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label htmlFor="voucher-allow-upgrade" className="font-medium">
              Allow upgrades
            </Label>
            <p className="text-xs text-muted-foreground">
              Permit customers to apply this voucher when upgrading plans.
            </p>
          </div>
          <Checkbox
            id="voucher-allow-upgrade"
            checked={voucher.allowUpgrade ?? false}
            onCheckedChange={(checked) =>
              onUpdate({ allowUpgrade: Boolean(checked) })
            }
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label htmlFor="voucher-stackable" className="font-medium">
              Stackable
            </Label>
            <p className="text-xs text-muted-foreground">
              Allow this voucher to be combined with other promotions.
            </p>
          </div>
          <Checkbox
            id="voucher-stackable"
            checked={voucher.stackable ?? false}
            onCheckedChange={(checked) =>
              onUpdate({ stackable: Boolean(checked) })
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}

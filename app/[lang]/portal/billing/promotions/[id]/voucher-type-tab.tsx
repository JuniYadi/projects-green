"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
    desc: "Applies a discount to selected products, plans, and billing terms.",
  },
]

export function VoucherTypeTab({
  voucher,
  onUpdate,
  fieldErrors = {},
}: {
  voucher: VoucherDetailDTO
  onUpdate: (updates: Record<string, unknown>) => void
  fieldErrors?: Record<string, string[]>
}) {
  const isProductPromo = voucher.kind === "PRODUCT_PROMOTION"
  const kindIsEditable = voucher.id === "new"

  const renderErrors = (field: string) => {
    const errors = fieldErrors[field]
    if (!errors?.length) return null

    return (
      <ul className="flex flex-col gap-1 text-sm text-destructive" role="alert">
        {errors.map((error, index) => (
          <li key={`${field}-${index}`}>{error}</li>
        ))}
      </ul>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Promotion Type</CardTitle>
        <CardDescription>
          Choose whether this voucher credits a balance or discounts a selected
          product purchase.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Label>Kind</Label>
          <ToggleGroup
            type="single"
            value={voucher.kind}
            onValueChange={(value) => {
              if (value) onUpdate({ kind: value as VoucherKind })
            }}
            disabled={!kindIsEditable}
            aria-label="Voucher kind"
            className="grid w-full gap-3 sm:grid-cols-2"
          >
            {KIND_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className="h-auto min-h-20 justify-start rounded-lg border border-border px-4 py-3 text-left whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-muted"
              >
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.desc}
                  </span>
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {!kindIsEditable && (
            <p className="text-xs text-muted-foreground">
              A voucher&apos;s kind cannot be changed after it is created.
            </p>
          )}
          {renderErrors("kind")}
        </div>

        {!isProductPromo && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="voucher-amount">Credit Amount</Label>
              <Input
                id="voucher-amount"
                type="number"
                min="0"
                step="0.01"
                value={voucher.amount}
                onChange={(event) =>
                  onUpdate({ amount: Number(event.target.value) })
                }
                placeholder="e.g. 50000"
                aria-invalid={Boolean(fieldErrors.amount?.length)}
              />
              <p className="text-xs text-muted-foreground">
                The fixed credit amount added to the billing balance.
              </p>
              {renderErrors("amount")}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="voucher-currency">Currency</Label>
              <Select
                value={voucher.currency ?? "IDR"}
                onValueChange={(value) => onUpdate({ currency: value })}
              >
                <SelectTrigger id="voucher-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDR">IDR - Indonesian Rupiah</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                </SelectContent>
              </Select>
              {renderErrors("currency")}
            </div>
          </div>
        )}

        {isProductPromo && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="voucher-discount-type">Discount Type</Label>
                <Select
                  value={voucher.discountType ?? ""}
                  onValueChange={(value) =>
                    onUpdate({
                      discountType: value
                        ? (value as "PERCENTAGE" | "FIXED")
                        : null,
                    })
                  }
                >
                  <SelectTrigger
                    id="voucher-discount-type"
                    aria-invalid={Boolean(fieldErrors.discountType?.length)}
                  >
                    <SelectValue placeholder="Select discount type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                    <SelectItem value="FIXED">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
                {renderErrors("discountType")}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="voucher-discount-value">Discount Value</Label>
                <Input
                  id="voucher-discount-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={voucher.discountValue ?? ""}
                  onChange={(event) =>
                    onUpdate({
                      discountValue: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                  placeholder={
                    voucher.discountType === "PERCENTAGE"
                      ? "e.g. 25"
                      : "e.g. 50000"
                  }
                  disabled={!voucher.discountType}
                  aria-invalid={Boolean(fieldErrors.discountValue?.length)}
                />
                {renderErrors("discountValue")}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="voucher-discount-currency">
                  Discount Currency
                </Label>
                <Select
                  value={voucher.discountCurrency ?? "SAME"}
                  onValueChange={(value) =>
                    onUpdate({
                      discountCurrency: value === "SAME" ? null : value,
                    })
                  }
                >
                  <SelectTrigger id="voucher-discount-currency">
                    <SelectValue placeholder="Same as voucher currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAME">
                      Same as voucher currency
                    </SelectItem>
                    <SelectItem value="IDR">IDR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
                {renderErrors("discountCurrency")}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="voucher-currency-policy">Currency Policy</Label>
                <Select
                  value={voucher.currencyPolicy ?? "MATCH_CURRENCY_ONLY"}
                  onValueChange={(value) =>
                    onUpdate({
                      currencyPolicy:
                        value as VoucherDetailDTO["currencyPolicy"],
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
                  Percentage discounts apply regardless of currency. Fixed
                  discounts use the configured currency policy.
                </p>
                {renderErrors("currencyPolicy")}
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

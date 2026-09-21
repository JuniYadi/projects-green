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
import { useParams } from "next/navigation"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
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
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang || "en"
  const messages =
    getMessagesForMaybeLocale(lang).console.adminBillingPromotions
      .voucherTypeTab
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
        <CardTitle>{messages.title}</CardTitle>
        <CardDescription>{messages.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Label>{messages.kind}</Label>
          <ToggleGroup
            type="single"
            value={voucher.kind}
            onValueChange={(value) => {
              if (value) onUpdate({ kind: value as VoucherKind })
            }}
            disabled={!kindIsEditable}
            aria-label={messages.kindAria}
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
              {messages.kindImmutableNotice}
            </p>
          )}
          {renderErrors("kind")}
        </div>

        {!isProductPromo && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="voucher-amount">{messages.creditAmount}</Label>
              <Input
                id="voucher-amount"
                type="number"
                min="0"
                step="0.01"
                value={voucher.amount}
                onWheel={(event) => event.currentTarget.blur()}
                onChange={(event) =>
                  onUpdate({ amount: Number(event.target.value) })
                }
                placeholder="e.g. 50000"
                aria-invalid={Boolean(fieldErrors.amount?.length)}
              />
              <p className="text-xs text-muted-foreground">
                {messages.creditAmountDesc}
              </p>
              {renderErrors("amount")}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="voucher-currency">{messages.currency}</Label>
              <Select
                value={voucher.currency ?? "IDR"}
                onValueChange={(value) => onUpdate({ currency: value })}
              >
                <SelectTrigger id="voucher-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDR">{messages.currencyIdr}</SelectItem>
                  <SelectItem value="USD">{messages.currencyUsd}</SelectItem>
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
                <Label htmlFor="voucher-discount-type">
                  {messages.discountType}
                </Label>
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
                    <SelectValue
                      placeholder={messages.discountTypePlaceholder}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">
                      {messages.percentage}
                    </SelectItem>
                    <SelectItem value="FIXED">
                      {messages.fixedAmount}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {renderErrors("discountType")}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="voucher-discount-value">
                  {messages.discountValue}
                </Label>
                <Input
                  id="voucher-discount-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={voucher.discountValue ?? ""}
                  onWheel={(event) => event.currentTarget.blur()}
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
                  {messages.discountCurrency}
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
                    <SelectValue placeholder={messages.sameAsVoucher} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAME">
                      {messages.sameAsVoucher}
                    </SelectItem>
                    <SelectItem value="IDR">IDR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
                {renderErrors("discountCurrency")}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="voucher-currency-policy">
                  {messages.currencyPolicy}
                </Label>
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
                      {messages.matchCurrency}
                    </SelectItem>
                    <SelectItem value="CONVERT_AT_CHECKOUT">
                      {messages.convertCheckout}
                    </SelectItem>
                    <SelectItem value="CONVERT_AT_REDEMPTION">
                      {messages.convertRedemption}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {messages.discountPolicyDesc}
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
              {messages.firstCheckoutOnly}
            </Label>
            <p className="text-xs text-muted-foreground">
              {messages.firstCheckoutOnlyDesc}
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
              {messages.allowUpgrades}
            </Label>
            <p className="text-xs text-muted-foreground">
              {messages.allowUpgradesDesc}
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
              {messages.stackable}
            </Label>
            <p className="text-xs text-muted-foreground">
              {messages.stackableDesc}
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

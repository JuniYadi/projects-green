"use client"

import {
  GlobeIcon,
  RocketLaunchIcon,
  WhatsappLogoIcon,
  DotsThreeIcon,
  HardDrivesIcon,
  DeviceMobileIcon,
  PackageIcon,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import type { InvoiceLineItem } from "@/lib/billing-client"
import { formatInvoiceCurrency } from "@/modules/invoices/invoices.helpers"

// ─── Helpers ───────────────────────────────────────────────────────────

type Category = "vpn" | "app-hosting" | "whatsapp" | "other"

const CATEGORY_META: Record<
  Category,
  {
    label: string
    icon: React.ReactNode
    variant: "default" | "secondary" | "outline"
  }
> = {
  vpn: {
    label: "VPN",
    icon: <GlobeIcon className="h-3.5 w-3.5" />,
    variant: "secondary",
  },
  "app-hosting": {
    label: "App Hosting",
    icon: <RocketLaunchIcon className="h-3.5 w-3.5" />,
    variant: "secondary",
  },
  whatsapp: {
    label: "WhatsApp API",
    icon: <WhatsappLogoIcon className="h-3.5 w-3.5" />,
    variant: "secondary",
  },
  other: {
    label: "Other",
    icon: <DotsThreeIcon className="h-3.5 w-3.5" />,
    variant: "outline",
  },
}

const toMoneyNumber = (amount: string): number => {
  const value = Number.parseFloat(amount)
  return Number.isFinite(value) ? value : 0
}

function formatLineAmount(amountIdr: string, currency: string): string {
  return formatInvoiceCurrency(toMoneyNumber(amountIdr), currency)
}

function getCategory(item: InvoiceLineItem): Category {
  const cat = item.category ?? "other"
  if (cat === "vpn" || cat === "app-hosting" || cat === "whatsapp") return cat
  return "other"
}

function renderDetailBadges(line: InvoiceLineItem) {
  const meta = line.metadata ?? {}
  const badges: React.ReactNode[] = []

  if (meta.servers && Array.isArray(meta.servers)) {
    badges.push(
      <span
        key="servers"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      >
        <HardDrivesIcon className="h-3.5 w-3.5" />
        {(meta.servers as string[]).join(", ")}
      </span>
    )
  }
  if (meta.appName) {
    badges.push(
      <span
        key="app"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      >
        <PackageIcon className="h-3.5 w-3.5" />
        {String(meta.appName)}
      </span>
    )
  }
  if (meta.deviceId) {
    badges.push(
      <span
        key="device"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      >
        <DeviceMobileIcon className="h-3.5 w-3.5" />
        {String(meta.deviceId)}
      </span>
    )
  }

  if (badges.length === 0) return null

  return <div className="mt-1 flex flex-wrap items-center gap-2">{badges}</div>
}

// ─── Table Display ─────────────────────────────────────────────────────

type InvoiceGroupedLinesProps = {
  lines: InvoiceLineItem[]
  currency: string
  periodLabel?: string
}

export function InvoiceGroupedLines({
  lines,
  currency,
  periodLabel,
}: InvoiceGroupedLinesProps) {
  return (
    <div className="space-y-2">
      {periodLabel && (
        <p className="text-xs text-muted-foreground">{periodLabel}</p>
      )}
      <div className="overflow-hidden rounded-lg border border-border/70">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/70 bg-muted/40 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-card">
              {lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    No line items found.
                  </td>
                </tr>
              ) : (
                lines.map((item, idx) => {
                  const category = getCategory(item)
                  const meta = CATEGORY_META[category]
                  return (
                    <tr
                      key={idx}
                      className="transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-3.5 align-top">
                        <p className="font-medium text-foreground">
                          {item.description}
                        </p>
                        {renderDetailBadges(item)}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <Badge
                          variant={meta.variant}
                          className="inline-flex items-center gap-1 font-normal"
                        >
                          {meta.icon}
                          <span>{meta.label}</span>
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right align-top font-mono text-sm text-muted-foreground">
                        {Number.parseFloat(item.quantity || "1").toLocaleString(
                          "id-ID"
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right align-top font-medium text-foreground">
                        {formatLineAmount(
                          item.amountIdr,
                          item.currency || currency
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Flat (TOP_UP) Display ─────────────────────────────────────────────

export function InvoiceFlatLine({
  lines,
  currency,
}: {
  lines: InvoiceLineItem[]
  currency: string
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/40 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-card">
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  No line items found.
                </td>
              </tr>
            ) : (
              lines.map((line, idx) => (
                <tr key={idx} className="transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3.5 text-sm font-medium text-foreground">
                    {line.description}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-sm text-muted-foreground">
                    {Number.parseFloat(line.quantity || "1").toLocaleString(
                      "id-ID"
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-foreground">
                    {formatLineAmount(
                      line.amountIdr,
                      line.currency || currency
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

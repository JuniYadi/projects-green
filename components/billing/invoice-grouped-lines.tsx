"use client"

import { useState } from "react"
import {
  GlobeIcon,
  RocketLaunchIcon,
  WhatsappLogoIcon,
  DotsThreeIcon,
  CaretDownIcon,
  CaretRightIcon,
} from "@phosphor-icons/react"
import type { InvoiceLineItem } from "@/lib/billing-client"

// ─── Helpers ───────────────────────────────────────────────────────────

type Category = "vpn" | "app-hosting" | "whatsapp" | "other"
type Grouped = Record<
  Category,
  { label: string; icon: React.ReactNode; items: InvoiceLineItem[] }
>

const CATEGORY_META: Record<
  Category,
  { label: string; icon: React.ReactNode }
> = {
  vpn: { label: "VPN", icon: <GlobeIcon className="h-4 w-4" /> },
  "app-hosting": {
    label: "App Hosting",
    icon: <RocketLaunchIcon className="h-4 w-4" />,
  },
  whatsapp: {
    label: "WhatsApp API",
    icon: <WhatsappLogoIcon className="h-4 w-4" />,
  },
  other: { label: "Other", icon: <DotsThreeIcon className="h-4 w-4" /> },
}

function formatCurrency(amount: string): string {
  const num = Number.parseFloat(amount)
  if (Number.isNaN(num)) return amount
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(num)
}

function getCategory(item: InvoiceLineItem): Category {
  const cat = item.category ?? "other"
  if (cat === "vpn" || cat === "app-hosting" || cat === "whatsapp") return cat
  return "other"
}

function extractDetail(line: InvoiceLineItem): string | null {
  const meta = line.metadata ?? {}
  if (meta.servers && Array.isArray(meta.servers)) {
    return `🖥️ ${(meta.servers as string[]).join(", ")}`
  }
  if (meta.appName) return `📦 ${meta.appName}`
  if (meta.deviceId) return `📱 ${meta.deviceId}`
  return null
}

function groupLines(lines: InvoiceLineItem[]): Grouped {
  const grouped: Partial<Grouped> = {}
  for (const line of lines) {
    const cat = getCategory(line)
    if (!grouped[cat]) {
      grouped[cat] = { ...CATEGORY_META[cat], items: [] }
    }
    grouped[cat]!.items.push(line)
  }
  return grouped as Grouped
}

// ─── Group Section ─────────────────────────────────────────────────────

function GroupSection({
  label,
  icon,
  items,
  defaultOpen,
}: {
  label: string
  icon: React.ReactNode
  items: InvoiceLineItem[]
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const subtotal = items.reduce(
    (sum, item) => sum + Number.parseFloat(item.amountIdr),
    0
  )

  return (
    <div className="rounded-lg border">
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <CaretDownIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <CaretRightIcon className="h-4 w-4 text-muted-foreground" />
          )}
          {icon}
          <span>{label}</span>
          <span className="text-muted-foreground">({items.length})</span>
        </div>
        <span className="font-semibold">
          {formatCurrency(subtotal.toFixed(2))}
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                  Description
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                  Qty
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const detail = extractDetail(item)
                return (
                  <tr key={idx} className="border-b last:border-b-0">
                    <td className="px-4 py-2.5">
                      <p className="text-sm">{item.description}</p>
                      {detail && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {detail}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm">
                      {Number.parseFloat(item.quantity).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium">
                      {formatCurrency(item.amountIdr)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Root Component ────────────────────────────────────────────────────

type InvoiceGroupedLinesProps = {
  lines: InvoiceLineItem[]
  periodLabel?: string
}

export function InvoiceGroupedLines({
  lines,
  periodLabel,
}: InvoiceGroupedLinesProps) {
  const grouped = groupLines(lines)
  const categories = Object.entries(grouped) as [
    Category,
    { label: string; icon: React.ReactNode; items: InvoiceLineItem[] },
  ][]

  // Default: open VPN if present, otherwise first category
  const defaultOpen = categories.length > 0 ? categories[0][0] : null

  return (
    <div className="space-y-1">
      {periodLabel && (
        <p className="mb-3 text-sm text-muted-foreground">{periodLabel}</p>
      )}
      <div className="space-y-2">
        {categories.map(([cat, data]) => (
          <GroupSection
            key={cat}
            label={data.label}
            icon={data.icon}
            items={data.items}
            defaultOpen={cat === defaultOpen}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Flat (TOP_UP) Display ─────────────────────────────────────────────

export function InvoiceFlatLine({ lines }: { lines: InvoiceLineItem[] }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b bg-muted/50">
          <th className="px-4 py-3 text-left text-sm font-medium">
            Description
          </th>
          <th className="px-4 py-3 text-right text-sm font-medium">Qty</th>
          <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, idx) => (
          <tr key={idx} className="border-b last:border-b-0">
            <td className="px-4 py-3 text-sm">{line.description}</td>
            <td className="px-4 py-3 text-right text-sm">
              {Number.parseFloat(line.quantity).toLocaleString("id-ID")}
            </td>
            <td className="px-4 py-3 text-right text-sm font-medium">
              {formatCurrency(line.amountIdr)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

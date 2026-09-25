"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import {
  Check,
  X,
  Sparkle,
  ShieldCheck,
  CreditCard,
} from "@phosphor-icons/react"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type PlanFeature = {
  label: string
  included: boolean
}

type PricingPlan = {
  id: string
  name: string
  badge: string | null
  monthlyPrice: number
  yearlyPrice: number
  description: string
  voucherNote: string
  cta: string
  ctaHref: string
  ctaStyle: "border" | "primary"
  highlight: boolean
  features: PlanFeature[]
}

export function PricingSection() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const isId = locale === "id"

  const [yearly, setYearly] = useState(false)

  const plans: PricingPlan[] = [
    {
      id: "starter",
      name: "Starter",
      badge: isId ? "Testing & Personal" : "Testing & Personal",
      monthlyPrice: 29000,
      yearlyPrice: 20000,
      description: isId
        ? "Ideal untuk bot AI personal, testing webhook, dan eksplorasi Hermes Agent."
        : "Ideal for personal AI bots, testing webhooks, and exploring Hermes Agent.",
      voucherNote: isId
        ? "Rp 0 di bln ke-1 dg Voucher!"
        : "Rp 0 first month w/ Voucher!",
      cta: isId ? "Mulai Starter" : "Start Starter",
      ctaHref: `/${locale}/login`,
      ctaStyle: "border",
      highlight: false,
      features: [
        {
          label: isId
            ? "0.5 vCPU Burstable (500m)"
            : "0.5 vCPU Burstable (500m)",
          included: true,
        },
        {
          label: isId ? "2 GB RAM (Ekstra Lega)" : "2 GB RAM (Generous)",
          included: true,
        },
        {
          label: isId
            ? "5 GB Enterprise NVMe (400k IOPS)"
            : "5 GB Enterprise NVMe (400k IOPS)",
          included: true,
        },
        {
          label: isId
            ? "Shared CPU Pool (Anti-Crash CFS)"
            : "Shared CPU Pool (Anti-Crash CFS)",
          included: true,
        },
        {
          label: isId ? "SSL Otomatis & Subdomain" : "Auto SSL & Subdomain",
          included: true,
        },
        {
          label: isId ? "Dukungan Komunitas" : "Community Support",
          included: true,
        },
        {
          label: isId ? "Dedicated CPU Pinning" : "Dedicated CPU Pinning",
          included: false,
        },
        {
          label: isId
            ? "Otomatis Backup Cloud R2"
            : "Automated Cloud R2 Backup",
          included: false,
        },
      ],
    },
    {
      id: "pro",
      name: "Pro",
      badge: isId ? "Paling Populer 🌟" : "Most Popular 🌟",
      monthlyPrice: 69000,
      yearlyPrice: 55000,
      description: isId
        ? "Rekomendasi terbaik untuk bot CS WhatsApp bisnis, toko online, dan automasi n8n."
        : "Best for business WhatsApp CS bots, online stores, and n8n workflows.",
      voucherNote: isId
        ? "Hanya Rp 19k dg Voucher!"
        : "Only Rp 19k w/ Voucher!",
      cta: isId ? "Pilih Paket Pro" : "Get Pro Plan",
      ctaHref: `/${locale}/login`,
      ctaStyle: "primary",
      highlight: true,
      features: [
        {
          label: isId
            ? "1.0 vCPU Burstable (1000m)"
            : "1.0 vCPU Burstable (1000m)",
          included: true,
        },
        {
          label: isId ? "4 GB RAM" : "4 GB RAM",
          included: true,
        },
        {
          label: isId
            ? "10 GB Enterprise NVMe Direct"
            : "10 GB Enterprise NVMe Direct",
          included: true,
        },
        {
          label: isId
            ? "Backup Harian Cloudflare R2"
            : "Daily Cloudflare R2 Backup",
          included: true,
        },
        {
          label: isId
            ? "WhatsApp Official Webhook Ready"
            : "Official WhatsApp Webhook Ready",
          included: true,
        },
        {
          label: isId ? "Prioritas Support" : "Priority Support",
          included: true,
        },
        {
          label: isId ? "Dedicated CPU Pinning" : "Dedicated CPU Pinning",
          included: false,
        },
        {
          label: isId ? "SLA Ketersediaan 99.9%" : "99.9% Availability SLA",
          included: true,
        },
      ],
    },
    {
      id: "business",
      name: "Business Dedicated",
      badge: isId ? "100% Dedicated CPU 🔥" : "100% Dedicated CPU 🔥",
      monthlyPrice: 189000,
      yearlyPrice: 149000,
      description: isId
        ? "CPU murni di-pinning secara eksklusif. Anti-throttling untuk beban kerja kritis."
        : "Exclusive CPU core pinning. Zero throttling for mission-critical production.",
      voucherNote: isId
        ? "Potongan Rp 50k dg Voucher!"
        : "Save Rp 50k w/ Voucher!",
      cta: isId ? "Pilih Dedicated" : "Get Dedicated",
      ctaHref: `/${locale}/login`,
      ctaStyle: "border",
      highlight: false,
      features: [
        {
          label: isId
            ? "2.0 vCPU DEDICATED (Guaranteed)"
            : "2.0 vCPU DEDICATED (Guaranteed)",
          included: true,
        },
        {
          label: isId ? "8 GB RAM Dedicated" : "8 GB Dedicated RAM",
          included: true,
        },
        {
          label: isId
            ? "25 GB Enterprise NVMe Direct"
            : "25 GB Enterprise NVMe Direct",
          included: true,
        },
        {
          label: isId
            ? "Anti-Throttling CPU Pinning"
            : "Anti-Throttling CPU Pinning",
          included: true,
        },
        {
          label: isId
            ? "Backup Harian Cloudflare R2"
            : "Daily Cloudflare R2 Backup",
          included: true,
        },
        {
          label: isId
            ? "Prioritas Disk I/O Tercepat"
            : "Highest Disk I/O Priority",
          included: true,
        },
        {
          label: isId
            ? "Multi-Stack & Webhook Ready"
            : "Multi-Stack & Webhook Ready",
          included: true,
        },
        {
          label: isId ? "SLA Ketersediaan 99.9%" : "99.9% Availability SLA",
          included: true,
        },
      ],
    },
    {
      id: "enterprise",
      name: "Enterprise Dedicated",
      badge: isId ? "Maximum Isolation" : "Maximum Isolation",
      monthlyPrice: 349000,
      yearlyPrice: 279000,
      description: isId
        ? "Beban kerja berat, multi-agent pipeline, scraping data, dan SLA prioritas tinggi."
        : "Heavy workloads, multi-agent pipelines, web scraping, and VIP SLA support.",
      voucherNote: isId
        ? "Potongan Rp 50k dg Voucher!"
        : "Save Rp 50k w/ Voucher!",
      cta: isId ? "Pilih Enterprise" : "Get Enterprise",
      ctaHref: `/${locale}/login`,
      ctaStyle: "border",
      highlight: false,
      features: [
        {
          label: isId
            ? "3.0 vCPU DEDICATED (Guaranteed)"
            : "3.0 vCPU DEDICATED (Guaranteed)",
          included: true,
        },
        {
          label: isId ? "16 GB RAM Dedicated" : "16 GB Dedicated RAM",
          included: true,
        },
        {
          label: isId
            ? "50 GB Enterprise NVMe Direct"
            : "50 GB Enterprise NVMe Direct",
          included: true,
        },
        {
          label: isId
            ? "Multi-Agent Pipeline Ready"
            : "Multi-Agent Pipeline Ready",
          included: true,
        },
        {
          label: isId
            ? "Backup Harian Cloudflare R2"
            : "Daily Cloudflare R2 Backup",
          included: true,
        },
        {
          label: isId
            ? "Direct Engineer & VIP 24/7"
            : "Direct Engineer & 24/7 VIP",
          included: true,
        },
        {
          label: isId
            ? "Custom Reverse Proxy & IP"
            : "Custom Reverse Proxy & IP",
          included: true,
        },
        {
          label: isId ? "SLA Ketersediaan 99.99%" : "99.99% Availability SLA",
          included: true,
        },
      ],
    },
  ]

  const formatIdr = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <section id="pricing" className="relative bg-background py-28">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_50%,color-mix(in_oklch,var(--chart-3)_7%,transparent),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Launching Voucher Announcement Banner */}
        <div className="mb-12 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center shadow-lg shadow-emerald-500/5 sm:p-5">
          <div className="inline-flex items-center gap-2 font-semibold text-emerald-400">
            <Sparkle className="h-5 w-5" weight="fill" />
            <span className="text-sm tracking-wide uppercase">
              {isId
                ? "🎁 Promo Peluncuran Batch 1"
                : "🎁 Batch 1 Launching Promo"}
            </span>
          </div>
          <p className="mt-1 text-sm text-foreground/90 sm:text-base">
            {isId ? (
              <>
                Klaim{" "}
                <strong className="text-emerald-400">
                  Voucher Saldo Rp 50.000
                </strong>{" "}
                untuk order pertama! Paket Starter (Rp 29.000) langsung{" "}
                <strong className="text-emerald-300">
                  GRATIS bulan pertama
                </strong>
                , atau nikmati paket Pro (Rp 69.000) hanya dengan{" "}
                <strong className="text-emerald-300">Rp 19.000</strong>.
              </>
            ) : (
              <>
                Claim your{" "}
                <strong className="text-emerald-400">
                  Rp 50,000 Credit Voucher
                </strong>{" "}
                on first checkout! Starter plan becomes{" "}
                <strong className="text-emerald-300">
                  100% FREE for Month 1
                </strong>
                , or enjoy Pro for only{" "}
                <strong className="text-emerald-300">Rp 19,000</strong>.
              </>
            )}
          </p>
          <div className="mt-2 text-xs text-muted-foreground">
            {isId
              ? "⚡ Kuota Terbatas: Berlaku khusus 50 pendaftar pertama periode launching."
              : "⚡ Limited Inventory: Valid for the first 50 early-adopter signups."}
          </div>
        </div>

        {/* Section Header */}
        <div className="mb-14 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5">
            <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              {isId ? "Harga Transparan" : "Pricing & Specs"}
            </span>
          </div>
          <h2 className="mb-5 text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
            {isId ? "Harga Simpel & " : "Simple & "}{" "}
            <span className="bg-gradient-to-r from-chart-3 to-chart-2 bg-clip-text text-transparent">
              {isId ? "Transparan" : "Transparent"}
            </span>
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
            {isId
              ? "Pilih antara shared burstable untuk bot personal atau 100% dedicated resource untuk bisnis anti-throttling."
              : "Choose between burstable shared CPU for lightweight bots or 100% dedicated cores for unthrottled performance."}
          </p>

          {/* Toggle Monthly / Yearly */}
          <div className="inline-flex items-center gap-0 rounded-full border border-border bg-secondary p-1">
            <button
              id="pricing-toggle-monthly"
              onClick={() => setYearly(false)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                !yearly
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isId ? "Bulanan" : "Monthly"}
            </button>
            <button
              id="pricing-toggle-yearly"
              onClick={() => setYearly(true)}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all ${
                yearly
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isId ? "Tahunan" : "Yearly"}
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
                {isId ? "Hemat 2 Bln" : "Save ~20%"}
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              id={`pricing-plan-${plan.id}`}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${
                plan.highlight
                  ? "scale-[1.02] border-primary/30 bg-primary/10 shadow-xl shadow-primary/10"
                  : "border-border bg-card hover:border-primary/20"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3.5 py-1 text-xs font-bold whitespace-nowrap text-primary-foreground shadow-lg shadow-primary/30">
                  {plan.badge}
                </div>
              )}

              <div className="mb-4">
                <h3 className="mb-1 text-lg font-bold text-foreground">
                  {plan.name}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground lg:text-3xl">
                    {formatIdr(yearly ? plan.yearlyPrice : plan.monthlyPrice)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isId ? "/bln" : "/mo"}
                  </span>
                </div>

                {/* Voucher notice badge */}
                <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                  <Sparkle className="h-3 w-3" />
                  <span>{plan.voucherNote}</span>
                </div>
              </div>

              {/* CTA button */}
              <a
                href={plan.ctaHref}
                id={`pricing-cta-${plan.id}`}
                className={`mb-6 w-full rounded-xl py-2.5 text-center text-sm font-semibold transition-all ${
                  plan.ctaStyle === "primary"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                    : "border border-border text-foreground hover:bg-secondary"
                }`}
              >
                {plan.cta}
              </a>

              {/* Features list */}
              <ul className="flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li
                    key={f.label}
                    className="flex items-center gap-2.5 text-xs sm:text-sm"
                  >
                    {f.included ? (
                      <Check
                        className="h-4 w-4 flex-shrink-0 text-primary"
                        weight="bold"
                      />
                    ) : (
                      <X
                        className="h-4 w-4 flex-shrink-0 text-muted-foreground/40"
                        weight="bold"
                      />
                    )}
                    <span
                      className={
                        f.included
                          ? "text-foreground/80"
                          : "text-muted-foreground/40"
                      }
                    >
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Local Payment Methods & Guarantee Badges */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-card/60 p-6 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                {isId
                  ? "Metode Pembayaran Lokal Resmi"
                  : "Local Instant Payment Methods"}
              </div>
              <div className="text-xs text-muted-foreground">
                QRIS (GoPay, OVO, Dana, ShopeePay), BCA, Mandiri, BNI, BRI
                Virtual Account.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                {isId
                  ? "Garansi Keamanan & Anti-Hilang"
                  : "Data Safety Guarantee"}
              </div>
              <div className="text-xs text-muted-foreground">
                {isId
                  ? "Penyimpanan Enterprise NVMe Direct + Backup Harian Cloudflare R2."
                  : "Enterprise NVMe Direct Storage + Daily Automated Cloudflare R2 Backups."}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground/50">
          {isId
            ? "Semua paket sudah termasuk kuota bandwidth unmetered dengan fair-usage policy. Harga belum termasuk PPN bila berlaku."
            : "All plans include unmetered bandwidth under fair usage policy. Cancel anytime with zero lock-in."}
        </p>
      </div>
    </section>
  )
}

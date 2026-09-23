"use client"

import { useParams } from "next/navigation"
import {
  ShieldCheck,
  Cpu,
  Clock,
  ArrowsLeftRight,
  Database,
  LockKey,
} from "@phosphor-icons/react"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export function TestimonialsSection() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const isId = locale === "id"
  const t = getMessages(locale).pHomeTestimonials

  const highlights = [
    {
      icon: Clock,
      title: isId ? "99.9% Uptime & SLA" : "99.9% Uptime SLA",
      description: isId
        ? "Infrastruktur cloud berkinerja tinggi dengan pemantauan otomatis dan pemulihan cepat untuk menjaga layanan tetap aktif."
        : "High-performance cloud infrastructure backed by continuous health checks and automated failover.",
      metric: "99.9%",
      metricLabel: isId ? "Ketersediaan Layanan" : "Service Availability",
    },
    {
      icon: ArrowsLeftRight,
      title: isId ? "Integrasi WhatsApp Resmi" : "Official WhatsApp Platform",
      description: isId
        ? "Kirim notifikasi OTP, transactional alert, dan live chat customer service dengan throughput pesan teruji."
        : "Send transactional alerts, OTPs, and customer conversations via official Meta Cloud API with high message throughput.",
      metric: "< 2s",
      metricLabel: isId ? "Pengiriman Notifikasi" : "Delivery Latency",
    },
    {
      icon: LockKey,
      title: isId ? "Keamanan Data & Privasi" : "Enterprise-Grade Security",
      description: isId
        ? "Enkripsi end-to-end data in-transit & at-rest, isolasi multi-tenant yang ketat, dan kebijakan kepatuhan privasi."
        : "End-to-end TLS encryption, strict multi-tenant boundary isolation, and compliance-ready data handling.",
      metric: "AES-256",
      metricLabel: isId ? "Enkripsi Standar Industri" : "Industry Encryption",
    },
    {
      icon: Cpu,
      title: isId ? "App Hosting Terkelola" : "Managed Cloud Runtimes",
      description: isId
        ? "Jalankan kontainer dan framework web modern (Next.js, Node, Laravel) dengan routing otomatis dan sertifikat SSL gratis."
        : "Run modern web frameworks and containers with automated reverse proxying and zero-touch SSL generation.",
      metric: "Auto",
      metricLabel: isId ? "SSL & Load Balancer" : "SSL & Load Balancing",
    },
    {
      icon: Database,
      title: isId
        ? "Deposit & Penagihan Transparan"
        : "Transparent Billing & Top-Up",
      description: isId
        ? "Sistem saldo deposit prabayar dengan dukungan QRIS, Virtual Account, dan riwayat faktur pajak resmi yang dapat diunduh."
        : "Prepaid wallet balances with instant QRIS/VA top-ups and downloadable invoice records for tax compliance.",
      metric: "QRIS",
      metricLabel: isId ? "Instan & Tanpa Biaya Tersembunyi" : "Instant Top-Up",
    },
    {
      icon: ShieldCheck,
      title: isId ? "Dukungan Teknis Langsung" : "Direct Engineering Support",
      description: isId
        ? "Tiket bantuan ditangani langsung oleh tim engineering untuk penyelesaian kendala integrasi tanpa birokrasi berbelit."
        : "Dedicated ticket portal directly monitored by engineers for rapid API and integration troubleshooting.",
      metric: "24/7",
      metricLabel: isId ? "Monitoring & Tiket Bantuan" : "Support & Monitoring",
    },
  ]

  return (
    <section className="relative overflow-hidden border-t border-border/40 bg-background py-24 sm:py-28">
      <div className="relative mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3.5 py-1">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold tracking-wide text-foreground uppercase">
              {isId
                ? "Standar Keandalan Platform"
                : "Platform Reliability Standards"}
            </span>
          </div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {t.headingStart}{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              {t.headingHighlight}
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            {isId
              ? "Dari pengiriman notifikasi skala besar hingga aplikasi web terkelola, PFNApp menjamin keandalan dan kepatuhan hukum bisnis Anda."
              : "From high-volume messaging to containerized app workloads, PFNApp provides the operational rigor modern businesses demand."}
          </p>
        </div>

        {/* Pillars Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-emerald-500/30 hover:shadow-md"
            >
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <item.icon size={22} weight="duotone" />
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {item.metric}
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      {item.metricLabel}
                    </p>
                  </div>
                </div>

                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

"use client"

import { useParams } from "next/navigation"
import {
  Cloud,
  HardDrive,
  Robot,
  ShieldCheck,
  ChartLineUp,
  ArrowRight,
  WhatsappLogo,
} from "@phosphor-icons/react"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export function ServicesSection() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const isId = locale === "id"

  const services = [
    {
      id: "hosting",
      icon: Cloud,
      gradient: "from-emerald-500 to-teal-500",
      glow: "shadow-emerald-500/20",
      bgGlow: "bg-emerald-500/5",
      borderHover: "hover:border-emerald-500/30",
      title: isId ? "Hosting Aplikasi" : "App Hosting",
      subtitle: isId
        ? "Deploy cepat, otomatis & andal"
        : "Deploy anything, anywhere",
      description: isId
        ? "Deployment terisolasi untuk Next.js, Node.js, Laravel, dan container. Dilengkapi SSL otomatis, reverse proxy edge, dan pemantauan metrik."
        : "Zero-config deployment for Next.js, React, Node.js, and more. Git-push to deploy with automatic SSL, CDN, and scaling.",
      features: isId
        ? [
            "Skalabilitas otomatis",
            "Lingkungan pratinjau",
            "Zero downtime deploy",
            "Jaringan edge",
          ]
        : [
            "Auto-scaling",
            "Preview environments",
            "Zero downtime deploys",
            "Edge network",
          ],
      badge: isId ? "Populer" : "Most popular",
      badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    {
      id: "whatsapp",
      icon: WhatsappLogo,
      gradient: "from-emerald-600 to-green-500",
      glow: "shadow-emerald-500/20",
      bgGlow: "bg-emerald-500/5",
      borderHover: "hover:border-emerald-500/30",
      title: isId ? "WhatsApp Official API" : "WhatsApp Official API",
      subtitle: isId
        ? "Pesan Bisnis Resmi & Webhook"
        : "Official Business Messaging",
      description: isId
        ? "Platform Cloud API resmi Meta untuk pengiriman notifikasi transaksi, OTP, broadcast, dan integrasi webhook bot interaktif."
        : "Official Meta Cloud API platform for transactional alerts, OTP verification, broadcasts, and interactive bot webhooks.",
      features: isId
        ? [
            "Katalog paket resmi",
            "Manajemen template Meta",
            "Webhook & audit log",
            "Dukungan QRIS & Saldo",
          ]
        : [
            "Official catalog plans",
            "Meta template sync",
            "Webhooks & audit logs",
            "QRIS wallet balance",
          ],
      badge: isId ? "Siap Pakai" : "Production Ready",
      badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    {
      id: "vpn",
      icon: ShieldCheck,
      gradient: "from-teal-500 to-cyan-500",
      glow: "shadow-teal-500/20",
      bgGlow: "bg-teal-500/5",
      borderHover: "hover:border-teal-500/30",
      title: isId ? "Secure WireGuard VPN" : "Secure WireGuard VPN",
      subtitle: isId
        ? "Tunnel Jaringan Terisolasi"
        : "Isolated Network Tunnels",
      description: isId
        ? "Akses infrastruktur internal dengan aman menggunakan protokol WireGuard modern berkecepatan tinggi dan latency rendah."
        : "High-speed, low-latency secure network tunneling to access private cloud services and databases safely.",
      features: isId
        ? [
            "Enkripsi WireGuard",
            "Multi-region endpoint",
            "Konfigurasi instan",
            "Manajemen perangkat",
          ]
        : [
            "WireGuard encryption",
            "Multi-region endpoints",
            "Instant profiles",
            "Device management",
          ],
      badge: isId ? "Tersedia" : "Available",
      badgeColor: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    },
    {
      id: "storage",
      icon: HardDrive,
      gradient: "from-blue-500 to-cyan-500",
      glow: "shadow-blue-500/20",
      bgGlow: "bg-blue-500/5",
      borderHover: "hover:border-blue-500/30",
      title: isId ? "Penyimpanan Objek S3" : "Storage S3",
      subtitle: isId
        ? "Object storage kompatibel S3"
        : "S3-compatible object storage",
      description: isId
        ? "API penyimpanan kompatibel S3 standar industri untuk media, backup, dan aset statis dengan bandwidth optimal."
        : "Fully compatible S3 API to store any file at any scale. Built-in CDN delivery, lifecycle policies, and access controls.",
      features: isId
        ? [
            "API S3-kompatibel",
            "CDN global",
            "Versioning aset",
            "Kontrol akses IAM",
          ]
        : ["S3-compatible API", "Global CDN", "Versioning", "Lifecycle rules"],
      badge: null,
      badgeColor: "",
    },
    {
      id: "ai",
      icon: Robot,
      gradient: "from-amber-500 to-orange-500",
      glow: "shadow-amber-500/20",
      bgGlow: "bg-amber-500/5",
      borderHover: "hover:border-amber-500/30",
      title: isId ? "AI Studio & Agents" : "AI Studio & Agents",
      subtitle: isId
        ? "Visual workflow & provider LLM"
        : "LLM inference & embeddings",
      description: isId
        ? "Rancang visual agent dan alur kerja bot cerdas dengan integrasi multi-provider model LLM dan eksekusi real-time."
        : "Run AI models at scale with a single API. Embeddings, completions, and vision — all with token-level billing.",
      features: isId
        ? [
            "Canvas visual workflow",
            "Koneksi multi-provider",
            "Knowledge retrieval",
            "Simulator interaktif",
          ]
        : [
            "Visual canvas workflow",
            "Multi-provider LLM",
            "Knowledge base",
            "Interactive simulator",
          ],
      badge: "Beta",
      badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    },
    {
      id: "analytics",
      icon: ChartLineUp,
      gradient: "from-pink-500 to-fuchsia-500",
      glow: "shadow-pink-500/20",
      bgGlow: "bg-pink-500/5",
      borderHover: "hover:border-pink-500/30",
      title: isId ? "Analitik & Penagihan Terpadu" : "Analytics & Invoicing",
      subtitle: isId ? "Visibilitas pemakaian & saldo" : "Real-time insights",
      description: isId
        ? "Dasbor pemakaian sumber daya transparan, peringatan saldo, dan pelaporan faktur pajak untuk kemudahan audit keuangan."
        : "Understand your users and infrastructure at a glance. Custom dashboards, alerts, and API usage metrics.",
      features: isId
        ? [
            "Metrik real-time",
            "Riwayat mutasi saldo",
            "Peringatan kuota",
            "Faktur resmi PDF",
          ]
        : [
            "Real-time metrics",
            "Prepaid balance ledger",
            "Quota alerts",
            "PDF invoices",
          ],
      badge: null,
      badgeColor: "",
    },
  ]

  return (
    <section id="services" className="relative bg-[#060b18] py-24 sm:py-28">
      {/* Section glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(16,185,129,0.06),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
            <span className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
              {isId
                ? "Katalog Solusi Terintegrasi"
                : "Integrated Cloud Solutions"}
            </span>
          </div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {isId ? (
              <>
                Semua yang Anda butuhkan untuk{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  tumbuh & berkembang
                </span>
              </>
            ) : (
              <>
                Everything you need to{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  ship & scale
                </span>
              </>
            )}
          </h2>
          <p className="mx-auto max-w-2xl text-base text-white/50 sm:text-lg">
            {isId
              ? "Satu akun konsol, ragam layanan cloud produksi. Bangun dan jalankan operasional digital tanpa ribet mengelola banyak vendor."
              : "One console, enterprise-grade cloud capabilities. Build and run your digital business without vendor fragmentation."}
          </p>
        </div>

        {/* Grid */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.id}
              id={service.id}
              className={`group relative border border-white/8 bg-white/[0.03] ${service.borderHover} cursor-pointer rounded-2xl p-6 transition-all duration-300 hover:bg-white/[0.06]`}
            >
              {/* Glow on hover */}
              <div
                className={`absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${service.bgGlow} -z-10 blur-xl`}
              />

              {/* Badge */}
              {service.badge && (
                <div
                  className={`absolute top-4 right-4 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${service.badgeColor}`}
                >
                  {service.badge}
                </div>
              )}

              {/* Icon */}
              <div
                className={`h-12 w-12 rounded-xl bg-gradient-to-br ${service.gradient} mb-5 flex items-center justify-center shadow-lg ${service.glow} transition-transform duration-300 group-hover:scale-110`}
              >
                <service.icon weight="fill" className="h-6 w-6 text-white" />
              </div>

              <h3 className="mb-1 text-lg font-bold text-white">
                {service.title}
              </h3>
              <p className="mb-3 text-xs font-medium text-white/40">
                {service.subtitle}
              </p>
              <p className="mb-5 text-sm leading-relaxed text-white/50">
                {service.description}
              </p>

              {/* Features */}
              <div className="mb-6 flex flex-wrap gap-2">
                {service.features.map((f) => (
                  <span
                    key={f}
                    className="rounded-md border border-white/8 bg-white/5 px-2 py-0.5 text-xs text-white/50"
                  >
                    {f}
                  </span>
                ))}
              </div>

              {/* Link */}
              <div className="flex items-center gap-1 text-sm font-medium text-white/40 transition-colors group-hover:text-white">
                Learn more
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

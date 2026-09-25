"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import {
  Robot,
  ShareNetwork,
  Lightning,
  Clock,
  Sparkle,
  ArrowRight,
  Cpu,
  Check,
  PaperPlaneTilt,
} from "@phosphor-icons/react"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export function TemplatesSection() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const isId = locale === "id"

  const readyTemplates = [
    {
      id: "hermes",
      name: "Hermes Agent",
      tagline: isId
        ? "Autonomous AI Agent Gateway by Nous Research"
        : "Autonomous AI Agent Gateway by Nous Research",
      description: isId
        ? "Bot AI mandiri dengan memori chat persisten di NVMe, orchestrator tools, dan supervised web dashboard."
        : "Autonomous AI agent with persistent SQLite memory on NVMe, tool orchestration, and supervised dashboard.",
      specs: "0.5 vCPU Burst · 2 GB RAM · 5 GB NVMe",
      icon: Robot,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10 border-emerald-500/20",
      badge: isId ? "Siap Deploy" : "Production Ready",
      badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      features: isId
        ? [
            "Memori SQLite Persisten di NVMe",
            "Supervised Web Dashboard bawaan",
            "Terhubung ke 9router & LLM",
          ]
        : [
            "Persistent SQLite Memory on NVMe",
            "Supervised Web Dashboard Included",
            "Direct 9router & LLM Connection",
          ],
      deployHref: `/${locale}/login`,
    },
    {
      id: "9router",
      name: "9router",
      tagline: isId
        ? "High-Throughput LLM Gateway & Router"
        : "High-Throughput LLM Gateway & Router",
      description: isId
        ? "Proxy terpadu kompatibel OpenAI dengan fallback routing, load balancing, rate limiting, dan cost tracking multi-provider."
        : "Unified OpenAI-compatible proxy with fallback routing, load balancing, rate limiting, and multi-provider cost tracking.",
      specs: "0.25 vCPU Burst · 256 MB RAM · 10 GB NVMe",
      icon: ShareNetwork,
      iconColor: "text-cyan-400",
      iconBg: "bg-cyan-500/10 border-cyan-500/20",
      badge: isId ? "Siap Deploy" : "Production Ready",
      badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
      features: isId
        ? [
            "OpenAI Compatible Endpoint",
            "Fallback Otomatis Antar Model AI",
            "Token & Cost Tracking Realtime",
          ]
        : [
            "OpenAI Compatible Endpoint",
            "Automatic Model Fallbacks",
            "Real-time Token & Cost Tracking",
          ],
      deployHref: `/${locale}/login`,
    },
    {
      id: "n8n",
      name: "n8n Automation",
      tagline: isId
        ? "Workflow & Integration Automation Platform"
        : "Workflow & Integration Automation Platform",
      description: isId
        ? "Otomasi alur kerja serbaguna dengan ratusan integrasi, webhook WhatsApp, dan database PostgreSQL terkelola."
        : "Versatile workflow automation with hundreds of integrations, WhatsApp webhooks, and managed PostgreSQL storage.",
      specs: "0.5 vCPU Burst · 512 MB RAM · 5 GB NVMe",
      icon: Lightning,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10 border-amber-500/20",
      badge: isId ? "Siap Deploy" : "Production Ready",
      badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      features: isId
        ? [
            "Ratusan Node & Integrasi API",
            "Webhook WhatsApp Official Ready",
            "PostgreSQL Managed Database",
          ]
        : [
            "Hundreds of Nodes & Integrations",
            "Official WhatsApp Webhook Ready",
            "PostgreSQL Managed Database",
          ],
      deployHref: `/${locale}/login`,
    },
  ]

  const soonTemplates = [
    {
      id: "openclaw",
      name: "OpenClaw",
      category: "AI Data Scraper",
      description: isId
        ? "Autonomous web scraper dan knowledge-base collector untuk melatih agent dengan data web terbaru."
        : "Autonomous web scraper & knowledge collector for feeding real-time web context to AI agents.",
      badge: isId ? "Segera Hadir" : "Available Soon",
    },
    {
      id: "omniroute",
      name: "OmniRoute",
      category: "Inference Engine",
      description: isId
        ? "Multi-model distributed inference balancer untuk beban kerja API berskala raksasa."
        : "Distributed inference balancer engineered for high-concurrency API workloads.",
      badge: isId ? "Segera Hadir" : "Available Soon",
    },
    {
      id: "wordpress",
      name: "WordPress",
      category: "CMS & Publishing",
      description: isId
        ? "CMS standar industri dengan stack PHP 8.3 + MariaDB terisolasi dan storage NVMe super cepat."
        : "Production CMS with isolated PHP 8.3, MariaDB, and ultra-fast direct NVMe storage.",
      badge: isId ? "Segera Hadir" : "Available Soon",
    },
  ]

  const comparisons = [
    {
      feature: isId ? "Tipe Penyimpanan (Disk)" : "Storage Architecture",
      traditional: isId
        ? "Shared Cloud Disk (100–300 IOPS, rawan bottleneck)"
        : "Shared Cloud Disk (100–300 IOPS, high I/O wait)",
      ours: isId
        ? "Direct Enterprise NVMe (400.000 IOPS, Sub-millisecond)"
        : "Direct Enterprise NVMe (400,000 IOPS, Sub-millisecond)",
      highlight: true,
    },
    {
      feature: isId
        ? "Kecepatan Database SQLite Bot"
        : "SQLite Agent Database Latency",
      traditional: isId
        ? "Rawan I/O Wait & chat lag saat history menumpuk"
        : "Prone to chat lag when context history grows",
      ours: isId
        ? "Sangat responsif tanpa lag (Direct LVM Access)"
        : "Instant read/write, zero chat stutter",
      highlight: true,
    },
    {
      feature: isId ? "Garansi Komputasi CPU" : "CPU Guarantee",
      traditional: isId
        ? "Shared CPU biasa, sering terkena throttling"
        : "Shared CPU with aggressive CPU throttling",
      ours: isId
        ? "Tersedia Pilihan 100% Dedicated CPU Guaranteed"
        : "100% Dedicated Guaranteed CPU Cores Available",
      highlight: false,
    },
    {
      feature: isId ? "Disaster Recovery" : "Disaster Recovery",
      traditional: isId
        ? "Manual / Tidak disediakan bawaan"
        : "Manual or not provided by default",
      ours: isId
        ? "Backup Harian Otomatis ke Cloudflare R2"
        : "Daily Automated Cloud Backup to Cloudflare R2",
      highlight: false,
    },
    {
      feature: isId ? "Integrasi Ekosistem" : "Ecosystem Integrations",
      traditional: isId
        ? "Setup manual VM kosong dari awal"
        : "Blank VMs, manual CLI & network setup",
      ours: isId
        ? "1-Click Deploy + Terhubung WhatsApp API & Webhook"
        : "1-Click Stacks + Direct WhatsApp API Integration",
      highlight: false,
    },
  ]

  return (
    <section id="templates" className="relative bg-[#060b18] py-24 sm:py-28">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_30%,rgba(16,185,129,0.06),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5">
            <Sparkle className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
              {isId ? "Katalog Siap Pakai" : "Curated Production Stacks"}
            </span>
          </div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {isId ? (
              <>
                Deploy AI Agent, LLM Gateway, &{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  Otomasi dalam 30 Detik
                </span>
              </>
            ) : (
              <>
                Deploy AI Agents, LLM Gateways, &{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  Automation in 30s
                </span>
              </>
            )}
          </h2>
          <p className="mx-auto max-w-2xl text-base text-white/50 sm:text-lg">
            {isId
              ? "Fokus pada performa terbaik. Kami hanya merilis template yang teruji dan stabil di Kubernetes dengan penyimpanan Direct Enterprise NVMe."
              : "Zero fluff, maximum performance. We only deliver curated stacks rigorously tested on Kubernetes with dedicated NVMe storage."}
          </p>
        </div>

        {/* Ready Templates (Active 3 Cards) */}
        <div className="mb-12">
          <div className="mb-6 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <h3 className="text-sm font-semibold tracking-wide text-white/80 uppercase">
              {isId ? "Siap Dideploy Sekarang" : "Ready to Deploy"}
            </h3>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {readyTemplates.map((tpl) => {
              const IconComponent = tpl.icon
              return (
                <div
                  key={tpl.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm transition-all duration-300 hover:border-emerald-500/40 hover:bg-white/[0.05] hover:shadow-xl hover:shadow-emerald-500/5"
                >
                  <div>
                    {/* Header card */}
                    <div className="mb-4 flex items-start justify-between">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl border ${tpl.iconBg}`}
                      >
                        <IconComponent
                          weight="duotone"
                          className={`h-6 w-6 ${tpl.iconColor}`}
                        />
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tpl.badgeColor}`}
                      >
                        {tpl.badge}
                      </span>
                    </div>

                    <h4 className="text-xl font-bold text-white transition-colors group-hover:text-emerald-300">
                      {tpl.name}
                    </h4>
                    <p className="mt-1 text-xs font-medium text-emerald-400/80">
                      {tpl.tagline}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-white/60">
                      {tpl.description}
                    </p>

                    {/* Specs badge */}
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 font-mono text-xs text-white/50">
                      <Cpu className="h-4 w-4 text-emerald-400" />
                      <span>{tpl.specs}</span>
                    </div>

                    {/* Features bullet */}
                    <ul className="mt-4 space-y-2 text-xs text-white/70">
                      {tpl.features.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <Check
                            className="h-3.5 w-3.5 text-emerald-400"
                            weight="bold"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Deploy button */}
                  <div className="mt-6 border-t border-white/5 pt-4">
                    <Link
                      href={tpl.deployHref}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20 transition-all hover:bg-emerald-500"
                    >
                      <span>{isId ? "Deploy Instan" : "Instant Deploy"}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Available Soon (3 Muted Cards) */}
        <div className="mb-14">
          <div className="mb-6 flex items-center gap-2">
            <Clock className="h-4 w-4 text-white/40" />
            <h3 className="text-sm font-semibold tracking-wide text-white/50 uppercase">
              {isId
                ? "Segera Hadir di Rilis Berikutnya"
                : "Coming in Next Updates"}
            </h3>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {soonTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="relative flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.015] p-6 opacity-75 transition-all hover:opacity-100"
              >
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-white/40">
                      {tpl.category}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-white/40">
                      {tpl.badge}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-white/80">
                    {tpl.name}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-white/40">
                    {tpl.description}
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-2 text-xs text-white/30">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {isId
                      ? "Dalam proses validasi arsitektur"
                      : "In architecture validation"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Community Request Banner */}
        <div className="mb-20 rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-950/20 via-white/[0.02] to-cyan-950/20 p-8 text-center backdrop-blur-sm sm:flex sm:items-center sm:justify-between sm:text-left">
          <div className="mb-6 sm:mb-0">
            <h4 className="text-lg font-bold text-white">
              {isId
                ? "💡 Butuh Docker Image atau Template Aplikasi Lain?"
                : "💡 Need another Docker Image or Stack Template?"}
            </h4>
            <p className="mt-1 max-w-xl text-sm text-white/50">
              {isId
                ? "Beri tahu kami aplikasi atau stack yang Anda butuhkan. Tim engineer kami akan menyiapkan template 1-click nya langsung di cluster."
                : "Tell us the image or framework you need. Our engineering team will prepare and verify the 1-click stack for you."}
            </p>
          </div>
          <Link
            href={`/${locale}/docs`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-all hover:border-white/30 hover:bg-white/10"
          >
            <PaperPlaneTilt className="h-4 w-4 text-emerald-400" />
            <span>
              {isId ? "Ajukan Request Template" : "Request a Template"}
            </span>
          </Link>
        </div>

        {/* Architecture & Hardware Comparison Table */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm">
          <div className="mb-8 text-center sm:text-left">
            <h3 className="text-xl font-bold text-white">
              {isId
                ? "Kenapa Infrastruktur Kami Lebih Cepat & Anti-Lag?"
                : "Why Our Infrastructure is Faster & Anti-Lag"}
            </h3>
            <p className="mt-1 text-sm text-white/50">
              {isId
                ? "Perbandingan arsitektur hardware vs hosting tradisional / shared VPS biasa."
                : "Architectural hardware comparison vs traditional shared hosting."}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-white/70">
              <thead>
                <tr className="border-b border-white/10 text-xs font-semibold text-white/40 uppercase">
                  <th className="pr-6 pb-4">
                    {isId ? "Parameter" : "Feature / Parameter"}
                  </th>
                  <th className="pr-6 pb-4">
                    {isId
                      ? "Hosting Tradisional / VPS Biasa"
                      : "Traditional VPS"}
                  </th>
                  <th className="pb-4 text-emerald-400">
                    {isId ? "Platform Kami (PFNApp)" : "Our Platform (PFNApp)"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {comparisons.map((c) => (
                  <tr
                    key={c.feature}
                    className={
                      c.highlight
                        ? "bg-emerald-500/[0.03] transition-colors"
                        : "transition-colors"
                    }
                  >
                    <td className="py-4 pr-6 font-medium text-white">
                      {c.feature}
                    </td>
                    <td className="py-4 pr-6 text-white/40">{c.traditional}</td>
                    <td className="py-4 font-medium text-emerald-300">
                      {c.ours}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

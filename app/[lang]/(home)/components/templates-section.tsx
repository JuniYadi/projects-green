"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import {
  Robot,
  ShareNetwork,
  Lightning,
  ArrowRight,
  Cpu,
  Check,
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
      iconUrl: "/app-hosting/icons/hermes.svg",
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
      deployHref: `/${locale}/login?next=${encodeURIComponent(
        `/${locale}/console/app/marketplace?template=hermes`
      )}`,
    },
    {
      id: "9router",
      name: "9router",
      iconUrl: "/app-hosting/icons/9router.svg",
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
      deployHref: `/${locale}/login?next=${encodeURIComponent(
        `/${locale}/console/app/marketplace?template=9router`
      )}`,
    },
    {
      id: "n8n",
      name: "n8n Automation",
      iconUrl: "/app-hosting/icons/n8n.svg",
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
      deployHref: `/${locale}/login?next=${encodeURIComponent(
        `/${locale}/console/app/marketplace?template=n8n`
      )}`,
    },
  ]

  return (
    <section
      id="templates"
      className="relative scroll-mt-24 bg-[#060b18] py-16 sm:py-20"
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_30%,rgba(16,185,129,0.06),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="mb-10 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {isId
              ? "Pilih aplikasi yang ingin dijalankan"
              : "Choose what to run"}
          </h2>
          <p className="mx-auto max-w-2xl text-base text-white/50 sm:text-lg">
            {isId
              ? "Mulai dari template yang tersedia. Lihat kebutuhan komputasi sebelum deploy."
              : "Start with an available template. Review its resources before deploying."}
          </p>
        </div>

        {/* Ready Templates (Active 3 Cards) */}
        <div>
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
                        className={`flex h-12 w-12 items-center justify-center rounded-xl border p-2.5 ${tpl.iconBg}`}
                      >
                        {tpl.iconUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={tpl.iconUrl}
                            alt=""
                            aria-hidden="true"
                            className="h-6 w-6 object-contain"
                          />
                        ) : (
                          <IconComponent
                            weight="duotone"
                            className={`h-6 w-6 ${tpl.iconColor}`}
                          />
                        )}
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

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-7 text-sm text-white/60">
          <p>{isId ? "Tidak menemukan aplikasi Anda?" : "Need another app?"}</p>
          <a
            href={`mailto:support@pfnapp.com?subject=${encodeURIComponent(isId ? "Request Template Aplikasi PFNApp" : "PFNApp Template Request")}`}
            className="font-medium text-white underline underline-offset-4 hover:text-emerald-300"
          >
            {isId ? "Minta template →" : "Request a template →"}
          </a>
        </div>
      </div>
    </section>
  )
}

"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowRight,
  Play,
  Terminal,
  GitBranch,
  CheckCircle,
} from "@phosphor-icons/react"
import { useEffect, useState } from "react"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { cn } from "@/lib/utils"

// Shell session title rendered in the mock terminal chrome — a technical
// literal, identical in every locale.
const TERMINAL_TITLE = "PFNApp Hosting - Deployment"

interface TemplateDeployFlow {
  id: string
  label: string
  iconUrl: string
  lines: Array<{ content: string; color: string }>
}

const TEMPLATES: TemplateDeployFlow[] = [
  {
    id: "hermes",
    label: "{hermes}",
    iconUrl: "/app-hosting/icons/hermes.svg",
    lines: [
      {
        content: "> Select template: {hermes}",
        color: "text-emerald-400 font-semibold",
      },
      {
        content: "  → Provisioning isolated container (0.5 vCPU, 2GB RAM)...",
        color: "text-white/50",
      },
      {
        content: "  → Mounting 5GB Direct Enterprise NVMe (400k IOPS)...",
        color: "text-white/50",
      },
      {
        content: "  → Initializing Hermes Agent & SQLite memory...",
        color: "text-white/50",
      },
      {
        content: "  ✓ Live at https://hermes-agent.sg.pfnapp.dev",
        color: "text-cyan-400",
      },
      {
        content: "  ✓ Persistent memory mounted at /opt/data",
        color: "text-cyan-400",
      },
      {
        content: "  ✓ Cluster SG-01: Latency 12ms",
        color: "text-cyan-400",
      },
      {
        content: "  🚀 Deploy complete in 18.4s! Ready 24/7",
        color: "text-emerald-400 font-bold",
      },
    ],
  },
  {
    id: "9router",
    label: "{9router}",
    iconUrl: "/app-hosting/icons/9router.svg",
    lines: [
      {
        content: "> Select template: {9router}",
        color: "text-emerald-400 font-semibold",
      },
      {
        content: "  → Provisioning unified LLM proxy (0.25 vCPU, 256MB RAM)...",
        color: "text-white/50",
      },
      {
        content: "  → Configuring multi-provider fallback & rate limits...",
        color: "text-white/50",
      },
      {
        content: "  → Mounting 10GB Enterprise NVMe storage...",
        color: "text-white/50",
      },
      {
        content: "  ✓ Live at https://9router.sg.pfnapp.dev",
        color: "text-cyan-400",
      },
      {
        content: "  ✓ OpenAI-compatible endpoint ready",
        color: "text-cyan-400",
      },
      {
        content: "  ✓ Cluster SG-01: Latency 9ms",
        color: "text-cyan-400",
      },
      {
        content: "  🚀 Deploy complete in 11.2s! Ready 24/7",
        color: "text-emerald-400 font-bold",
      },
    ],
  },
  {
    id: "openclaw",
    label: "{openclaw}",
    iconUrl: "/app-hosting/icons/openclaw.svg",
    lines: [
      {
        content: "> Select template: {openclaw}",
        color: "text-emerald-400 font-semibold",
      },
      {
        content: "  → Provisioning crawler cluster (0.5 vCPU, 1GB RAM)...",
        color: "text-white/50",
      },
      {
        content: "  → Initializing headless browser runtime...",
        color: "text-white/50",
      },
      {
        content: "  → Connecting knowledge base vector store...",
        color: "text-white/50",
      },
      {
        content: "  ✓ Live at https://openclaw.sg.pfnapp.dev",
        color: "text-cyan-400",
      },
      {
        content: "  ✓ Ready for autonomous web collection",
        color: "text-cyan-400",
      },
      {
        content: "  ✓ Cluster SG-01: Latency 14ms",
        color: "text-cyan-400",
      },
      {
        content: "  🚀 Deploy complete in 14.7s! Ready 24/7",
        color: "text-emerald-400 font-bold",
      },
    ],
  },
  {
    id: "n8n",
    label: "{n8n}",
    iconUrl: "/app-hosting/icons/n8n.svg",
    lines: [
      {
        content: "> Select template: {n8n}",
        color: "text-emerald-400 font-semibold",
      },
      {
        content: "  → Provisioning workflow engine (0.5 vCPU, 512MB RAM)...",
        color: "text-white/50",
      },
      {
        content: "  → Initializing managed PostgreSQL & Redis queues...",
        color: "text-white/50",
      },
      {
        content: "  → Registering official WhatsApp webhook endpoints...",
        color: "text-white/50",
      },
      {
        content: "  ✓ Live at https://n8n.sg.pfnapp.dev",
        color: "text-cyan-400",
      },
      {
        content: "  ✓ 300+ automation nodes loaded",
        color: "text-cyan-400",
      },
      {
        content: "  ✓ Cluster SG-01: Latency 11ms",
        color: "text-cyan-400",
      },
      {
        content: "  🚀 Deploy complete in 15.8s! Ready 24/7",
        color: "text-emerald-400 font-bold",
      },
    ],
  },
]

function TerminalBody({
  template,
  onComplete,
}: {
  template: TemplateDeployFlow
  onComplete: () => void
}) {
  const [visibleLines, setVisibleLines] = useState(0)

  useEffect(() => {
    const timers: NodeJS.Timeout[] = []

    template.lines.forEach((_, i) => {
      const timer = setTimeout(
        () => {
          setVisibleLines(i + 1)
        },
        100 + i * 450
      )
      timers.push(timer)
    })

    const cycleTimer = setTimeout(
      () => {
        onComplete()
      },
      100 + template.lines.length * 450 + 2500
    )
    timers.push(cycleTimer)

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [template, onComplete])

  return (
    <div className="min-h-[250px] p-5 font-mono text-sm">
      {template.lines.slice(0, visibleLines).map((line, i) => (
        <div
          key={i}
          className={`leading-6 transition-opacity duration-200 ${line.color}`}
        >
          {line.content}
        </div>
      ))}
      {visibleLines < template.lines.length && (
        <span className="mt-1 inline-block h-4 w-2 animate-pulse bg-emerald-400" />
      )}
    </div>
  )
}

function AnimatedTerminal() {
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0)

  const activeTemplate = TEMPLATES[activeTemplateIndex]

  const handleNext = () => {
    setActiveTemplateIndex((prev) => (prev + 1) % TEMPLATES.length)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/60">
      {/* Terminal header */}
      <div className="flex items-center gap-2 border-b border-white/8 bg-[#161b22] px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-red-500/80" />
        <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
        <div className="h-3 w-3 rounded-full bg-green-500/80" />
        <div className="flex flex-1 items-center justify-center">
          <span className="flex items-center gap-1.5 font-mono text-xs text-white/50">
            <Terminal className="h-3.5 w-3.5 text-emerald-400/80" />
            {TERMINAL_TITLE}
          </span>
        </div>
      </div>

      {/* Template selector pills */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-[#10141d] px-4 py-2.5 font-mono text-xs">
        <span className="text-white/40">Select template:</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {TEMPLATES.map((tpl, idx) => {
            const isActive = idx === activeTemplateIndex
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  if (idx !== activeTemplateIndex) {
                    setActiveTemplateIndex(idx)
                  }
                }}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs transition-all",
                  isActive
                    ? "border border-emerald-500/40 bg-emerald-500/15 font-semibold text-emerald-300 shadow-xs shadow-emerald-500/20"
                    : "border border-white/5 bg-white/5 text-white/50 hover:border-white/15 hover:text-white/80"
                )}
                aria-pressed={isActive}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tpl.iconUrl}
                  alt=""
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 object-contain"
                />
                <span>{tpl.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Terminal body */}
      <TerminalBody
        key={activeTemplate.id}
        template={activeTemplate}
        onComplete={handleNext}
      />
    </div>
  )
}

export function HeroSection() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

  const isId = locale === "id"

  const stats = [
    { value: "99.9%", label: messages.pHomeHero.statUptimeLabel },
    { value: "< 2s", label: isId ? "Latensi Kirim Pesan" : "Delivery Latency" },
    { value: "24/7", label: isId ? "Dukungan Teknis" : "Engineering Support" },
    { value: "100%", label: isId ? "API Resmi Meta" : "Official Meta API" },
  ]

  const badges = [
    {
      icon: CheckCircle,
      label: isId ? "Infrastruktur Terkelola" : "Managed Cloud Infra",
    },
    { icon: GitBranch, label: messages.pHomeHero.badgeGitNative },
    { icon: Play, label: messages.pHomeHero.badgeRollbacks },
  ]

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
      {/* Background */}
      <div className="absolute inset-0 bg-[#060b18]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.15),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_60%,rgba(6,182,212,0.08),transparent)]" />

      {/* Animated grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 animate-pulse rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute right-1/4 bottom-1/4 h-80 w-80 animate-pulse rounded-full bg-cyan-500/10 blur-3xl [animation-delay:1s]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 py-20 lg:grid-cols-2">
        {/* Left – text */}
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="font-mono text-xs text-emerald-400">
                {isId
                  ? "Cluster SG-01: Operational · NVMe Direct 400k IOPS · Latensi < 15ms"
                  : "Cluster SG-01: Operational · NVMe Direct 400k IOPS · Latency < 15ms"}
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
              <span>{messages.pHomeHero.betaBanner}</span>
            </div>
          </div>

          <h1 className="mb-6 text-5xl leading-[1.08] font-bold tracking-tight text-white lg:text-6xl xl:text-7xl">
            {messages.pHomeHero.headlineStart}{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {messages.pHomeHero.headlineHighlight}
            </span>{" "}
            {messages.pHomeHero.headlineEnd}
          </h1>

          <p className="mb-10 max-w-xl text-lg leading-relaxed text-white/50">
            {messages.pHomeHero.subheadline}
          </p>

          {/* Badges */}
          <div className="mb-10 flex flex-wrap gap-3">
            {badges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60"
              >
                <badge.icon
                  weight="fill"
                  className="h-3.5 w-3.5 text-emerald-400"
                />
                {badge.label}
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="mb-16 flex flex-col gap-4 sm:flex-row">
            <Link
              href={`/${locale}/products/whatsapp-official`}
              id="hero-cta-whatsapp"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-emerald-950/20 transition-all hover:bg-emerald-500"
            >
              {isId ? "Lihat Solusi WhatsApp" : "Explore WhatsApp Platform"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href={`/${locale}/login`}
              id="hero-cta-signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 font-semibold text-white transition-all hover:bg-white/10"
            >
              {isId ? "Buka Konsol" : "Open Console"}
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="mt-0.5 text-xs text-white/40">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right – animated terminal */}
        <div className="hidden lg:block">
          <AnimatedTerminal />

          {/* Floating status cards */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
                <span className="text-base">🚀</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  {messages.pHomeHero.cardDeploymentTitle}
                </div>
                <div className="text-xs text-emerald-400">
                  {messages.pHomeHero.cardDeploymentStatus}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20">
                <span className="text-base">📊</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  {messages.pHomeHero.cardRequestsTitle}
                </div>
                <div className="text-xs text-cyan-400">
                  {messages.pHomeHero.cardRequestsValue}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

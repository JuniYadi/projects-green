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
import { useEffect, useRef, useState } from "react"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

// Shell session title rendered in the mock terminal chrome — a technical
// literal, identical in every locale.
const TERMINAL_TITLE = "pfn-cli — zsh"

const codeLines = [
  {
    delay: 0,
    content: "$ pfn stack deploy --template hermes-agent",
    color: "text-emerald-400",
  },
  {
    delay: 600,
    content: "  → Provisioning isolated container (0.5 vCPU, 2GB RAM)...",
    color: "text-white/50",
  },
  {
    delay: 1200,
    content: "  → Mounting 5GB Direct Enterprise NVMe (400k IOPS)...",
    color: "text-white/50",
  },
  {
    delay: 1800,
    content: "  → Initializing Hermes Agent & SQLite memory...",
    color: "text-white/50",
  },
  {
    delay: 2400,
    content: "  ✓ Live at https://hermes-agent.sg.pfnapp.dev",
    color: "text-cyan-400",
  },
  {
    delay: 3000,
    content: "  ✓ Persistent memory mounted at /opt/data",
    color: "text-cyan-400",
  },
  {
    delay: 3600,
    content: "  ✓ Cluster SG-01: Latency 12ms",
    color: "text-cyan-400",
  },
  {
    delay: 4200,
    content: "  🚀 Deploy complete in 18.4s! Ready 24/7",
    color: "text-emerald-400 font-bold",
  },
]

function AnimatedTerminal() {
  const [visibleLines, setVisibleLines] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    codeLines.forEach((line, i) => {
      setTimeout(() => {
        setVisibleLines(i + 1)
      }, line.delay)
    })

    // loop animation
    const loop = setInterval(() => {
      setVisibleLines(0)
      started.current = false
      codeLines.forEach((line, i) => {
        setTimeout(() => {
          setVisibleLines(i + 1)
        }, line.delay + 200)
      })
    }, 6000)

    return () => clearInterval(loop)
  }, [])

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/60">
      {/* Terminal header */}
      <div className="flex items-center gap-2 border-b border-white/8 bg-[#161b22] px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-red-500/80" />
        <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
        <div className="h-3 w-3 rounded-full bg-green-500/80" />
        <div className="flex flex-1 items-center justify-center">
          <span className="flex items-center gap-1.5 font-mono text-xs text-white/30">
            <Terminal className="h-3 w-3" />
            {TERMINAL_TITLE}
          </span>
        </div>
      </div>
      {/* Terminal body */}
      <div className="min-h-[220px] p-5 font-mono text-sm">
        {codeLines.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            className={`leading-6 transition-opacity duration-200 ${line.color}`}
          >
            {line.content}
          </div>
        ))}
        {visibleLines < codeLines.length && (
          <span className="mt-1 inline-block h-4 w-2 animate-pulse bg-emerald-400" />
        )}
      </div>
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

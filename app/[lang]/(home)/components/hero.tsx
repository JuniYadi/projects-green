"use client"

import Link from "next/link"
import {
  ArrowRight,
  Play,
  Terminal,
  GitBranch,
  CheckCircle,
} from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"

const codeLines = [
  { delay: 0, content: "$ pfn deploy", color: "text-emerald-400" },
  {
    delay: 600,
    content: "  → Building application...",
    color: "text-white/50",
  },
  { delay: 1200, content: "  → Optimizing assets...", color: "text-white/50" },
  { delay: 1800, content: "  → Deploying to edge...", color: "text-white/50" },
  {
    delay: 2400,
    content: "  ✓ Live at https://myapp.pfnapp.com",
    color: "text-cyan-400",
  },
  { delay: 3000, content: "  ✓ SSL enabled", color: "text-cyan-400" },
  {
    delay: 3600,
    content: "  ✓ CDN configured (42 regions)",
    color: "text-cyan-400",
  },
  {
    delay: 4200,
    content: "  🚀 Deploy complete in 12.3s",
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
            pfn-cli — zsh
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

const stats = [
  { value: "99.99%", label: "Uptime SLA" },
  { value: "42", label: "Global regions" },
  { value: "<50ms", label: "Avg. latency" },
  { value: "10K+", label: "Developers" },
]

const badges = [
  { icon: CheckCircle, label: "SOC 2 Type II" },
  { icon: GitBranch, label: "Git-native deploys" },
  { icon: Play, label: "1-click rollbacks" },
]

export function HeroSection() {
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
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">
              Now in Public Beta — Free forever plan available
            </span>
          </div>

          <h1 className="mb-6 text-5xl leading-[1.08] font-bold tracking-tight text-white lg:text-6xl xl:text-7xl">
            Your full-stack{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              cloud platform
            </span>{" "}
            in one place
          </h1>

          <p className="mb-10 max-w-xl text-lg leading-relaxed text-white/50">
            Deploy apps, send emails & SMS, store files, and scale your
            infrastructure — all from a single developer-first platform. Ship
            faster, scale effortlessly.
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
              href="/signup"
              id="hero-cta-signup"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-7 py-3.5 font-semibold text-white shadow-xl shadow-emerald-500/25 transition-all hover:scale-105 hover:from-emerald-400 hover:to-cyan-400 hover:shadow-emerald-500/40"
            >
              Start building free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="#demo"
              id="hero-cta-demo"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 font-semibold text-white transition-all hover:bg-white/10"
            >
              <Play weight="fill" className="h-4 w-4 text-emerald-400" />
              Watch demo
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
                  Deployment
                </div>
                <div className="text-xs text-emerald-400">Active · v2.4.1</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20">
                <span className="text-base">📊</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Requests</div>
                <div className="text-xs text-cyan-400">1.2M today</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

"use client"

import Link from "next/link"
import { ArrowRight, Play, Terminal, GitBranch, CheckCircle } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"

const codeLines = [
  { delay: 0, content: "$ pfn deploy", color: "text-emerald-400" },
  { delay: 600, content: "  → Building application...", color: "text-white/50" },
  { delay: 1200, content: "  → Optimizing assets...", color: "text-white/50" },
  { delay: 1800, content: "  → Deploying to edge...", color: "text-white/50" },
  { delay: 2400, content: "  ✓ Live at https://myapp.pfnapp.com", color: "text-cyan-400" },
  { delay: 3000, content: "  ✓ SSL enabled", color: "text-cyan-400" },
  { delay: 3600, content: "  ✓ CDN configured (42 regions)", color: "text-cyan-400" },
  { delay: 4200, content: "  🚀 Deploy complete in 12.3s", color: "text-emerald-400 font-bold" },
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
    <div className="bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#161b22] border-b border-white/8">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-white/30 font-mono flex items-center gap-1.5">
            <Terminal className="w-3 h-3" />
            pfn-cli — zsh
          </span>
        </div>
      </div>
      {/* Terminal body */}
      <div className="p-5 font-mono text-sm min-h-[220px]">
        {codeLines.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            className={`leading-6 transition-opacity duration-200 ${line.color}`}
          >
            {line.content}
          </div>
        ))}
        {visibleLines < codeLines.length && (
          <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse mt-1" />
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
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
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
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />

      <div className="relative max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left – text */}
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-emerald-400 font-medium">
              Now in Public Beta — Free forever plan available
            </span>
          </div>

          <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.08] tracking-tight mb-6">
            Your full-stack{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              cloud platform
            </span>{" "}
            in one place
          </h1>

          <p className="text-lg text-white/50 leading-relaxed max-w-xl mb-10">
            Deploy apps, send emails & SMS, store files, and scale your infrastructure — all
            from a single developer-first platform. Ship faster, scale effortlessly.
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-3 mb-10">
            {badges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs text-white/60"
              >
                <badge.icon weight="fill" className="w-3.5 h-3.5 text-emerald-400" />
                {badge.label}
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Link
              href="/signup"
              id="hero-cta-signup"
              className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold px-7 py-3.5 rounded-xl transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105"
            >
              Start building free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="#demo"
              id="hero-cta-demo"
              className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-7 py-3.5 rounded-xl transition-all"
            >
              <Play weight="fill" className="w-4 h-4 text-emerald-400" />
              Watch demo
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right – animated terminal */}
        <div className="hidden lg:block">
          <AnimatedTerminal />

          {/* Floating status cards */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <span className="text-base">🚀</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Deployment</div>
                <div className="text-xs text-emerald-400">Active · v2.4.1</div>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
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

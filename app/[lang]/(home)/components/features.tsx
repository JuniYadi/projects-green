"use client"

import Link from "next/link"
import {
  GitBranch,
  Timer,
  Lock,
  Globe,
  Code,
  Cpu,
  ArrowRight,
} from "@phosphor-icons/react"

const features = [
  {
    icon: GitBranch,
    title: "Git-native workflow",
    description:
      "Connect your GitHub, GitLab, or Bitbucket repo. Every push triggers a build. Every PR gets a preview URL automatically.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Timer,
    title: "Deploy in seconds",
    description:
      "Our build pipeline is fast. Most Next.js apps go live in under 30 seconds — with incremental static regeneration out of the box.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    icon: Lock,
    title: "Zero-trust security",
    description:
      "TLS everywhere, secrets vault, IP allowlisting, and audit logs. Your data stays yours with zero vendor lock-in.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    icon: Globe,
    title: "Global edge network",
    description:
      "42 PoPs across 6 continents. Static assets cached at the edge. Dynamic functions routed to the nearest region.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: Code,
    title: "Developer-first APIs",
    description:
      "OpenAPI spec with generated SDKs for TypeScript, Python, Go, and Rust. Integrate PFNApp in minutes, not days.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: Cpu,
    title: "Auto-scaling infra",
    description:
      "From zero to millions of requests without a single config change. Scale-to-zero when idle, burst on demand.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
]

const logos = [
  "Next.js", "React", "Node.js", "Go", "Python", "Rust", "Docker", "Kubernetes",
]

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-28 bg-[#07091a]">
      {/* Separator gradient from prev section */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Tech stack marquee */}
        <div className="mb-20">
          <p className="text-center text-xs text-white/30 uppercase tracking-widest mb-6">
            Works with your stack
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {logos.map((logo) => (
              <div
                key={logo}
                className="bg-white/5 border border-white/8 rounded-lg px-4 py-2 text-sm text-white/40 hover:text-white/70 hover:border-white/15 transition-all"
              >
                {logo}
              </div>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
              Built for developers
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-5 tracking-tight">
            The platform that gets{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              out of your way
            </span>
          </h2>
          <p className="text-lg text-white/40 max-w-2xl mx-auto">
            Sensible defaults, powerful overrides. Built by developers, for developers who
            care about their craft.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
          {features.map((f) => (
            <div
              key={f.title}
              className="group bg-white/[0.02] border border-white/8 hover:border-white/15 rounded-2xl p-6 transition-all duration-300 hover:bg-white/[0.05]"
            >
              <div
                className={`w-10 h-10 ${f.bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
              >
                <f.icon weight="duotone" className={`w-5 h-5 ${f.color}`} />
              </div>
              <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>

        {/* CTA bar */}
        <div className="bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 border border-white/10 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Ready to build?</h3>
            <p className="text-sm text-white/40">
              Get started in 2 minutes. No credit card required.
            </p>
          </div>
          <Link
            href="/signup"
            id="features-cta-signup"
            className="group inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-7 py-3 rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 whitespace-nowrap"
          >
            Get started free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  )
}

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
  "Next.js",
  "React",
  "Node.js",
  "Go",
  "Python",
  "Rust",
  "Docker",
  "Kubernetes",
]

export function FeaturesSection() {
  return (
    <section id="features" className="relative bg-[#07091a] py-28">
      {/* Separator gradient from prev section */}
      <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute right-0 bottom-0 left-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        {/* Tech stack marquee */}
        <div className="mb-20">
          <p className="mb-6 text-center text-xs tracking-widest text-white/30 uppercase">
            Works with your stack
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {logos.map((logo) => (
              <div
                key={logo}
                className="rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-sm text-white/40 transition-all hover:border-white/15 hover:text-white/70"
              >
                {logo}
              </div>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
            <span className="text-xs font-semibold tracking-widest text-white/50 uppercase">
              Built for developers
            </span>
          </div>
          <h2 className="mb-5 text-4xl font-bold tracking-tight text-white lg:text-5xl">
            The platform that gets{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              out of your way
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-white/40">
            Sensible defaults, powerful overrides. Built by developers, for
            developers who care about their craft.
          </p>
        </div>

        {/* Features grid */}
        <div className="mb-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/8 bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.05]"
            >
              <div
                className={`h-10 w-10 ${f.bg} mb-4 flex items-center justify-center rounded-xl transition-transform group-hover:scale-110`}
              >
                <f.icon weight="duotone" className={`h-5 w-5 ${f.color}`} />
              </div>
              <h3 className="mb-2 text-base font-bold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-white/45">
                {f.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA bar */}
        <div className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 p-8 sm:flex-row">
          <div>
            <h3 className="mb-1 text-xl font-bold text-white">
              Ready to build?
            </h3>
            <p className="text-sm text-white/40">
              Get started in 2 minutes. No credit card required.
            </p>
          </div>
          <Link
            href="/login/start?intent=signup"
            id="features-cta-signup"
            className="group inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 font-semibold whitespace-nowrap text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/40"
          >
            Get started free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  )
}

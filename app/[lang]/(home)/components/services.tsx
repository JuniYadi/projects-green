"use client"

import {
  Cloud,
  Envelope,
  HardDrive,
  Robot,
  ShieldCheck,
  ChartLineUp,
  ArrowRight,
} from "@phosphor-icons/react"

const services = [
  {
    id: "hosting",
    icon: Cloud,
    gradient: "from-emerald-500 to-teal-500",
    glow: "shadow-emerald-500/20",
    bgGlow: "bg-emerald-500/5",
    borderHover: "hover:border-emerald-500/30",
    title: "App Hosting",
    subtitle: "Deploy anything, anywhere",
    description:
      "Zero-config deployment for Next.js, React, Node.js, and more. Git-push to deploy with automatic SSL, CDN, and scaling.",
    features: ["Auto-scaling", "Preview environments", "Zero downtime deploys", "Edge network"],
    badge: "Most popular",
    badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  {
    id: "communication",
    icon: Envelope,
    gradient: "from-violet-500 to-purple-500",
    glow: "shadow-violet-500/20",
    bgGlow: "bg-violet-500/5",
    borderHover: "hover:border-violet-500/30",
    title: "Communication",
    subtitle: "Email · SMS · Push · Voice",
    description:
      "Unified messaging API to reach your users anywhere. High deliverability with real-time analytics and smart routing.",
    features: ["99.5% deliverability", "SMTP relay", "SMS gateway", "Webhooks"],
    badge: null,
    badgeColor: "",
  },
  {
    id: "storage",
    icon: HardDrive,
    gradient: "from-blue-500 to-cyan-500",
    glow: "shadow-blue-500/20",
    bgGlow: "bg-blue-500/5",
    borderHover: "hover:border-blue-500/30",
    title: "Storage S3",
    subtitle: "S3-compatible object storage",
    description:
      "Fully compatible S3 API to store any file at any scale. Built-in CDN delivery, lifecycle policies, and access controls.",
    features: ["S3-compatible API", "Global CDN", "Versioning", "Lifecycle rules"],
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
    title: "AI Services",
    subtitle: "LLM inference & embeddings",
    description:
      "Run AI models at scale with a single API. Embeddings, completions, and vision — all with token-level billing.",
    features: ["OpenAI-compatible", "Low-latency inference", "Streaming", "Vector search"],
    badge: "New",
    badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  {
    id: "security",
    icon: ShieldCheck,
    gradient: "from-red-500 to-rose-500",
    glow: "shadow-red-500/20",
    bgGlow: "bg-red-500/5",
    borderHover: "hover:border-red-500/30",
    title: "Security & Auth",
    subtitle: "Identity & access management",
    description:
      "Enterprise-grade authentication with SSO, MFA, and fine-grained RBAC. SOC 2 certified with audit logs.",
    features: ["SSO / SAML", "MFA", "RBAC", "Audit logs"],
    badge: null,
    badgeColor: "",
  },
  {
    id: "analytics",
    icon: ChartLineUp,
    gradient: "from-pink-500 to-fuchsia-500",
    glow: "shadow-pink-500/20",
    bgGlow: "bg-pink-500/5",
    borderHover: "hover:border-pink-500/30",
    title: "Analytics",
    subtitle: "Real-time insights",
    description:
      "Understand your users and infrastructure at a glance. Custom dashboards, alerts, and API usage metrics.",
    features: ["Real-time metrics", "Custom dashboards", "Alerting", "Log aggregation"],
    badge: "Coming soon",
    badgeColor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  },
]

export function ServicesSection() {
  return (
    <section id="services" className="relative py-28 bg-[#060b18]">
      {/* Section glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(16,185,129,0.06),transparent)]" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
              Platform Services
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-5 tracking-tight">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              ship & scale
            </span>
          </h2>
          <p className="text-lg text-white/40 max-w-2xl mx-auto">
            One platform, six powerful services. Build your entire product stack without
            juggling multiple vendors.
          </p>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((service) => (
            <div
              key={service.id}
              id={service.id}
              className={`group relative bg-white/[0.03] border border-white/8 ${service.borderHover} rounded-2xl p-6 transition-all duration-300 hover:bg-white/[0.06] cursor-pointer`}
            >
              {/* Glow on hover */}
              <div
                className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${service.bgGlow} blur-xl -z-10`}
              />

              {/* Badge */}
              {service.badge && (
                <div
                  className={`absolute top-4 right-4 text-xs font-semibold border rounded-full px-2.5 py-0.5 ${service.badgeColor}`}
                >
                  {service.badge}
                </div>
              )}

              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${service.gradient} flex items-center justify-center mb-5 shadow-lg ${service.glow} group-hover:scale-110 transition-transform duration-300`}
              >
                <service.icon weight="fill" className="w-6 h-6 text-white" />
              </div>

              <h3 className="text-lg font-bold text-white mb-1">{service.title}</h3>
              <p className="text-xs text-white/40 mb-3 font-medium">{service.subtitle}</p>
              <p className="text-sm text-white/50 leading-relaxed mb-5">{service.description}</p>

              {/* Features */}
              <div className="flex flex-wrap gap-2 mb-6">
                {service.features.map((f) => (
                  <span
                    key={f}
                    className="text-xs bg-white/5 border border-white/8 text-white/50 rounded-md px-2 py-0.5"
                  >
                    {f}
                  </span>
                ))}
              </div>

              {/* Link */}
              <div className="flex items-center gap-1 text-sm font-medium text-white/40 group-hover:text-white transition-colors">
                Learn more
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

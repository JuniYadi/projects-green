"use client"

import { useState } from "react"
import { Check, X } from "@phosphor-icons/react"

const plans = [
  {
    id: "hobby",
    name: "Hobby",
    badge: null,
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Perfect for side projects and personal experiments.",
    cta: "Start free",
    ctaHref: "/signup",
    ctaStyle: "border",
    features: [
      { label: "3 projects", included: true },
      { label: "100 GB bandwidth/mo", included: true },
      { label: "1 GB storage", included: true },
      { label: "10,000 emails/mo", included: true },
      { label: "Community support", included: true },
      { label: "Custom domains", included: false },
      { label: "Team members", included: false },
      { label: "SLA", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Most popular",
    monthlyPrice: 29,
    yearlyPrice: 23,
    description: "For startups and growing teams building real products.",
    cta: "Start 14-day trial",
    ctaHref: "/signup?plan=pro",
    ctaStyle: "gradient",
    features: [
      { label: "Unlimited projects", included: true },
      { label: "1 TB bandwidth/mo", included: true },
      { label: "100 GB storage", included: true },
      { label: "100,000 emails/mo", included: true },
      { label: "Priority support", included: true },
      { label: "Custom domains", included: true },
      { label: "5 team members", included: true },
      { label: "99.9% SLA", included: false },
    ],
  },
  {
    id: "team",
    name: "Team",
    badge: null,
    monthlyPrice: 99,
    yearlyPrice: 79,
    description: "Advanced features and dedicated support for scaling teams.",
    cta: "Start 14-day trial",
    ctaHref: "/signup?plan=team",
    ctaStyle: "border",
    features: [
      { label: "Unlimited projects", included: true },
      { label: "5 TB bandwidth/mo", included: true },
      { label: "1 TB storage", included: true },
      { label: "1M emails/mo", included: true },
      { label: "Priority support", included: true },
      { label: "Custom domains", included: true },
      { label: "25 team members", included: true },
      { label: "99.9% SLA", included: true },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    badge: null,
    monthlyPrice: null,
    yearlyPrice: null,
    description: "Custom infrastructure, SLAs, and enterprise security.",
    cta: "Contact sales",
    ctaHref: "/contact",
    ctaStyle: "border",
    features: [
      { label: "Unlimited projects", included: true },
      { label: "Unlimited bandwidth", included: true },
      { label: "Unlimited storage", included: true },
      { label: "Unlimited emails", included: true },
      { label: "Dedicated support", included: true },
      { label: "Custom domains", included: true },
      { label: "Unlimited members", included: true },
      { label: "99.99% SLA", included: true },
    ],
  },
]

export function PricingSection() {
  const [yearly, setYearly] = useState(true)

  return (
    <section id="pricing" className="relative py-28 bg-[#060b18]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_50%,rgba(6,182,212,0.07),transparent)]" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
              Pricing
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-5 tracking-tight">
            Simple,{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              transparent pricing
            </span>
          </h2>
          <p className="text-lg text-white/40 max-w-xl mx-auto mb-8">
            Start for free. Scale as you grow. No hidden fees, no surprises.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-full p-1">
            <button
              id="pricing-toggle-monthly"
              onClick={() => setYearly(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                !yearly
                  ? "bg-white text-gray-900"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              id="pricing-toggle-yearly"
              onClick={() => setYearly(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                yearly
                  ? "bg-white text-gray-900"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Yearly
              <span className="text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              id={`pricing-plan-${plan.id}`}
              className={`relative rounded-2xl border p-6 flex flex-col transition-all duration-300 ${
                plan.id === "pro"
                  ? "bg-gradient-to-b from-emerald-500/10 to-cyan-500/5 border-emerald-500/30 shadow-xl shadow-emerald-500/10 scale-[1.02]"
                  : "bg-white/[0.03] border-white/8 hover:bg-white/[0.06] hover:border-white/15"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap shadow-lg shadow-emerald-500/30">
                  {plan.badge}
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-base font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{plan.description}</p>
              </div>

              <div className="mb-6">
                {plan.monthlyPrice !== null ? (
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-white">
                      ${yearly ? plan.yearlyPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-white/40 text-sm mb-1">/mo</span>
                  </div>
                ) : (
                  <div className="text-3xl font-bold text-white">Custom</div>
                )}
                {yearly && plan.monthlyPrice !== null && plan.monthlyPrice > 0 && (
                  <div className="text-xs text-emerald-400 mt-1">
                    Save ${(plan.monthlyPrice - plan.yearlyPrice!) * 12}/year
                  </div>
                )}
              </div>

              <a
                href={plan.ctaHref}
                id={`pricing-cta-${plan.id}`}
                className={`w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all mb-6 ${
                  plan.ctaStyle === "gradient"
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/20"
                    : "border border-white/15 text-white hover:bg-white/8"
                }`}
              >
                {plan.cta}
              </a>

              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-center gap-2.5 text-sm">
                    {f.included ? (
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" weight="bold" />
                    ) : (
                      <X className="w-4 h-4 text-white/20 flex-shrink-0" weight="bold" />
                    )}
                    <span className={f.included ? "text-white/70" : "text-white/25"}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-white/30 mt-10">
          All prices in USD. Cancel anytime. No credit card required for free plan.
        </p>
      </div>
    </section>
  )
}

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
    highlight: false,
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
    ctaStyle: "primary",
    highlight: true,
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
    highlight: false,
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
    highlight: false,
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
    <section id="pricing" className="relative py-28 bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_50%,color-mix(in_oklch,var(--chart-3)_7%,transparent),transparent)]" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-secondary border border-border rounded-full px-4 py-1.5 mb-6">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Pricing
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-5 tracking-tight">
            Simple,{" "}
            <span className="bg-gradient-to-r from-chart-3 to-chart-2 bg-clip-text text-transparent">
              transparent pricing
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Start for free. Scale as you grow. No hidden fees, no surprises.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-0 bg-secondary border border-border rounded-full p-1">
            <button
              id="pricing-toggle-monthly"
              onClick={() => setYearly(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                !yearly
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              id="pricing-toggle-yearly"
              onClick={() => setYearly(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                yearly
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
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
                plan.highlight
                  ? "bg-primary/10 border-primary/30 shadow-xl shadow-primary/10 scale-[1.02]"
                  : "bg-card border-border hover:border-primary/20"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap shadow-lg shadow-primary/30">
                  {plan.badge}
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-base font-bold text-foreground mb-1">{plan.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                {plan.monthlyPrice !== null ? (
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      ${yearly ? plan.yearlyPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-muted-foreground text-sm mb-1">/mo</span>
                  </div>
                ) : (
                  <div className="text-3xl font-bold text-foreground">Custom</div>
                )}
                {yearly && plan.monthlyPrice !== null && plan.monthlyPrice > 0 && (
                  <div className="text-xs text-primary mt-1">
                    Save ${(plan.monthlyPrice - plan.yearlyPrice!) * 12}/year
                  </div>
                )}
              </div>

              <a
                href={plan.ctaHref}
                id={`pricing-cta-${plan.id}`}
                className={`w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all mb-6 ${
                  plan.ctaStyle === "primary"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                    : "border border-border text-foreground hover:bg-secondary"
                }`}
              >
                {plan.cta}
              </a>

              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-center gap-2.5 text-sm">
                    {f.included ? (
                      <Check className="w-4 h-4 text-primary flex-shrink-0" weight="bold" />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" weight="bold" />
                    )}
                    <span className={f.included ? "text-foreground/80" : "text-muted-foreground/40"}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-10">
          All prices in USD. Cancel anytime. No credit card required for free plan.
        </p>
      </div>
    </section>
  )
}

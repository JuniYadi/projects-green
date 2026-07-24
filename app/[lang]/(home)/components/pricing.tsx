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
    ctaHref: "/login/start?intent=signup",
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
    ctaHref: "/login/start?intent=signup",
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
    ctaHref: "/login/start?intent=signup",
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
    <section id="pricing" className="relative bg-background py-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_50%,color-mix(in_oklch,var(--chart-3)_7%,transparent),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mb-14 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5">
            <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Pricing
            </span>
          </div>
          <h2 className="mb-5 text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
            Simple,{" "}
            <span className="bg-gradient-to-r from-chart-3 to-chart-2 bg-clip-text text-transparent">
              transparent pricing
            </span>
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
            Start for free. Scale as you grow. No hidden fees, no surprises.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-0 rounded-full border border-border bg-secondary p-1">
            <button
              id="pricing-toggle-monthly"
              onClick={() => setYearly(false)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
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
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all ${
                yearly
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              id={`pricing-plan-${plan.id}`}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${
                plan.highlight
                  ? "scale-[1.02] border-primary/30 bg-primary/10 shadow-xl shadow-primary/10"
                  : "border-border bg-card hover:border-primary/20"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold whitespace-nowrap text-primary-foreground shadow-lg shadow-primary/30">
                  {plan.badge}
                </div>
              )}

              <div className="mb-6">
                <h3 className="mb-1 text-base font-bold text-foreground">
                  {plan.name}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                {plan.monthlyPrice !== null ? (
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      ${yearly ? plan.yearlyPrice : plan.monthlyPrice}
                    </span>
                    <span className="mb-1 text-sm text-muted-foreground">
                      /mo
                    </span>
                  </div>
                ) : (
                  <div className="text-3xl font-bold text-foreground">
                    Custom
                  </div>
                )}
                {yearly &&
                  plan.monthlyPrice !== null &&
                  plan.monthlyPrice > 0 && (
                    <div className="mt-1 text-xs text-primary">
                      Save ${(plan.monthlyPrice - plan.yearlyPrice!) * 12}/year
                    </div>
                  )}
              </div>

              <a
                href={plan.ctaHref}
                id={`pricing-cta-${plan.id}`}
                className={`mb-6 w-full rounded-xl py-2.5 text-center text-sm font-semibold transition-all ${
                  plan.ctaStyle === "primary"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                    : "border border-border text-foreground hover:bg-secondary"
                }`}
              >
                {plan.cta}
              </a>

              <ul className="flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li
                    key={f.label}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    {f.included ? (
                      <Check
                        className="h-4 w-4 flex-shrink-0 text-primary"
                        weight="bold"
                      />
                    ) : (
                      <X
                        className="h-4 w-4 flex-shrink-0 text-muted-foreground/40"
                        weight="bold"
                      />
                    )}
                    <span
                      className={
                        f.included
                          ? "text-foreground/80"
                          : "text-muted-foreground/40"
                      }
                    >
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground/50">
          All prices in USD. Cancel anytime. No credit card required for free
          plan.
        </p>
      </div>
    </section>
  )
}

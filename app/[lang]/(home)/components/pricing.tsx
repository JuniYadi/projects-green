"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Check, X } from "@phosphor-icons/react"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type PlanFeature = {
  label: string
  included: boolean
}

type PricingPlan = {
  id: string
  name: string
  badge: string | null
  monthlyPrice: number | null
  yearlyPrice: number | null
  description: string
  cta: string
  ctaHref: string
  ctaStyle: "border" | "primary"
  highlight: boolean
  features: PlanFeature[]
}
export function PricingSection() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pHomePricing

  const plans: PricingPlan[] = [
    {
      id: "hobby",
      name: t.planHobbyName,
      badge: null,
      monthlyPrice: 0,
      yearlyPrice: 0,
      description: t.planHobbyDescription,
      cta: t.planHobbyCta,
      ctaHref: "/login/start?intent=signup",
      ctaStyle: "border",
      highlight: false,
      features: [
        { label: t.feature3Projects, included: true },
        { label: t.feature100GbBandwidth, included: true },
        { label: t.feature1GbStorage, included: true },
        { label: t.feature10kEmails, included: true },
        { label: t.featureCommunitySupport, included: true },
        { label: t.featureCustomDomains, included: false },
        { label: t.featureTeamMembers, included: false },
        { label: t.featureSla, included: false },
      ],
    },
    {
      id: "pro",
      name: t.planProName,
      badge: t.planProBadge,
      monthlyPrice: 29,
      yearlyPrice: 23,
      description: t.planProDescription,
      cta: t.planProCta,
      ctaHref: "/login/start?intent=signup",
      ctaStyle: "primary",
      highlight: true,
      features: [
        { label: t.featureUnlimitedProjects, included: true },
        { label: t.feature1TbBandwidth, included: true },
        { label: t.feature100GbStorage, included: true },
        { label: t.feature100kEmails, included: true },
        { label: t.featurePrioritySupport, included: true },
        { label: t.featureCustomDomains, included: true },
        { label: t.feature5TeamMembers, included: true },
        { label: t.feature999Sla, included: false },
      ],
    },
    {
      id: "team",
      name: t.planTeamName,
      badge: null,
      monthlyPrice: 99,
      yearlyPrice: 79,
      description: t.planTeamDescription,
      cta: t.planTeamCta,
      ctaHref: "/login/start?intent=signup",
      ctaStyle: "border",
      highlight: false,
      features: [
        { label: t.featureUnlimitedProjects, included: true },
        { label: t.feature5TbBandwidth, included: true },
        { label: t.feature1TbStorage, included: true },
        { label: t.feature1mEmails, included: true },
        { label: t.featurePrioritySupport, included: true },
        { label: t.featureCustomDomains, included: true },
        { label: t.feature25TeamMembers, included: true },
        { label: t.feature999Sla, included: true },
      ],
    },
    {
      id: "enterprise",
      name: t.planEnterpriseName,
      badge: null,
      monthlyPrice: null,
      yearlyPrice: null,
      description: t.planEnterpriseDescription,
      cta: t.planEnterpriseCta,
      ctaHref: "/contact",
      ctaStyle: "border",
      highlight: false,
      features: [
        { label: t.featureUnlimitedProjects, included: true },
        { label: t.featureUnlimitedBandwidth, included: true },
        { label: t.featureUnlimitedStorage, included: true },
        { label: t.featureUnlimitedEmails, included: true },
        { label: t.featureDedicatedSupport, included: true },
        { label: t.featureCustomDomains, included: true },
        { label: t.featureUnlimitedMembers, included: true },
        { label: t.feature9999Sla, included: true },
      ],
    },
  ]

  const [yearly, setYearly] = useState(true)
  return (
    <section id="pricing" className="relative bg-background py-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_50%,color-mix(in_oklch,var(--chart-3)_7%,transparent),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mb-14 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5">
            <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              {t.badgePricing}
            </span>
          </div>
          <h2 className="mb-5 text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
            {t.headingStart}{" "}
            <span className="bg-gradient-to-r from-chart-3 to-chart-2 bg-clip-text text-transparent">
              {t.headingHighlight}
            </span>
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
            {t.subheading}
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
              {t.toggleMonthly}
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
              {t.toggleYearly}
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
                      {t.perMonth}
                    </span>
                  </div>
                ) : (
                  <div className="text-3xl font-bold text-foreground">
                    {t.priceCustom}
                  </div>
                )}
                {yearly &&
                  plan.monthlyPrice !== null &&
                  plan.monthlyPrice > 0 && (
                    <div className="mt-1 text-xs text-primary">
                      {t.saveYearly.replace(
                        "{amount}",
                        String((plan.monthlyPrice - plan.yearlyPrice!) * 12)
                      )}
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
          {t.disclaimer}
        </p>
      </div>
    </section>
  )
}

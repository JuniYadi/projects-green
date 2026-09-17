import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowRight,
  CheckCircle,
  DeviceMobile,
  ShieldCheck,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr"

import { CatalogService } from "@/modules/billing/catalog/catalog.service"
import type {
  CatalogOfferDTO,
  CatalogPlanDTO,
} from "@/modules/billing/catalog/catalog.dto"
import { formatBillingMoney } from "@/modules/billing/format-money"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { AppMessages } from "@/lib/i18n/messages/types"

const CATALOG_CURRENCY = "IDR"

export const metadata: Metadata = {
  title: "WhatsApp Official API",
  description:
    "Connect your business to WhatsApp Official API with managed plans, clear quotas, and transparent pricing.",
}

const RESOURCE_LABELS: Record<string, string> = {
  quotaIn: "Inbound quota",
  quotaOut: "Outbound quota",
  dailyPerDevice: "Daily messages per device",
  devices: "Connected devices",
}

const formatResourceLabel = (key: string) => {
  if (RESOURCE_LABELS[key]) return RESOURCE_LABELS[key]

  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (char) => char.toUpperCase())
}

const formatResourceValue = (value: unknown) => {
  if (value === null || value === undefined) return "Unlimited"
  if (typeof value === "number") return value.toLocaleString("id-ID")
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "string") return value
  return null
}

const getPlanResources = (plan: CatalogPlanDTO) => {
  return Object.entries(plan.resources)
    .filter(
      ([key, value]) =>
        key !== "provisioningFields" &&
        key !== "features" &&
        key !== "provisioning" &&
        (value === null ||
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean")
    )
    .map(([key, value]) => ({
      label: formatResourceLabel(key),
      value: formatResourceValue(value) ?? "—",
    }))
}

const periodLabel = (offer: CatalogOfferDTO) => {
  const labels: Record<CatalogOfferDTO["billingPeriod"], string> = {
    MONTHLY: "Monthly",
    QUARTERLY: "Quarterly",
    SEMI_ANNUAL: "Every 6 months",
    ANNUAL: "Annual",
  }

  return labels[offer.billingPeriod]
}

function PlanCard({
  plan,
  currency,
  messages,
}: {
  plan: CatalogPlanDTO
  currency: string
  messages: AppMessages
}) {
  const resources = getPlanResources(plan)

  return (
    <article className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-300/70 uppercase">
            {messages.pProductsWhatsappOfficial.whatsappPlan}
          </p>
          <h3 className="mt-2 text-2xl font-bold text-white">{plan.name}</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-white/45">
          {plan.code}
        </span>
      </div>

      <div className="mt-6 space-y-3 border-y border-white/8 py-5">
        {resources.length > 0 ? (
          resources.map((resource) => (
            <div
              key={resource.label}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="text-white/55">{resource.label}</span>
              <span className="text-right font-medium text-white">
                {resource.value}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-white/55">
            {messages.pProductsWhatsappOfficial.flexibleConfiguration}
          </p>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-xs font-semibold tracking-[0.18em] text-white/40 uppercase">
          {messages.pProductsWhatsappOfficial.availableBillingTerms}
        </p>
        {plan.offers.map((offer) => (
          <div
            key={offer.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/10 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-white">
                {periodLabel(offer)}
              </p>
              <p className="mt-0.5 text-xs text-white/40">
                {offer.chargeUnit === "DEVICE"
                  ? "Billed per device"
                  : "Billed per subscription"}
              </p>
            </div>
            <p className="text-right text-sm font-semibold text-emerald-300">
              {formatBillingMoney(offer.periodPrice, currency)}
            </p>
          </div>
        ))}
      </div>

      <Link
        href="/login/start?intent=signup"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
      >
        {messages.pProductsWhatsappOfficial.startWithThisPlan}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  )
}

export default async function WhatsAppOfficialPage({
  params,
}: Readonly<{
  params: Promise<{ lang: string }>
}>) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale)

  const catalog = await new CatalogService().getProduct(
    CATALOG_CURRENCY,
    "WHATSAPP"
  )

  if (!catalog) notFound()

  const { product, currency } = catalog

  return (
    <main className="min-h-screen bg-[#060b18] text-white">
      <header className="border-b border-white/8 bg-[#060b18]/90 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/25">
              <WhatsappLogo className="h-4 w-4 text-white" weight="fill" />
            </span>
            <span className="text-lg font-bold tracking-tight text-white">
              PFN<span className="text-emerald-400">App</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden px-3 py-2 text-sm text-white/60 transition-colors hover:text-white sm:block"
            >
              {messages.pProductsWhatsappOfficial.backToHome}
            </Link>
            <Link
              href="/login/start?intent=signup"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
            >
              {messages.pProductsWhatsappOfficial.getStarted}
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative overflow-hidden border-b border-white/8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_0%,rgba(16,185,129,0.16),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="max-w-3xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-emerald-300 uppercase">
              <WhatsappLogo className="h-4 w-4" weight="fill" />
              {messages.pProductsWhatsappOfficial.officialApi}
            </div>
            <h1 className="text-4xl leading-tight font-bold tracking-tight text-white sm:text-6xl">
              {messages.pProductsWhatsappOfficial.heroHeadline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/55">
              {product.description ??
                "Manage business conversations, notifications, and customer support with WhatsApp Official API."}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login/start?intent=signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
              >
                {messages.pProductsWhatsappOfficial.createYourAccount}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#plans"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/5"
              >
                {messages.pProductsWhatsappOfficial.comparePlans}
              </Link>
            </div>
          </div>

          <div className="mt-14 grid max-w-3xl gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
              <DeviceMobile className="h-5 w-5 text-emerald-300" />
              <p className="mt-4 text-sm font-semibold text-white">
                {messages.pProductsWhatsappOfficial.managedDevices}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/45">
                {messages.pProductsWhatsappOfficial.connectDevices}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <p className="mt-4 text-sm font-semibold text-white">
                {messages.pProductsWhatsappOfficial.officialApi}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/45">
                {
                  messages.pProductsWhatsappOfficial
                    .builtForReliableCommunication
                }
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
              <CheckCircle className="h-5 w-5 text-emerald-300" />
              <p className="mt-4 text-sm font-semibold text-white">
                {messages.pProductsWhatsappOfficial.clearPricing}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/45">
                {messages.pProductsWhatsappOfficial.choosePackageVolume}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="plans" className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-emerald-300/70 uppercase">
              {messages.pProductsWhatsappOfficial.productCatalog}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {messages.pProductsWhatsappOfficial.findRightPlan}
            </h2>
            <p className="mt-3 max-w-2xl text-white/50">
              {messages.pProductsWhatsappOfficial.comparePackagesCatalog}
            </p>
          </div>
          <p className="text-sm text-white/40">
            {product.plans.length}{" "}
            {messages.pProductsWhatsappOfficial.packageUnit}
            {product.plans.length === 1 ? "" : "s"}{" "}
            {messages.pProductsWhatsappOfficial.pricesInSeparator} {currency}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {product.plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              currency={currency}
              messages={messages}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-white/8 bg-white/[0.03]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xl font-bold text-white">
              {messages.pProductsWhatsappOfficial.readyToBringBusiness}
            </p>
            <p className="mt-2 text-sm text-white/50">
              {messages.pProductsWhatsappOfficial.createAccountChoosePackage}
            </p>
          </div>
          <Link
            href="/login/start?intent=signup"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
          >
            {messages.pProductsWhatsappOfficial.getStartedFree}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}

"use client"

import Link from "next/link"
import {
  GithubLogo,
  TwitterLogo,
  DiscordLogo,
  ArrowRight,
} from "@phosphor-icons/react"

import { useParams } from "next/navigation"
import { BrandLogo } from "@/components/brand-logo"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export function CTASection() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pHomeFooter

  return (
    <section className="relative overflow-hidden bg-background py-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]" />
      <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="text-sm font-medium text-primary">
            {t.ctaJoinDevelopers}
          </span>
        </div>

        <h2 className="mb-6 text-5xl leading-[1.1] font-bold tracking-tight text-foreground lg:text-6xl">
          {t.ctaHeading}{" "}
          <span className="bg-gradient-to-r from-chart-4 via-chart-3 to-chart-2 bg-clip-text text-transparent">
            {t.ctaHeadingHighlight}
          </span>
        </h2>

        <p className="mx-auto mb-12 max-w-2xl text-xl leading-relaxed text-muted-foreground">
          {t.ctaDescription}
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href={`/${locale}/products/whatsapp-official`}
            id="cta-final-whatsapp"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-emerald-500"
          >
            {locale === "id"
              ? "Mulai Solusi WhatsApp"
              : "Get Started with WhatsApp"}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href={`/${locale}/login`}
            id="cta-final-login"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-8 py-4 text-base font-semibold text-foreground transition-all hover:bg-accent"
          >
            {locale === "id" ? "Masuk ke Konsol" : "Enter Console"}
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted-foreground/50">
          {t.ctaGuarantees}
        </p>
      </div>
    </section>
  )
}

export function Footer() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pHomeFooter

  const links: Record<
    string,
    { label: string; href: string; isRoute?: boolean }[]
  > = {
    [t.categoryProduct]: [
      { label: t.linkAppHosting, href: "#hosting" },
      { label: t.linkCommunication, href: "#communication" },
      { label: t.linkStorageS3, href: "#storage" },
      { label: t.linkAiServices, href: "#ai" },
      { label: t.linkSecurity, href: "#security" },
      { label: t.linkAnalytics, href: "#analytics" },
    ],
    [t.categoryDevelopers]: [
      { label: t.linkDocumentation, href: "#docs" },
      { label: t.linkApiReference, href: "#api" },
      { label: t.linkCli, href: "#cli" },
      { label: t.linkSdks, href: "#sdks" },
      { label: t.linkStatusPage, href: "#status" },
      { label: t.linkChangelog, href: "#changelog" },
    ],
    [t.categoryCompany]: [
      { label: t.linkAbout, href: "#about" },
      { label: t.linkBlog, href: "#blog" },
      { label: t.linkCareers, href: "#careers" },
      { label: t.linkPress, href: "#press" },
      { label: t.linkContact, href: "#contact" },
    ],
    [t.categoryLegal]: [
      { label: t.linkTermsOfService, href: "/terms", isRoute: true },
      { label: t.linkPrivacyPolicy, href: "/privacy", isRoute: true },
      {
        label: t.linkAcceptableUsePolicy,
        href: "/acceptable-use",
        isRoute: true,
      },
      { label: t.linkCookiePolicy, href: "#cookies" },
      { label: t.linkDpa, href: "#dpa" },
    ],
  }
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="group mb-4 flex items-center gap-2.5">
              <BrandLogo size="md" />
            </Link>
            <p className="mb-5 max-w-[220px] text-sm leading-relaxed text-muted-foreground">
              {t.brandDescription}
            </p>
            <div className="flex items-center gap-3">
              <a
                href="#github"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
              >
                <GithubLogo className="h-4 w-4" />
              </a>
              <a
                href="#twitter"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
              >
                <TwitterLogo className="h-4 w-4" />
              </a>
              <a
                href="#discord"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
              >
                <DiscordLogo className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="mb-4 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {items.map((link) => {
                  const href =
                    "isRoute" in link && link.isRoute
                      ? `/${locale}${link.href}`
                      : link.href
                  return (
                    <li key={link.label}>
                      <Link
                        href={href}
                        className="text-sm text-muted-foreground/70 transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground/50">{t.copyright}</p>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground/50">
              {t.allSystemsOperational}
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

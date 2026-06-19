"use client"

import Link from "next/link"
import {
  Lightning,
  GithubLogo,
  TwitterLogo,
  DiscordLogo,
  ArrowRight,
} from "@phosphor-icons/react"

const footerLinks = {
  Product: [
    { label: "App Hosting", href: "#hosting" },
    { label: "Communication", href: "#communication" },
    { label: "Storage S3", href: "#storage" },
    { label: "AI Services", href: "#ai" },
    { label: "Security", href: "#security" },
    { label: "Analytics", href: "#analytics" },
  ],
  Developers: [
    { label: "Documentation", href: "#docs" },
    { label: "API Reference", href: "#api" },
    { label: "CLI", href: "#cli" },
    { label: "SDKs", href: "#sdks" },
    { label: "Status page", href: "#status" },
    { label: "Changelog", href: "#changelog" },
  ],
  Company: [
    { label: "About", href: "#about" },
    { label: "Blog", href: "#blog" },
    { label: "Careers", href: "#careers" },
    { label: "Press", href: "#press" },
    { label: "Contact", href: "#contact" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#privacy" },
    { label: "Terms of Service", href: "#terms" },
    { label: "Cookie Policy", href: "#cookies" },
    { label: "DPA", href: "#dpa" },
  ],
}

export function CTASection() {
  return (
    <section className="relative overflow-hidden bg-background py-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]" />
      <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="text-sm font-medium text-primary">
            Join 10,000+ developers
          </span>
        </div>

        <h2 className="mb-6 text-5xl leading-[1.1] font-bold tracking-tight text-foreground lg:text-6xl">
          Your idea deserves{" "}
          <span className="bg-gradient-to-r from-chart-4 via-chart-3 to-chart-2 bg-clip-text text-transparent">
            to be live
          </span>
        </h2>

        <p className="mx-auto mb-12 max-w-2xl text-xl leading-relaxed text-muted-foreground">
          Deploy your first project for free in under 2 minutes. No credit card.
          No complex setup. Just ship.
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            id="cta-final-signup"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-2xl shadow-primary/30 transition-all hover:scale-105 hover:bg-primary/90 hover:shadow-primary/50"
          >
            Start building for free
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="#contact"
            id="cta-final-sales"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-8 py-4 text-base font-semibold text-foreground transition-all hover:bg-accent"
          >
            Talk to sales
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted-foreground/50">
          Free plan includes 3 projects · No credit card required · Cancel
          anytime
        </p>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="group mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/30">
                <Lightning
                  weight="fill"
                  className="h-4 w-4 text-primary-foreground"
                />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                PFN<span className="text-primary">App</span>
              </span>
            </Link>
            <p className="mb-5 max-w-[220px] text-sm leading-relaxed text-muted-foreground">
              The full-stack cloud platform for modern developers. Ship faster,
              scale smarter.
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
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-4 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground/70 transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground/50">
            © 2026 PFNApp. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground/50">
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

"use client"

import Link from "next/link"
import { Lightning, GithubLogo, TwitterLogo, DiscordLogo, ArrowRight } from "@phosphor-icons/react"

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
    <section className="relative py-28 bg-background overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm text-primary font-medium">Join 10,000+ developers</span>
        </div>

        <h2 className="text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight leading-[1.1]">
          Your idea deserves{" "}
          <span className="bg-gradient-to-r from-chart-4 via-chart-3 to-chart-2 bg-clip-text text-transparent">
            to be live
          </span>
        </h2>

        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
          Deploy your first project for free in under 2 minutes. No credit card. No complex
          setup. Just ship.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            id="cta-final-signup"
            className="group inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-4 rounded-xl transition-all shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 text-base"
          >
            Start building for free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="#contact"
            id="cta-final-sales"
            className="inline-flex items-center justify-center gap-2 bg-secondary hover:bg-accent border border-border text-foreground font-semibold px-8 py-4 rounded-xl transition-all text-base"
          >
            Talk to sales
          </Link>
        </div>

        <p className="text-xs text-muted-foreground/50 mt-6">
          Free plan includes 3 projects · No credit card required · Cancel anytime
        </p>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="bg-card border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                <Lightning weight="fill" className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground text-lg tracking-tight">
                PFN<span className="text-primary">App</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-[220px]">
              The full-stack cloud platform for modern developers. Ship faster, scale smarter.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="#github"
                className="w-8 h-8 bg-secondary hover:bg-accent border border-border rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
              >
                <GithubLogo className="w-4 h-4" />
              </a>
              <a
                href="#twitter"
                className="w-8 h-8 bg-secondary hover:bg-accent border border-border rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
              >
                <TwitterLogo className="w-4 h-4" />
              </a>
              <a
                href="#discord"
                className="w-8 h-8 bg-secondary hover:bg-accent border border-border rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
              >
                <DiscordLogo className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors"
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
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground/50">
            © 2026 PFNApp. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-muted-foreground/50">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

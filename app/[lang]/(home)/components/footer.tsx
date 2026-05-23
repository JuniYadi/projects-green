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
    <section className="relative py-28 bg-[#060b18] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(16,185,129,0.12),transparent)]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-emerald-400 font-medium">Join 10,000+ developers</span>
        </div>

        <h2 className="text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight leading-[1.1]">
          Your idea deserves{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            to be live
          </span>
        </h2>

        <p className="text-xl text-white/40 mb-12 max-w-2xl mx-auto leading-relaxed">
          Deploy your first project for free in under 2 minutes. No credit card. No complex
          setup. Just ship.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            id="cta-final-signup"
            className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 text-base"
          >
            Start building for free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="#contact"
            id="cta-final-sales"
            className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-8 py-4 rounded-xl transition-all text-base"
          >
            Talk to sales
          </Link>
        </div>

        <p className="text-xs text-white/25 mt-6">
          Free plan includes 3 projects · No credit card required · Cancel anytime
        </p>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="bg-[#050810] border-t border-white/8">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Lightning weight="fill" className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white text-lg tracking-tight">
                PFN<span className="text-emerald-400">App</span>
              </span>
            </Link>
            <p className="text-sm text-white/35 leading-relaxed mb-5 max-w-[220px]">
              The full-stack cloud platform for modern developers. Ship faster, scale smarter.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="#github"
                className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/8 rounded-lg flex items-center justify-center text-white/40 hover:text-white transition-all"
              >
                <GithubLogo className="w-4 h-4" />
              </a>
              <a
                href="#twitter"
                className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/8 rounded-lg flex items-center justify-center text-white/40 hover:text-white transition-all"
              >
                <TwitterLogo className="w-4 h-4" />
              </a>
              <a
                href="#discord"
                className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/8 rounded-lg flex items-center justify-center text-white/40 hover:text-white transition-all"
              >
                <DiscordLogo className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-white/35 hover:text-white transition-colors"
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
        <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/25">
            © 2026 PFNApp. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/30">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

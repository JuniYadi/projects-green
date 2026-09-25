"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { List, X, CaretDown } from "@phosphor-icons/react"

import { BrandLogo } from "@/components/brand-logo"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export function HomeNav() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const isId = locale === "id"

  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handler)
    return () => window.removeEventListener("scroll", handler)
  }, [])

  const navLinks = [
    {
      label: isId ? "Produk" : "Products",
      children: [
        {
          label: "WhatsApp Official",
          href: "/products/whatsapp-official",
          desc: isId
            ? "API pesan bisnis resmi & webhook"
            : "Business messaging API & webhooks",
        },
        {
          label: isId ? "App Hosting" : "App Hosting",
          href: "#hosting",
          desc: isId
            ? "Deploy Next.js, Node & Laravel"
            : "Deploy Next.js, Node & Laravel",
        },
        {
          label: isId ? "Secure VPN" : "Secure VPN",
          href: "#vpn",
          desc: isId
            ? "Akses jaringan pribadi & tunnel"
            : "Private network access & tunnels",
        },
        {
          label: isId ? "Penyimpanan Cloud" : "Storage S3",
          href: "#storage",
          desc: isId
            ? "Object storage kompatibel S3"
            : "Scalable S3-compatible storage",
        },
      ],
    },
    { label: isId ? "Templates" : "Templates", href: "#templates" },
    { label: isId ? "Harga" : "Pricing", href: "#pricing" },
    { label: isId ? "Dokumentasi" : "Docs", href: `/${locale}/docs` },
  ]

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-200 ${
        scrolled
          ? "border-b border-white/10 bg-[#060b18]/95 shadow-lg shadow-black/20 backdrop-blur-md"
          : "border-b border-white/5 bg-[#060b18]/80 backdrop-blur-sm"
      }`}
    >
      {/* Top Launch Announcement Bar */}
      <div className="border-b border-emerald-500/20 bg-emerald-950/40 px-4 py-1.5 text-center text-xs text-white/90 backdrop-blur-sm">
        <Link
          href="#pricing"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-emerald-300"
        >
          <span className="font-semibold text-emerald-400">
            {isId ? "🎁 BATCH 1 LAUNCHING:" : "🎁 BATCH 1 LAUNCH:"}
          </span>
          <span>
            {isId
              ? "Klaim Voucher Rp 50.000 Saldo Pertama (Sisa 18 Kuota)"
              : "Claim Rp 50,000 Credit Voucher for First Order"}
          </span>
          <span className="ml-1 font-semibold text-emerald-400 underline underline-offset-2">
            {isId ? "Klaim Sekarang →" : "Claim Now →"}
          </span>
        </Link>
      </div>

      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href={`/${locale}`} className="group flex items-center gap-2.5">
          <BrandLogo size="md" textColor="text-white" />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) =>
            link.children ? (
              <div key={link.label} className="relative">
                <button
                  className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  onMouseEnter={() => setOpenDropdown(link.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  {link.label}
                  <CaretDown
                    className={`h-3.5 w-3.5 transition-transform ${openDropdown === link.label ? "rotate-180" : ""}`}
                  />
                </button>
                {openDropdown === link.label && (
                  <div
                    className="absolute top-full left-0 mt-1 w-64 rounded-xl border border-white/10 bg-[#0d1424] p-2 shadow-2xl shadow-black/60 backdrop-blur-xl"
                    onMouseEnter={() => setOpenDropdown(link.label)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    {link.children.map((child) => (
                      <Link
                        key={child.label}
                        href={child.href}
                        className="group flex flex-col rounded-lg px-3 py-2.5 transition-colors hover:bg-white/10"
                      >
                        <span className="text-sm font-medium text-white transition-colors group-hover:text-emerald-400">
                          {child.label}
                        </span>
                        <span className="mt-0.5 text-xs text-white/50">
                          {child.desc}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={link.label}
                href={link.href!}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </Link>
            )
          )}
        </div>

        {/* CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href={`/${locale}/login`}
            className="px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:text-white"
          >
            {isId ? "Masuk" : "Sign in"}
          </Link>
          <Link
            href={`/${locale}/login?next=%2F${locale}%2Fconsole`}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-500"
          >
            {isId ? "Buka Konsol" : "Open Console"}
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="p-2 text-white/80 hover:text-white md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <List className="h-5 w-5" />
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="flex flex-col gap-2 border-t border-white/10 bg-[#0a0f1e] px-6 py-4 md:hidden">
          {navLinks.map((link) =>
            link.children ? (
              <div key={link.label}>
                <p className="px-3 py-2 text-xs font-semibold tracking-widest text-white/40 uppercase">
                  {link.label}
                </p>
                {link.children.map((child) => (
                  <Link
                    key={child.label}
                    href={child.href}
                    className="block rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
                    onClick={() => setMobileOpen(false)}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                key={link.label}
                href={link.href!}
                className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            )
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href={`/${locale}/login`}
              className="rounded-lg border border-white/10 py-2.5 text-center text-sm text-white/75 hover:bg-white/5"
            >
              {isId ? "Masuk" : "Sign in"}
            </Link>
            <Link
              href={`/${locale}/login?next=%2F${locale}%2Fconsole`}
              className="rounded-lg bg-emerald-600 py-2.5 text-center text-sm font-medium text-white"
            >
              {isId ? "Buka Konsol" : "Open Console"}
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

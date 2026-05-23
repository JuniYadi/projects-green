"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import {
  List,
  X,
  Lightning,
  CaretDown,
} from "@phosphor-icons/react"

const navLinks = [
  {
    label: "Products",
    children: [
      { label: "App Hosting", href: "#hosting", desc: "Deploy with zero config" },
      { label: "Communication", href: "#communication", desc: "Email, SMS & push" },
      { label: "Storage S3", href: "#storage", desc: "Scalable object storage" },
      { label: "AI Services", href: "#ai", desc: "Inference & embeddings" },
    ],
  },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "#docs" },
  { label: "Blog", href: "#blog" },
]

export function HomeNav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handler)
    return () => window.removeEventListener("scroll", handler)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a0f1e]/95 backdrop-blur-xl border-b border-white/8 shadow-xl shadow-black/20"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
            <Lightning weight="fill" className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">
            PFN<span className="text-emerald-400">App</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) =>
            link.children ? (
              <div key={link.label} className="relative">
                <button
                  className="flex items-center gap-1 px-4 py-2 text-sm text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                  onMouseEnter={() => setOpenDropdown(link.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  {link.label}
                  <CaretDown
                    className={`w-3 h-3 transition-transform ${openDropdown === link.label ? "rotate-180" : ""}`}
                  />
                </button>
                {openDropdown === link.label && (
                  <div
                    className="absolute top-full left-0 mt-2 w-64 bg-[#0d1424]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 p-2"
                    onMouseEnter={() => setOpenDropdown(link.label)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    {link.children.map((child) => (
                      <Link
                        key={child.label}
                        href={child.href}
                        className="flex flex-col px-3 py-2.5 rounded-lg hover:bg-white/5 group transition-colors"
                      >
                        <span className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors">
                          {child.label}
                        </span>
                        <span className="text-xs text-white/40 mt-0.5">{child.desc}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={link.label}
                href={link.href!}
                className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              >
                {link.label}
              </Link>
            )
          )}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-white/70 hover:text-white transition-colors px-4 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-5 py-2 rounded-lg hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-105"
          >
            Get started free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-white/80 hover:text-white p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <List className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0a0f1e]/98 backdrop-blur-xl border-t border-white/8 px-6 py-4 flex flex-col gap-2">
          {navLinks.map((link) =>
            link.children ? (
              <div key={link.label}>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-widest px-3 py-2">
                  {link.label}
                </p>
                {link.children.map((child) => (
                  <Link
                    key={child.label}
                    href={child.href}
                    className="block px-3 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5"
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
                className="px-3 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            )
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/login"
              className="text-center py-2.5 text-sm text-white/70 border border-white/10 rounded-lg hover:bg-white/5"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-center py-2.5 text-sm font-medium bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg"
            >
              Get started free
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

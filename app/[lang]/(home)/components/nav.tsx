"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { List, X, Lightning, CaretDown } from "@phosphor-icons/react"

const navLinks = [
  {
    label: "Products",
    children: [
      {
        label: "App Hosting",
        href: "#hosting",
        desc: "Deploy with zero config",
      },
      {
        label: "Communication",
        href: "#communication",
        desc: "Email, SMS & push",
      },
      {
        label: "Storage S3",
        href: "#storage",
        desc: "Scalable object storage",
      },
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
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/8 bg-[#0a0f1e]/95 shadow-xl shadow-black/20 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/30 transition-transform group-hover:scale-105">
            <Lightning weight="fill" className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            PFN<span className="text-emerald-400">App</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) =>
            link.children ? (
              <div key={link.label} className="relative">
                <button
                  className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                  onMouseEnter={() => setOpenDropdown(link.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  {link.label}
                  <CaretDown
                    className={`h-3 w-3 transition-transform ${openDropdown === link.label ? "rotate-180" : ""}`}
                  />
                </button>
                {openDropdown === link.label && (
                  <div
                    className="absolute top-full left-0 mt-2 w-64 rounded-xl border border-white/10 bg-[#0d1424]/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
                    onMouseEnter={() => setOpenDropdown(link.label)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    {link.children.map((child) => (
                      <Link
                        key={child.label}
                        href={child.href}
                        className="group flex flex-col rounded-lg px-3 py-2.5 transition-colors hover:bg-white/5"
                      >
                        <span className="text-sm font-medium text-white transition-colors group-hover:text-emerald-400">
                          {child.label}
                        </span>
                        <span className="mt-0.5 text-xs text-white/40">
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
                className="rounded-lg px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </Link>
            )
          )}
        </div>

        {/* CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-white/70 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 hover:from-emerald-400 hover:to-cyan-400 hover:shadow-emerald-500/40"
          >
            Get started free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
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
        <div className="flex flex-col gap-2 border-t border-white/8 bg-[#0a0f1e]/98 px-6 py-4 backdrop-blur-xl md:hidden">
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
              href="/login"
              className="rounded-lg border border-white/10 py-2.5 text-center text-sm text-white/70 hover:bg-white/5"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 py-2.5 text-center text-sm font-medium text-white"
            >
              Get started free
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

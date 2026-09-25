"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { CaretDown, List, Moon, Sun, X } from "@phosphor-icons/react"

import { CountryFlag } from "@/components/ui/country-flag"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

function ThemeSwitch({ isId }: { isId: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  return (
    <button
      type="button"
      disabled={!mounted}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={isId ? "Ganti tema" : "Switch theme"}
      className="rounded-lg p-2 text-slate-600 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:opacity-50 dark:text-white/75 dark:hover:bg-white/10"
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="size-5" aria-hidden="true" />
      ) : (
        <Moon className="size-5" aria-hidden="true" />
      )}
    </button>
  )
}

function LanguageMenu({ locale }: { locale: "id" | "en" }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={locale === "id" ? "Pilih bahasa" : "Choose language"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1 rounded-lg p-2 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:hover:bg-white/10"
      >
        <CountryFlag
          country={locale === "id" ? "ID" : "US"}
          aria-hidden="true"
        />
        <CaretDown
          className="size-3 text-slate-600 dark:text-white/70"
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="relative z-10 mt-1 min-w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl md:absolute md:right-0 dark:border-white/10 dark:bg-[#0d1424]">
          {(
            [
              { lang: "id", country: "ID", label: "Indonesia" },
              { lang: "en", country: "US", label: "English" },
            ] as const
          ).map((option) => (
            <Link
              key={option.lang}
              href={`/${option.lang}`}
              lang={option.lang}
              aria-current={option.lang === locale ? "page" : undefined}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-800 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10"
            >
              <CountryFlag country={option.country} aria-hidden="true" />
              {option.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function HomeNav() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const isId = locale === "id"
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [productOpen, setProductOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handler)
    return () => window.removeEventListener("scroll", handler)
  }, [])

  const products = [
    {
      label: "WhatsApp Official",
      href: `/${locale}/products/whatsapp-official`,
      desc: isId ? "API pesan bisnis resmi" : "Official business messaging",
    },
    {
      label: "App Hosting",
      href: `/${locale}#templates`,
      desc: isId ? "Template dan repo Git" : "Templates and Git repositories",
    },
    {
      label: "WireGuard VPN",
      href: `/${locale}#vpn`,
      desc: isId ? "Akses jaringan privat" : "Private network access",
    },
  ]

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md ${
        scrolled
          ? "border-slate-200 bg-white/95 shadow-sm dark:border-white/10 dark:bg-[#060b18]/95"
          : "border-slate-200 bg-white/85 dark:border-white/5 dark:bg-[#060b18]/85"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2"
          aria-label="PFNApp"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt=""
            width={36}
            height={36}
            className="size-9 object-contain"
          />
          <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            PFN
            <span className="text-emerald-600 dark:text-emerald-400">App</span>
          </span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <div
            className="relative"
            onMouseEnter={() => setProductOpen(true)}
            onMouseLeave={() => setProductOpen(false)}
          >
            <button
              type="button"
              aria-expanded={productOpen}
              onClick={() => setProductOpen((open) => !open)}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-white/75 dark:hover:bg-white/10"
            >
              {isId ? "Produk" : "Products"}
              <CaretDown className="size-4" aria-hidden="true" />
            </button>
            {productOpen && (
              <div className="absolute top-full left-0 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#0d1424]">
                {products.map((product) => (
                  <Link
                    key={product.label}
                    href={product.href}
                    className="flex flex-col rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {product.label}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-white/50">
                      {product.desc}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link
            href={`/${locale}#why-us`}
            className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-white/75 dark:hover:bg-white/10"
          >
            Why Us
          </Link>
          <Link
            href={`/${locale}#templates`}
            className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-white/75 dark:hover:bg-white/10"
          >
            Templates
          </Link>
          <Link
            href={`/${locale}/docs`}
            className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-white/75 dark:hover:bg-white/10"
          >
            {isId ? "Dokumentasi" : "Docs"}
          </Link>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeSwitch isId={isId} />
          <LanguageMenu locale={locale} />
          <Link
            href={`/${locale}/login?next=%2F${locale}%2Fconsole`}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            {isId ? "Masuk ke Konsol" : "Sign in to Console"}
          </Link>
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="p-2 text-slate-700 md:hidden dark:text-white/80"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="size-5" /> : <List className="size-5" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="flex flex-col border-t border-slate-200 bg-white px-6 py-4 md:hidden dark:border-white/10 dark:bg-[#0a0f1e]">
          {products.map((product) => (
            <Link
              key={product.label}
              href={product.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-white/75"
            >
              {product.label}
            </Link>
          ))}
          <Link
            href={`/${locale}#why-us`}
            onClick={() => setMobileOpen(false)}
            className="rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-white/75"
          >
            Why Us
          </Link>
          <Link
            href={`/${locale}#templates`}
            onClick={() => setMobileOpen(false)}
            className="rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-white/75"
          >
            Templates
          </Link>
          <Link
            href={`/${locale}/docs`}
            onClick={() => setMobileOpen(false)}
            className="rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-white/75"
          >
            {isId ? "Dokumentasi" : "Docs"}
          </Link>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 py-3 dark:border-white/10">
            <ThemeSwitch isId={isId} />
            <LanguageMenu locale={locale} />
          </div>
          <Link
            href={`/${locale}/login?next=%2F${locale}%2Fconsole`}
            className="rounded-lg bg-emerald-600 py-2.5 text-center text-sm font-medium text-white"
          >
            {isId ? "Masuk ke Konsol" : "Sign in to Console"}
          </Link>
        </div>
      )}
    </header>
  )
}

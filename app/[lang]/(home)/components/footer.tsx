"use client"

import Link from "next/link"
import { ArrowRight } from "@phosphor-icons/react"

import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export function CTASection() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const isId = locale === "id"

  return (
    <section className="border-t border-slate-200 bg-slate-100 py-20 text-slate-950 dark:border-white/10 dark:bg-[#0c1420] dark:text-white">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          {isId
            ? "Sudah tahu aplikasi yang ingin dijalankan?"
            : "Know what you want to run?"}
        </h2>
        <p className="mt-4 max-w-xl text-slate-600 dark:text-white/60">
          {isId
            ? "Pilih template yang tersedia atau mulai dari repo Git Anda."
            : "Choose an available template or start with your Git repository."}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <Link
            href={`/${locale}#templates`}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-500"
          >
            {isId ? "Pilih template" : "Choose a template"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/login?next=%2F${locale}%2Fconsole%2Fapp%2Fdeploy`}
            className="font-medium text-slate-700 hover:text-slate-950 dark:text-white/75 dark:hover:text-white"
          >
            {isId ? "Deploy dari Git →" : "Deploy from Git →"}
          </Link>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pHomeFooter

  const links: Record<string, { label: string; href: string }[]> = {
    [t.categoryProduct]: [
      { label: "Why Us", href: `/${locale}#why-us` },
      { label: "Templates", href: `/${locale}#templates` },
      {
        label: "WhatsApp Official",
        href: `/${locale}/products/whatsapp-official`,
      },
      { label: "WireGuard VPN", href: `/${locale}#vpn` },
    ],
    [t.categoryDevelopers]: [
      { label: t.linkDocumentation, href: `/${locale}/docs` },
    ],
    [t.categoryLegal]: [
      { label: t.linkTermsOfService, href: `/${locale}/terms` },
      { label: t.linkPrivacyPolicy, href: `/${locale}/privacy` },
      {
        label: t.linkAcceptableUsePolicy,
        href: `/${locale}/acceptable-use`,
      },
    ],
  }
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2">
            <Link
              href={`/${locale}`}
              className="mb-4 flex items-center gap-2"
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
                <span className="text-emerald-600 dark:text-emerald-400">
                  App
                </span>
              </span>
            </Link>
            <p className="mb-5 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
              {locale === "id"
                ? "Ide besar perlu lebih dari rencana. Bangun dan kembangkan bersama PFNApp."
                : "Big ideas need more than a plan. Build and grow with PFNApp."}
            </p>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="mb-4 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {items.map((link) => {
                  return (
                    <li key={link.label}>
                      <Link
                        href={link.href}
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

import Link from "next/link"
import {
  Lightning,
  ArrowLeft,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr"
import { locales, type AppLocale } from "@/lib/i18n/config"
import { getMessages } from "@/lib/i18n/messages"
import { Footer } from "@/app/[lang]/(home)/components/footer"

export type LegalDocType = "terms" | "privacy" | "acceptable-use"

interface LegalPageLayoutProps {
  locale: AppLocale
  activeDoc: LegalDocType
  children: React.ReactNode
}

export function LegalPageLayout({
  locale,
  activeDoc,
  children,
}: LegalPageLayoutProps) {
  const messages = getMessages(locale)
  const legal = messages.legal

  const docNavItems: Array<{
    type: LegalDocType
    label: string
    href: string
  }> = [
    {
      type: "terms",
      label: legal.navigation.terms,
      href: `/${locale}/terms`,
    },
    {
      type: "privacy",
      label: legal.navigation.privacy,
      href: `/${locale}/privacy`,
    },
    {
      type: "acceptable-use",
      label: legal.navigation.acceptableUse,
      href: `/${locale}/acceptable-use`,
    },
  ]

  const currentLocaleIndex = locales.indexOf(locale)
  const otherLocale =
    locales[(currentLocaleIndex + 1) % locales.length] ?? locale
  const switchLocaleHref = `/${otherLocale}/${activeDoc}`

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}`}
              className="group flex items-center gap-2.5 transition-transform hover:scale-105"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-md shadow-emerald-500/20">
                <Lightning weight="fill" className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                PFN<span className="text-emerald-500">App</span>
              </span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="font-medium">Legal Center</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={switchLocaleHref}
              className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {locale === "en" ? "🇮🇩 Bahasa Indonesia" : "🇺🇸 English"}
            </Link>
            <Link
              href={`/${locale}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/80 px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {legal.navigation.backToHome}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          {/* Navigation Sidebar */}
          <aside className="md:col-span-4 lg:col-span-3">
            <div className="sticky top-24 rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
              <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Policies & Agreements
              </p>
              <nav
                aria-label="Legal document navigation"
                className="space-y-1.5"
              >
                {docNavItems.map((item) => {
                  const isActive = item.type === activeDoc
                  return (
                    <Link
                      key={item.type}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>

              <hr className="my-5 border-border/60" />

              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">Entity:</span>{" "}
                  {legal.companyName}
                </p>
                <p>
                  <span className="font-semibold text-foreground">
                    Contact:
                  </span>{" "}
                  <a
                    href={`mailto:${legal.contactEmail}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {legal.contactEmail}
                  </a>
                </p>
              </div>
            </div>
          </aside>

          {/* Policy Document Content */}
          <main className="md:col-span-8 lg:col-span-9">
            <div className="rounded-2xl border border-border/80 bg-card p-8 shadow-sm sm:p-12">
              {children}
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
}

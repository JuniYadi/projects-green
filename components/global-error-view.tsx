"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { CountryFlag } from "@/components/ui/country-flag"
import { ArrowClockwise, WarningCircle } from "@/components/ui/phosphor-icons"
import { ThemeToggle } from "@/components/theme-toggle"
import { defaultLocale, type AppLocale } from "@/lib/i18n/config"
import { getMessages } from "@/lib/i18n/messages"
import {
  getLocaleFromPathname,
  localizePathname,
} from "@/lib/i18n/pathname"

export function GlobalErrorView({
  error,
  reset,
  forcedLocale,
}: {
  error: Error & { digest?: string }
  reset: () => void
  forcedLocale?: AppLocale
}) {
  const pathname = usePathname() || ""
  const { locale, pathnameWithoutLocale } = getLocaleFromPathname(pathname)
  const activeLocale = forcedLocale ?? locale ?? defaultLocale
  const messages = getMessages(activeLocale)
  const t = messages.sharedComponents.errorBoundary
  const copyright = messages.pHomeFooter.copyright

  const fallbackHref = localizePathname({
    pathname: "/",
    locale: activeLocale,
  })

  const alternateLocale: AppLocale = activeLocale === "id" ? "en" : "id"
  const alternateLocaleLabel = activeLocale === "id" ? "English" : "Indonesia"
  const alternateLocaleHref = localizePathname({
    pathname: pathnameWithoutLocale,
    locale: alternateLocale,
  })

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href={fallbackHref}
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
            aria-label="PFNApp"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.png"
              alt=""
              width={32}
              height={32}
              className="size-8 object-contain"
            />
            <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
              PFN
              <span className="text-emerald-600 dark:text-emerald-400">
                App
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link
                href={alternateLocaleHref}
                lang={alternateLocale}
                aria-label={`Switch to ${alternateLocaleLabel}`}
              >
                <CountryFlag
                  country={alternateLocale === "id" ? "ID" : "US"}
                  aria-hidden="true"
                />
                <span className="font-mono uppercase">{alternateLocale}</span>
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-lg rounded-2xl border border-border/70 bg-card/80 p-6 text-center shadow-sm backdrop-blur-md sm:p-10">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-border/80 bg-rose-500/10 text-rose-500 shadow-inner dark:bg-rose-500/20">
            <WarningCircle size={32} weight="duotone" aria-hidden="true" />
          </div>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/60 px-3 py-1 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-rose-500" />
            {t.statusBadge}
          </div>

          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t.title}
          </h1>

          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t.description}
          </p>

          {error?.digest && (
            <div className="mt-4 flex items-center justify-center">
              <div className="rounded border border-border/60 bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/70">
                  {t.digestLabel}{" "}
                </span>
                <span>{error.digest}</span>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
              onClick={() => reset()}
            >
              <ArrowClockwise className="mr-1.5 size-4" />
              {t.retry}
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full border-border/80 sm:w-auto"
            >
              <Link href={fallbackHref}>{t.goHome}</Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground">
        <p>{copyright}</p>
      </footer>
    </div>
  )
}

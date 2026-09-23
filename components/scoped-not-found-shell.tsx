"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { defaultLocale } from "@/lib/i18n/config"
import { getMessages } from "@/lib/i18n/messages"
import { getLocaleFromPathname, localizePathname } from "@/lib/i18n/pathname"

export function ScopedNotFoundShell({
  surface,
  fallbackPath,
}: {
  surface: "portal" | "console"
  fallbackPath: "/portal" | "/console"
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { locale } = getLocaleFromPathname(pathname)
  const activeLocale = locale ?? defaultLocale
  const t = getMessages(activeLocale).sharedComponents.notFound
  const fallbackHref = localizePathname({
    pathname: fallbackPath,
    locale: activeLocale,
  })

  const handleGoBack = () => {
    router.push(fallbackHref)
  }

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-muted-foreground">
          {t.description.replace("{surface}", surface)}
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button onClick={handleGoBack} variant="outline">
          {t.goBack}
        </Button>
        <Link
          href={fallbackHref}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t.returnTo} {surface}
        </Link>
      </div>
    </div>
  )
}

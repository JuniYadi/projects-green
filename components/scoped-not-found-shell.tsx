"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { defaultLocale } from "@/lib/i18n/config"
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
  const fallbackHref = localizePathname({
    pathname: fallbackPath,
    locale: activeLocale,
  })

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground">
          This {surface} page does not exist or is no longer available.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button onClick={handleGoBack} variant="outline">
          Go back
        </Button>
        <Link
          href={fallbackHref}
          className="text-sm font-medium text-primary hover:underline"
        >
          Return to {surface}
        </Link>
      </div>
    </div>
  )
}

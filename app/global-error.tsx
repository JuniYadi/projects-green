"use client"

import { defaultLocale } from "@/lib/i18n/config"
import { GlobalErrorView } from "@/components/global-error-view"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang={defaultLocale}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <GlobalErrorView
          error={error}
          reset={reset}
          forcedLocale={defaultLocale}
        />
      </body>
    </html>
  )
}

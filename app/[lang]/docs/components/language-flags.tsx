"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface LanguageFlagsProps {
  currentLang: string
}

export function LanguageFlags({ currentLang }: LanguageFlagsProps) {
  const pathname = usePathname()

  // Replace /en/... with /id/... and vice versa
  const getLocalizedPath = (targetLang: string) => {
    if (!pathname) return `/${targetLang}/docs`
    const segments = pathname.split("/").filter(Boolean)
    if (segments.length > 0 && (segments[0] === "en" || segments[0] === "id")) {
      segments[0] = targetLang
      return `/${segments.join("/")}`
    }
    return `/${targetLang}${pathname}`
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-card/60 p-1 shadow-sm backdrop-blur-sm">
      {/* English / UK or US Flag */}
      <Link
        href={getLocalizedPath("en")}
        title="English"
        className={`flex size-7 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
          currentLang === "en"
            ? "bg-emerald-500/20 text-emerald-500 shadow-xs ring-1 ring-emerald-500/40"
            : "opacity-60 hover:bg-muted hover:opacity-100"
        }`}
      >
        <span className="text-sm select-none" role="img" aria-label="English">
          🇺🇸
        </span>
      </Link>

      {/* Indonesian Flag */}
      <Link
        href={getLocalizedPath("id")}
        title="Bahasa Indonesia"
        className={`flex size-7 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
          currentLang === "id"
            ? "bg-emerald-500/20 text-emerald-500 shadow-xs ring-1 ring-emerald-500/40"
            : "opacity-60 hover:bg-muted hover:opacity-100"
        }`}
      >
        <span
          className="text-sm select-none"
          role="img"
          aria-label="Bahasa Indonesia"
        >
          🇮🇩
        </span>
      </Link>
    </div>
  )
}

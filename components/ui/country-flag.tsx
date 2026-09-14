"use client"

import * as React from "react"
import { hasFlag } from "country-flag-icons"
import * as Flags from "country-flag-icons/react/3x2"

export interface CountryFlagProps extends React.SVGAttributes<SVGSVGElement> {
  /** ISO 3166-1 alpha-2 country code (e.g. "ID", "US", "ES") or Unicode flag emoji (e.g. "🇮🇩", "🇺🇸") */
  country?: string | null
  title?: string
  /** Optional fallback to render if flag cannot be resolved */
  fallback?: React.ReactNode
}

type FlagComponent = React.ComponentType<
  React.SVGAttributes<SVGSVGElement> & { title?: string }
>

const FLAGS_MAP = Flags as unknown as Record<string, FlagComponent>

export function emojiToCountryCode(input: string): string | null {
  if (!input) return null
  const chars = [...input]
  if (chars.length === 2) {
    const cp0 = chars[0].codePointAt(0) ?? 0
    const cp1 = chars[1].codePointAt(0) ?? 0
    if (cp0 >= 0x1f1e6 && cp0 <= 0x1f1ff && cp1 >= 0x1f1e6 && cp1 <= 0x1f1ff) {
      return String.fromCharCode(cp0 - 0x1f1e6 + 65, cp1 - 0x1f1e6 + 65)
    }
  }
  return null
}

export function CountryFlag({
  country,
  className = "inline-block h-3.5 w-5 shrink-0 rounded-2xs object-cover shadow-2xs",
  title,
  fallback = null,
  ...props
}: CountryFlagProps) {
  if (!country) return fallback ? <>{fallback}</> : null

  const resolved = emojiToCountryCode(country) ?? country.trim().toUpperCase()
  if (!hasFlag(resolved)) return fallback ? <>{fallback}</> : null

  const Flag = FLAGS_MAP[resolved]
  if (!Flag) return fallback ? <>{fallback}</> : null

  return <Flag className={className} title={title ?? resolved} {...props} />
}

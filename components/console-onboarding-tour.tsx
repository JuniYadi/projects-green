"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import type { AppLocale } from "@/lib/i18n/config"
import { getLocaleFromPathname } from "@/lib/i18n/pathname"
import { runConsoleTour } from "@/lib/onboarding/console-tour"

export function ConsoleOnboardingTour() {
  const pathname = usePathname()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) {
      return
    }

    const { locale } = getLocaleFromPathname(pathname)
    const activeLocale = (locale === "id" ? "id" : "en") as AppLocale

    const checkAndStartTour = () => {
      // If language prompt dialog or another modal is open, wait before launching tour
      const isModalOpen = Boolean(
        document.querySelector('[role="dialog"]') ||
        document.querySelector("[data-radix-portal]")
      )

      if (isModalOpen) {
        // Re-check after 1 second
        return window.setTimeout(checkAndStartTour, 1000)
      }

      startedRef.current = true
      void runConsoleTour({
        locale: activeLocale,
      })
      return null
    }

    let timer: ReturnType<typeof setTimeout> | null = window.setTimeout(() => {
      timer = checkAndStartTour()
    }, 800)

    return () => {
      if (timer) {
        window.clearTimeout(timer)
      }
    }
  }, [pathname])

  return null
}

"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AppLocale } from "@/lib/i18n/config"
import {
  buildLocalizedPath,
  getBrowserLocaleDetails,
  getBrowserStorage,
  readIndonesianLocalePreference,
  setLocaleCookie,
  shouldRunIndonesianLocaleCue,
  shouldShowIndonesianLocalePrompt,
  type IndonesianLocaleDecision,
  writeIndonesianLocalePreference,
} from "@/lib/i18n/indonesian-locale"
import {
  runIndonesianLocaleCue,
  type IndonesianLocaleCueMessages,
} from "@/lib/i18n/indonesian-locale-cue"

type IndonesianLocaleControlMessages = IndonesianLocaleCueMessages & {
  controlLabel: string
  currentLanguageLabel: string
  englishLabel: string
  indonesianLabel: string
  promptTitle: string
  promptDescription: string
  stayAction: string
  switchAction: string
}

type IndonesianLocaleControlProps = {
  locale: AppLocale
  messages: IndonesianLocaleControlMessages
}

export function IndonesianLocaleControl({
  locale,
  messages,
}: IndonesianLocaleControlProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const controlRef = useRef<HTMLButtonElement>(null)
  const cueStartedRef = useRef(false)
  const cueCleanupRef = useRef<(() => void) | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [cueDecision, setCueDecision] =
    useState<IndonesianLocaleDecision | null>(null)

  useEffect(() => {
    const preference = readIndonesianLocalePreference(getBrowserStorage())
    const timer = window.setTimeout(() => {
      // If Driver.js tour is currently active, avoid racing with dialog prompt
      const isTourActive = Boolean(
        document.querySelector(".driver-popover") ||
        document.querySelector(".driver-overlay")
      )
      if (isTourActive) {
        return
      }

      if (
        shouldShowIndonesianLocalePrompt({
          locale,
          preference,
          browserDetails: getBrowserLocaleDetails(),
        })
      ) {
        setPromptOpen(true)
        return
      }

      if (preference && shouldRunIndonesianLocaleCue(preference)) {
        setCueDecision(preference.decision)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [locale])

  useEffect(() => {
    if (!cueDecision || cueStartedRef.current) {
      return
    }

    cueStartedRef.current = true
    writeIndonesianLocalePreference({
      storage: getBrowserStorage(),
      decision: cueDecision,
      cueShown: true,
    })

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let cancelled = false

    void runIndonesianLocaleCue({
      target: controlRef.current,
      messages,
      reducedMotion,
    })
      .then((cleanup) => {
        if (cancelled) {
          cleanup?.()
          return
        }
        cueCleanupRef.current = cleanup
      })
      .catch(() => {})

    return () => {
      cancelled = true
      cueCleanupRef.current?.()
      cueCleanupRef.current = null
    }
  }, [cueDecision, messages])

  const targetPath = (nextLocale: AppLocale) =>
    buildLocalizedPath({
      pathname,
      search: searchParams.toString(),
      locale: nextLocale,
    })

  const decide = (decision: IndonesianLocaleDecision) => {
    setPromptOpen(false)
    writeIndonesianLocalePreference({
      storage: getBrowserStorage(),
      decision,
    })

    if (decision === "stay") {
      setCueDecision(decision)
      return
    }

    setLocaleCookie("id")
    router.replace(targetPath("id"))
  }

  return (
    <Dialog
      open={promptOpen}
      onOpenChange={(open) => {
        if (!open && promptOpen) {
          decide("stay")
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{messages.promptTitle}</DialogTitle>
          <DialogDescription>{messages.promptDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => decide("stay")}>
            {messages.stayAction}
          </Button>
          <Button onClick={() => decide("switch")}>
            {messages.switchAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
  /* Cleaned up floating language button: language switcher is hosted in NavUser (bottom left) */
}

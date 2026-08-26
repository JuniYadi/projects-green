"use client"

import { useEffect, useState } from "react"
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
  shouldShowIndonesianLocalePrompt,
  type IndonesianLocaleDecision,
  writeIndonesianLocalePreference,
} from "@/lib/i18n/indonesian-locale"

export type IndonesianLocaleControlMessages = {
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
  const [promptOpen, setPromptOpen] = useState(false)

  useEffect(() => {
    const preference = readIndonesianLocalePreference(getBrowserStorage())
    const timer = window.setTimeout(() => {
      if (
        shouldShowIndonesianLocalePrompt({
          locale,
          preference,
          browserDetails: getBrowserLocaleDetails(),
        })
      ) {
        setPromptOpen(true)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [locale])

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
}

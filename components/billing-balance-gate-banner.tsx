"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { FiAlertTriangle, FiArrowUpCircle, FiX } from "react-icons/fi"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  AlertAction,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const DISMISSED_KEY = "billing-balance-banner-dismissed"

type BillingBalanceGateBannerProps = {
  /** Formatted balance, e.g. "IDR 0.00". */
  formattedBalance: string
  /** Localized top-up URL. */
  topupUrl: string
  /** True when the balance is zero (stronger CTA than merely low). */
  isZero: boolean
}

/**
 * Console banner shown when balance is zero or below the low-balance threshold.
 * User can dismiss it — preference is stored in localStorage.
 */
export function BillingBalanceGateBanner({
  formattedBalance,
  topupUrl,
  isZero,
}: BillingBalanceGateBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem(DISMISSED_KEY) === "true"
      } catch {
        return false
      }
    }
    return true
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const handleDismiss = () => {
    setDismissed(true)

    try {
      localStorage.setItem(DISMISSED_KEY, "true")
    } catch {
      // Storage may be unavailable; in-memory dismissal still applies.
    }
  }


  if (!mounted || dismissed) return null

  return (
    <div className="px-6 pb-4">
      <Alert variant="destructive">
        <FiAlertTriangle />
        <AlertTitle>
          {isZero ? "No balance available" : "Low balance"}
        </AlertTitle>
        <AlertDescription>
          Your balance is {formattedBalance}. Top up before purchasing a package
          or your purchase will be declined.
        </AlertDescription>
        <AlertAction className="!right-3 flex flex-row items-center gap-2">
          <Button
            asChild
            variant="default"
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            aria-label="Top up balance"
            title="Top up balance"
          >
            <Link href={topupUrl}>
              <FiArrowUpCircle className="size-4" />
              Top up
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleDismiss}
            className="text-foreground/50 hover:bg-foreground/10 hover:text-foreground"
            aria-label="Dismiss alert"
            title="Dismiss"
          >
            <FiX className="size-4" />
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import {
  Eye,
  EyeSlash,
  Lightning,
  WalletIcon,
} from "@/components/ui/phosphor-icons"
import { Button } from "@/components/ui/button"
import { getAccount, type BillingAccount } from "@/lib/billing-client"
import { QuickTopUpDialog } from "@/components/billing/quick-top-up-dialog"
import { cn } from "@/lib/utils"

export interface CompactBalanceBadgeProps {
  initialAccount?: BillingAccount | null
  className?: string
  lang?: string
}

export function CompactBalanceBadge({
  initialAccount,
  className,
  lang,
}: CompactBalanceBadgeProps) {
  const [account, setAccount] = useState<BillingAccount | null>(
    initialAccount ?? null
  )
  const [isMasked, setIsMasked] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("billing_balance_masked") === "true"
    }
    return false
  })
  const [dialogOpen, setDialogOpen] = useState(false)

  const toggleMask = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMasked((prev) => {
      const next = !prev
      if (typeof window !== "undefined") {
        localStorage.setItem("billing_balance_masked", String(next))
      }
      return next
    })
  }

  const [refreshCounter, setRefreshCounter] = useState(0)

  useEffect(() => {
    let active = true
    if (!initialAccount) {
      void (async () => {
        try {
          const res = await getAccount()
          if (active && res?.ok) {
            setAccount(res)
          }
        } catch {
          // Ignore transient errors
        }
      })()
    }
    return () => {
      active = false
    }
  }, [initialAccount, refreshCounter])

  const fetchBalance = () => setRefreshCounter((k) => k + 1)

  const formatted = account?.formattedBalance ?? "Rp 0"
  const maskedDisplay = isMasked
    ? `${account?.currency ?? "IDR"} ••••••`
    : formatted

  const isLow = account ? !account.isAboveWarn : false

  return (
    <>
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2.5 py-1 text-xs transition-colors hover:bg-muted/70",
          isLow &&
            "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300",
          className
        )}
      >
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 font-medium text-foreground transition-opacity hover:opacity-80"
          aria-label="Open Quick Top-Up"
        >
          <WalletIcon className="size-3.5 text-muted-foreground" />
          <span className="font-semibold">{maskedDisplay}</span>
        </button>

        <button
          type="button"
          onClick={toggleMask}
          aria-label={isMasked ? "Show balance" : "Hide balance"}
          className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {isMasked ? (
            <EyeSlash className="size-3" />
          ) : (
            <Eye className="size-3" />
          )}
        </button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => setDialogOpen(true)}
          className="size-5 rounded-full bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20 hover:text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
          title="Quick Top-Up"
          aria-label="Quick Top-Up button"
        >
          <Lightning className="size-3" weight="fill" />
        </Button>
      </div>

      <QuickTopUpDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentBalance={account?.formattedBalance}
        currency={(account?.currency as "IDR" | "USD") || "IDR"}
        lang={lang}
        onSuccess={() => {
          void fetchBalance()
        }}
      />
    </>
  )
}

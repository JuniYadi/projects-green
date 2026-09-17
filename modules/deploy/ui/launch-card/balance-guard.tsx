"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CreditCard, Warning, XCircle, Spinner } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { getAccount, type BillingAccount } from "@/lib/billing-client"
import { QuickTopUpDialog } from "@/components/billing/quick-top-up-dialog"
import { cn } from "@/lib/utils"

export type BalanceGuardProps = {
  hourlyRate?: number
  currency?: "USD" | "IDR"
  balance?: number
  balanceFormatted?: string
  account?: BillingAccount | null
  lang?: string
  onTopUpSuccess?: () => void
  onBackToChat?: () => void
  onSufficientChange?: (isSufficient: boolean) => void
  className?: string
  hideSubtext?: boolean
}

const DEFAULT_USD_TO_IDR = 15625

export function BalanceGuard({
  hourlyRate = 0.04,
  currency = "IDR",
  balance,
  balanceFormatted,
  account: initialAccount,
  lang = "id",
  onTopUpSuccess,
  onBackToChat,
  onSufficientChange,
  className,
  hideSubtext = false,
}: BalanceGuardProps) {
  const isId = lang === "id"
  const [fetchedAccount, setFetchedAccount] = useState<BillingAccount | null>(
    null
  )
  const isAccountProvided = initialAccount !== undefined
  const [isLoading, setIsLoading] = useState(
    !isAccountProvided && balance === undefined && !balanceFormatted
  )
  const [isTopUpOpen, setIsTopUpOpen] = useState(false)

  const account = isAccountProvided ? (initialAccount ?? null) : fetchedAccount

  // Fetch account if not provided and balance not explicitly passed
  useEffect(() => {
    if (isAccountProvided || balance !== undefined || balanceFormatted) {
      return
    }

    let active = true
    getAccount()
      .then((res) => {
        if (!active) return
        if (res?.ok) {
          setFetchedAccount(res)
        }
      })
      .catch(() => {
        // Handled silently
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [isAccountProvided, balance, balanceFormatted])

  // Extract current numerical balance
  const currentBalanceNumber = useMemo(() => {
    if (typeof balance === "number") return balance
    if (account?.balanceIdr) {
      const parsed = parseFloat(account.balanceIdr)
      return isNaN(parsed) ? 0 : parsed
    }
    const rawAny = (account as Record<string, unknown> | null)?.balance
    if (typeof rawAny === "number") return rawAny
    if (typeof rawAny === "string") {
      const parsed = parseFloat(rawAny)
      return isNaN(parsed) ? 0 : parsed
    }
    if (balanceFormatted) {
      const cleaned = balanceFormatted.replace(/[^\d.,]/g, "")
      if (currency === "IDR") {
        const idrParsed = parseFloat(
          cleaned.replace(/\./g, "").replace(",", ".")
        )
        if (!isNaN(idrParsed)) return idrParsed
      } else {
        const usdParsed = parseFloat(cleaned)
        if (!isNaN(usdParsed)) return usdParsed
      }
    }
    return 0
  }, [account, balance, balanceFormatted, currency])

  // Compute 24-hour buffer: hourlyRate * 24
  const bufferUsd = useMemo(() => hourlyRate * 24, [hourlyRate])
  const bufferIdr = useMemo(
    () => Math.round(bufferUsd * DEFAULT_USD_TO_IDR),
    [bufferUsd]
  )

  const effectiveCurrency =
    account?.currency === "IDR" || account?.balanceIdr ? "IDR" : currency

  const requiredBuffer = effectiveCurrency === "USD" ? bufferUsd : bufferIdr
  const isSufficient = currentBalanceNumber >= requiredBuffer
  const deficit = Math.max(0, requiredBuffer - currentBalanceNumber)

  // Notify parent of sufficiency changes
  useEffect(() => {
    if (!isLoading) {
      onSufficientChange?.(isSufficient)
    }
  }, [isSufficient, isLoading, onSufficientChange])

  // Formatted strings
  const formattedCurrent = useMemo(() => {
    if (balanceFormatted) return balanceFormatted
    if (account?.formattedBalance) return account.formattedBalance
    if (effectiveCurrency === "USD") {
      return `$${currentBalanceNumber.toFixed(2)}`
    }
    return `IDR ${currentBalanceNumber.toLocaleString("id-ID")}`
  }, [
    account?.formattedBalance,
    balanceFormatted,
    effectiveCurrency,
    currentBalanceNumber,
  ])

  const formattedBuffer = useMemo(() => {
    if (effectiveCurrency === "USD") {
      return `$${bufferUsd.toFixed(2)}`
    }
    return `IDR ${bufferIdr.toLocaleString("id-ID")} ($${bufferUsd.toFixed(2)})`
  }, [bufferIdr, bufferUsd, effectiveCurrency])

  const formattedDeficit = useMemo(() => {
    if (effectiveCurrency === "USD") {
      return `$${deficit.toFixed(2)}`
    }
    return `IDR ${deficit.toLocaleString("id-ID")}`
  }, [effectiveCurrency, deficit])

  const handleTopUpSuccess = useCallback(() => {
    setIsTopUpOpen(false)
    onTopUpSuccess?.()
  }, [onTopUpSuccess])

  if (isLoading) {
    return (
      <div
        data-testid="balance-guard-loading"
        className="flex items-center gap-2 py-2 text-xs text-muted-foreground"
      >
        <Spinner className="h-4 w-4 animate-spin" />
        <span>
          {isId ? "Memeriksa saldo akun..." : "Checking account balance..."}
        </span>
      </div>
    )
  }

  // When balance is sufficient, nothing blocking
  if (isSufficient) {
    return null
  }

  return (
    <div
      data-testid="balance-guard"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-foreground shadow-xs transition-all dark:bg-amber-500/15",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-amber-500/30 pb-2.5">
        <Warning className="h-5 w-5 shrink-0 text-amber-500" weight="fill" />
        <h3 className="text-xs font-bold tracking-wider text-amber-600 uppercase sm:text-sm dark:text-amber-400">
          [!] VALIDASI SALDO: SALDO TIDAK MENCUKUPI
        </h3>
      </div>

      {/* Details List */}
      <div className="flex flex-col gap-1 text-xs text-foreground/90 sm:text-sm">
        <div>
          <span className="font-medium text-muted-foreground">
            {isId ? "Saldo Anda saat ini:" : "Your current balance:"}
          </span>{" "}
          <span className="font-semibold text-foreground">
            {formattedCurrent}
          </span>
        </div>
        <div>
          <span className="font-medium text-muted-foreground">
            {isId
              ? "Minimum buffer 24 jam untuk tier ini:"
              : "Minimum 24-hour buffer for this tier:"}
          </span>{" "}
          <span className="font-semibold text-foreground">
            {formattedBuffer}
          </span>
        </div>
        <div>
          <span className="font-medium text-muted-foreground">
            {isId
              ? `Dibutuhkan top-up minimal ${formattedDeficit} agar aplikasi dapat berjalan tanpa terhenti.`
              : `A minimum top-up of ${formattedDeficit} is required for uninterrupted operation.`}
          </span>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button
          type="button"
          data-testid="quick-topup-btn"
          onClick={() => setIsTopUpOpen(true)}
          className="h-9 gap-2 bg-primary text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          <CreditCard className="h-4 w-4" weight="bold" />
          <span>[ 💳 TOP-UP SALDO CEPAT (QUICK TOP-UP) ]</span>
        </Button>

        {onBackToChat && (
          <Button
            type="button"
            variant="outline"
            data-testid="back-to-chat-btn"
            onClick={onBackToChat}
            className="h-9 border-border bg-background text-xs font-medium hover:bg-muted"
          >
            ← Kembali ke Tanya Chat
          </Button>
        )}
      </div>

      {/* Launch Disabled Subtext */}
      {!hideSubtext && (
        <div
          data-testid="launch-disabled-subtext"
          className="flex items-center gap-1.5 pt-1 text-xs text-destructive"
        >
          <XCircle className="h-4 w-4 shrink-0" weight="fill" />
          <span className="font-medium">
            (x) Tombol Launch Dinonaktifkan Sementara Hingga Saldo Mencukupi
          </span>
        </div>
      )}

      {/* Quick Top-up Modal Dialog */}
      <QuickTopUpDialog
        open={isTopUpOpen}
        onOpenChange={setIsTopUpOpen}
        currentBalance={formattedCurrent}
        suggestedAmount={deficit}
        currency={effectiveCurrency}
        lang={lang}
        onSuccess={handleTopUpSuccess}
      />
    </div>
  )
}

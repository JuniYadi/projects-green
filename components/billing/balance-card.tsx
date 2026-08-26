import { WarningIcon, WalletIcon } from "@/components/ui/phosphor-icons"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { AppMessages } from "@/lib/i18n/messages/types"
import { cn } from "@/lib/utils"

type BalanceMessages = AppMessages["console"]["billing"]["balanceCard"]

type BalanceCardProps = {
  balanceIdr: string
  formattedBalance: string
  isAboveWarn: boolean
  accountAge?: string
  className?: string
  lang?: string
  messages?: BalanceMessages
}

function getBalanceColor(balanceIdr: string): string {
  const balance = Number.parseFloat(balanceIdr)

  if (balance >= 10_000) {
    return "text-green-600 dark:text-green-400"
  }

  if (balance >= 1_000) {
    return "text-yellow-600 dark:text-yellow-400"
  }

  return "text-red-600 dark:text-red-400"
}

export function BalanceCard({
  balanceIdr,
  formattedBalance,
  isAboveWarn,
  accountAge,
  className,
  lang,
  messages,
}: BalanceCardProps) {
  const t =
    messages ??
    getMessages(resolveLocaleOrDefault(lang)).console.billing.balanceCard
  const balanceColor = getBalanceColor(balanceIdr)

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">{t.heading}</CardTitle>
        <WalletIcon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-bold", balanceColor)}>
          {formattedBalance}
        </div>
        {accountAge && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t.accountAge} {accountAge}
          </p>
        )}

        {!isAboveWarn && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/10 p-3">
            <WarningIcon className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              {t.lowBalanceWarning}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

import Link from "next/link"
import { FiAlertTriangle } from "react-icons/fi"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type BillingBalanceGateBannerProps = {
  /** Formatted balance, e.g. "IDR 0.00". */
  formattedBalance: string
  /** Localized top-up URL. */
  topupUrl: string
  /** True when the balance is zero (stronger CTA than merely low). */
  isZero: boolean
}

/**
 * Persistent console banner shown when an organization's billing balance is
 * zero or below the low-balance warning threshold. Prompts the user to top up
 * before attempting a purchase. Rendered server-side from the console layout.
 */
export function BillingBalanceGateBanner({
  formattedBalance,
  topupUrl,
  isZero,
}: BillingBalanceGateBannerProps) {
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
        <AlertAction>
          <Button asChild size="sm">
            <Link href={topupUrl}>Top up</Link>
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}

"use client"

import Link from "next/link"
import { XCircle, Globe, LightbulbFilament } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"

export type PolicyBlockedCardProps = {
  ruleTitle?: string
  reason?: string
  marketplaceUrl?: string
  onSelectMarketplace?: () => void
  onSelectCustomDockerfile?: () => void
  lang?: string
  className?: string
}

export function PolicyBlockedCard({
  ruleTitle = "Block unmanaged legacy PHP/WordPress standalone code",
  reason = "Ditemukan file wp-config.php dan core lama yang rentan CVE.",
  marketplaceUrl = "/console/app/marketplace",
  onSelectMarketplace,
  onSelectCustomDockerfile,
  lang = "id",
  className,
}: PolicyBlockedCardProps) {
  const isId = lang === "id"
  const messages = getMessagesForMaybeLocale(lang)
  const agentMessages = messages.console.app.deployAgent

  return (
    <div
      data-testid="policy-blocked-card"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-destructive/30 bg-card p-5 shadow-xs transition-all",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-destructive/20 pb-3">
        <XCircle className="h-5 w-5 shrink-0 text-destructive" weight="bold" />
        <h2 className="text-xs font-bold tracking-wider text-destructive uppercase sm:text-sm">
          {agentMessages.policyBlockedHeader}
        </h2>
      </div>

      {/* Alasan Penolakan */}
      <div className="flex flex-col gap-1.5 text-xs sm:text-sm">
        <span className="font-semibold text-foreground">
          {isId ? "Alasan Penolakan:" : "Rejection Reason:"}
        </span>
        <div className="flex flex-col gap-1 pl-1 text-muted-foreground">
          <div className="flex items-baseline gap-1.5">
            <span>•</span>
            <span>
              <strong className="font-medium text-foreground">
                {isId ? "Rule Pelanggaran :" : "Violated Rule :"}
              </strong>{" "}
              {ruleTitle}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span>•</span>
            <span>
              <strong className="font-medium text-foreground">
                {isId ? "Detail Temuan :" : "Findings Detail :"}
              </strong>{" "}
              {reason}
            </span>
          </div>
        </div>
      </div>

      {/* Solusi & Rekomendasi dari Tanya */}
      <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/30 p-3.5 text-xs sm:text-sm">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <LightbulbFilament
            className="h-4 w-4 shrink-0 text-amber-500"
            weight="fill"
          />
          <span>
            {isId
              ? "Solusi & Rekomendasi dari Tanya:"
              : "Solutions & Recommendations from Tanya:"}
          </span>
        </div>
        <ol className="flex list-decimal flex-col gap-1 pl-4 text-xs text-muted-foreground sm:text-sm">
          <li>
            {agentMessages.policyMarketplaceRecommend.replace(
              "{url}",
              marketplaceUrl
            )}
          </li>
          <li>{agentMessages.policyDockerRecommend}</li>
        </ol>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {onSelectMarketplace ? (
          <Button
            type="button"
            data-testid="policy-marketplace-btn"
            onClick={onSelectMarketplace}
            className="h-9 gap-2 bg-primary text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Globe className="h-4 w-4" weight="bold" />
            <span>{agentMessages.openMarketplaceBtn}</span>
          </Button>
        ) : (
          <Button
            asChild
            className="h-9 gap-2 bg-primary text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Link href={marketplaceUrl} data-testid="policy-marketplace-btn">
              <Globe className="h-4 w-4" weight="bold" />
              <span>{agentMessages.openMarketplaceBtn}</span>
            </Link>
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          data-testid="policy-dockerfile-btn"
          onClick={onSelectCustomDockerfile}
          className="h-9 gap-2 border-border bg-background text-xs font-medium text-foreground hover:bg-muted"
        >
          <span>{agentMessages.useCustomDockerfileBtn}</span>
        </Button>
      </div>
    </div>
  )
}

"use client"

import { CheckCircle, Gear } from "@phosphor-icons/react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function getAppSettingsUrl(appId: string, lang?: string): string {
  const base = `/console/app/${encodeURIComponent(appId)}/settings`
  return lang ? `/${lang}${base}` : base
}

export type ZeroConfigNoticeProps = {
  count?: number
  appId?: string
  lang?: string
  className?: string
  variant?: "banner" | "compact" | "badge-only"
}

export function ZeroConfigNotice({
  count = 12,
  appId,
  lang = "en",
  className,
  variant = "banner",
}: ZeroConfigNoticeProps) {
  const isId = lang === "id"

  const badgeText = isId ? "Zero-Config Siap" : "Zero-Config Ready"
  const variableLabel = isId
    ? `${count} variabel dikonfigurasi otomatis dari .env.example`
    : `${count} ${count === 1 ? "variable" : "variables"} auto-configured from .env.example`
  const secretsLabel = isId
    ? "Kunci rahasia produksi dapat diatur nanti di App Settings"
    : "Production secrets can be configured anytime in App Settings"
  const settingsLinkText = isId ? "Buka App Settings" : "Open App Settings"

  if (variant === "badge-only") {
    return (
      <Badge
        variant="secondary"
        data-testid="zero-config-badge"
        className={cn(
          "inline-flex items-center gap-1 border border-border/60 bg-secondary/80 text-xs font-medium text-foreground",
          className
        )}
      >
        <CheckCircle className="h-3.5 w-3.5 text-primary" weight="fill" />
        <span>{badgeText}</span>
      </Badge>
    )
  }

  return (
    <div
      data-testid="zero-config-notice"
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground transition-colors sm:p-3.5",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            data-testid="zero-config-badge"
            className="text-2xs inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-0.5 font-semibold text-foreground"
          >
            <CheckCircle className="h-3 w-3 text-primary" weight="fill" />
            <span>{badgeText}</span>
          </Badge>
          <span className="font-medium text-foreground">{variableLabel}</span>
        </div>

        {appId && (
          <Link
            href={getAppSettingsUrl(appId, lang)}
            data-testid="zero-config-deep-link"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <Gear className="h-3.5 w-3.5" />
            <span>{settingsLinkText}</span>
          </Link>
        )}
      </div>

      <p className="text-muted-foreground">
        ({secretsLabel}
        {appId ? (
          <>
            :{" "}
            <Link
              href={getAppSettingsUrl(appId, lang)}
              className="text-primary hover:underline"
            >
              /console/app/{appId}/settings
            </Link>
          </>
        ) : null}
        )
      </p>
    </div>
  )
}

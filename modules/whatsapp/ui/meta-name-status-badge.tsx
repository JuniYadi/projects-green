"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export type MetaNameStatusBadgeProps = {
  nameStatus: string | null | undefined
  verifiedName?: string | null | undefined
  profile?: Record<string, unknown> | null
  showName?: boolean
  className?: string
}

export function MetaNameStatusBadge({
  nameStatus,
  verifiedName,
  profile,
  showName = false,
  className,
}: MetaNameStatusBadgeProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale).console.whatsapp.devices

  const syncState = (
    (profile?.meta_name_status_sync_state as string) || ""
  ).toUpperCase()
  const status = (nameStatus ?? "UNSET").toUpperCase()

  const variant: Record<
    string,
    "success" | "warning" | "destructive" | "secondary"
  > = {
    APPROVED: "success",
    PENDING: "warning",
    PENDING_REVIEW: "warning",
    DECLINED: "destructive",
    REJECTED: "destructive",
    EXPIRED: "destructive",
    UNSET: "secondary",
  }

  const label: Record<string, string> = {
    APPROVED: messages.nameApproved,
    PENDING: messages.namePending,
    PENDING_REVIEW: messages.namePending,
    DECLINED: messages.nameDeclined,
    REJECTED: messages.nameDeclined,
    EXPIRED: messages.nameExpired,
    UNSET: messages.nameUnset,
  }

  if (syncState === "UNAVAILABLE") {
    return (
      <Badge variant="secondary" className={className}>
        Meta unavailable
      </Badge>
    )
  }

  if (syncState === "UNKNOWN") {
    return (
      <Badge variant="secondary" className={className}>
        {messages.nameUnset}
      </Badge>
    )
  }

  const badgeElement = (
    <Badge
      variant={variant[status] ?? "secondary"}
      className={`px-1.5 py-0 text-[10px] font-normal ${className ?? ""}`.trim()}
    >
      {label[status] ?? status}
    </Badge>
  )

  if (showName) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">
          {verifiedName || "—"}
        </span>
        <div>{badgeElement}</div>
      </div>
    )
  }

  return badgeElement
}

"use client"

import * as React from "react"
import Link from "next/link"
import {
  Target,
  CaretUp,
  CaretDown,
  CheckCircle,
  Circle,
  ArrowRight,
  Sparkle,
  X,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ServiceOrderDialog } from "@/components/billing/service-order-dialog"
import type { WhatsAppOnboardingState } from "./use-whatsapp-onboarding"

export type FlightHudWidgetProps = {
  onboarding: WhatsAppOnboardingState
  onSubscribeClick?: () => void
}

export function FlightHudWidget({
  onboarding,
  onSubscribeClick,
}: FlightHudWidgetProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isDismissed, setIsDismissed] = React.useState(false)
  const [isInternalOrderOpen, setIsInternalOrderOpen] = React.useState(false)

  const handleSubscribe = React.useCallback(() => {
    if (onSubscribeClick) {
      onSubscribeClick()
    } else {
      setIsInternalOrderOpen(true)
    }
  }, [onSubscribeClick])

  if (onboarding.isGraduated || isDismissed) {
    return null
  }

  const { activeMission, progressPercent, missions, level } = onboarding

  const levelDisplay = level === "0_pending" ? "Lv 0 (Tower)" : `Level ${level}`

  return (
    <div className="fixed right-6 bottom-6 z-40 hidden md:block">
      {isExpanded ? (
        <Card className="w-80 animate-in border-primary/30 bg-background/95 shadow-2xl backdrop-blur-md transition-all fade-in slide-in-from-bottom-3">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Target className="size-4" weight="bold" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold tracking-wider text-primary uppercase">
                    Flight Deck HUD
                  </span>
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[10px] font-bold"
                  >
                    {levelDisplay}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {progressPercent}% flight readiness
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={() => setIsExpanded(false)}
                title="Collapse HUD"
              >
                <CaretDown className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={() => setIsDismissed(true)}
                title="Hide for this session"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          <CardContent className="space-y-4 p-4">
            <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-primary">Current Mission</span>
                <span className="text-muted-foreground">
                  {activeMission.subtitle}
                </span>
              </div>
              <p className="text-sm leading-tight font-bold text-foreground">
                {activeMission.title}
              </p>
              <p className="text-xs leading-snug text-muted-foreground">
                {activeMission.description}
              </p>
              <div className="pt-2">
                {activeMission.isActionDialog ? (
                  <Button
                    size="sm"
                    className="h-8 w-full gap-1.5 text-xs"
                    onClick={handleSubscribe}
                  >
                    <Sparkle className="size-3.5" weight="fill" />
                    {activeMission.actionLabel}
                  </Button>
                ) : activeMission.actionHref ? (
                  <Button
                    size="sm"
                    className="h-8 w-full gap-1.5 text-xs"
                    asChild
                  >
                    <Link href={activeMission.actionHref}>
                      {activeMission.actionLabel}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Flight Checklist
              </span>
              <div className="space-y-1.5">
                {missions.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 rounded-md p-1.5 text-xs transition-colors ${
                      m.completed
                        ? "text-muted-foreground line-through opacity-70"
                        : m.level === level
                          ? "bg-accent/60 font-semibold text-foreground"
                          : "text-muted-foreground opacity-50"
                    }`}
                  >
                    {m.completed ? (
                      <CheckCircle
                        className="size-3.5 shrink-0 text-emerald-500"
                        weight="fill"
                      />
                    ) : (
                      <Circle className="size-3.5 shrink-0" />
                    )}
                    <span className="truncate">{m.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-1 text-[11px]">
              <button
                type="button"
                onClick={onboarding.graduateNow}
                className="text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
              >
                Skip Onboarding
              </button>
              <Link
                href="/console/whatsapp/dashboard"
                className="font-medium text-primary hover:underline"
              >
                Command Center →
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={() => setIsExpanded(true)}
          className="group flex items-center gap-2.5 rounded-full border border-primary/40 bg-background/95 px-4 py-2.5 text-xs font-semibold text-foreground shadow-xl backdrop-blur-md hover:bg-muted/80"
          variant="outline"
        >
          <div className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </div>
          <span className="font-bold text-primary">{levelDisplay}:</span>
          <span className="max-w-[140px] truncate">{activeMission.title}</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {progressPercent}%
          </Badge>
          <CaretUp className="size-3.5 text-muted-foreground group-hover:text-foreground" />
        </Button>
      )}

      <ServiceOrderDialog
        productCode="WHATSAPP"
        productTitle="WhatsApp Gateway"
        open={isInternalOrderOpen}
        onOpenChange={setIsInternalOrderOpen}
        onSuccess={() => {
          setIsInternalOrderOpen(false)
        }}
      />
    </div>
  )
}

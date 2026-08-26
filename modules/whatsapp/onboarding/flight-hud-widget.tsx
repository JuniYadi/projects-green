"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  Target,
  CaretUp,
  CaretDown,
  CheckCircle,
  Circle,
  ArrowRight,
  Sparkle,
  X,
  Lifebuoy,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ServiceOrderDialog } from "@/components/billing/service-order-dialog"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault, localizePathname } from "@/lib/i18n/pathname"
import type { WhatsAppOnboardingState } from "./use-whatsapp-onboarding"

export type FlightHudWidgetProps = {
  onboarding: WhatsAppOnboardingState
  onSubscribeClick?: () => void
  locale?: string
}

export function FlightHudWidget({
  onboarding,
  onSubscribeClick,
  locale: suppliedLocale,
}: FlightHudWidgetProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(suppliedLocale ?? params?.lang)
  const messages = getMessages(locale)
  const t = messages?.console?.whatsapp?.onboarding?.hud ?? {
    flightDeckHud: "Flight Deck HUD",
    flightReadiness: "Flight Readiness",
    collapseHud: "Collapse HUD",
    closeHud: "Close HUD",
    closeGuide: "Close Guide",
    needHelp: "Need Help?",
    stepOf: "Step {step} of {total}",
    setupFinished: "Setup Finished (All Milestones Done)",
    prevStep: "Previous step",
    nextStep: "Next step",
    checklist: "Checklist",
    viewing: "Viewing",
    replay: "Replay",
    readyForProduction: "Ready for Production • Done",
    allOnboardingComplete: "All Onboarding Complete",
    onboardingGuide: "Onboarding Guide",
    dismissedToast:
      "Onboarding guide dismissed. You can reopen it anytime from the dashboard.",
  }
  const tLevels = messages?.console?.whatsapp?.onboarding?.levels ?? {
    groundControl: "Level 0 • Ground Control",
    towerClearancePending: "Level 0 • Tower Clearance Pending",
    transponderActive: "Level 1 • Transponder Active",
    flightOperations: "Level 2 • Flight Operations",
    fullCockpitMaster: "Level 3 • Full Cockpit Master",
    levelPrefix: "Level {level}",
  }
  const HUD_STORAGE_KEY = "whatsapp_onboarding_hud_closed"
  const [isDismissed, setIsDismissed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      return localStorage.getItem(HUD_STORAGE_KEY) === "true"
    } catch {
      return false
    }
  })
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isInternalOrderOpen, setIsInternalOrderOpen] = React.useState(false)

  const handleDismiss = React.useCallback(() => {
    try {
      localStorage.setItem(HUD_STORAGE_KEY, "true")
    } catch {}
    setIsDismissed(true)
  }, [])

  const handleSubscribe = React.useCallback(() => {
    if (onSubscribeClick) {
      onSubscribeClick()
    } else {
      setIsInternalOrderOpen(true)
    }
  }, [onSubscribeClick, setIsInternalOrderOpen])

  if (isDismissed) {
    return null
  }
  const { activeMission, progressPercent, missions, level } = onboarding

  const levelDisplay =
    level === "0_pending"
      ? locale === "id"
        ? "Lv 0 (Verifikasi)"
        : "Lv 0 (Tower)"
      : tLevels.levelPrefix.replace("{level}", String(level))

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
                    {t.flightDeckHud}
                  </span>
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[10px] font-bold"
                  >
                    {levelDisplay}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {progressPercent}% {t.flightReadiness.toLowerCase()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={() => setIsExpanded(false)}
                title={t.collapseHud}
              >
                <CaretDown className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={handleDismiss}
                title={t.closeHud}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
          <CardContent className="space-y-4 p-4">
            {/* Interactive Carousel Card Header */}
            <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5 font-bold text-primary">
                <Sparkle className="size-3.5" weight="fill" />
                {onboarding.replayLevel !== null
                  ? t.stepOf
                      .replace(
                        "{step}",
                        String(
                          missions.findIndex(
                            (m) => m.level === activeMission.level
                          ) + 1
                        )
                      )
                      .replace("{total}", String(missions.length))
                  : activeMission.completed
                    ? t.setupFinished
                    : t.stepOf
                        .replace(
                          "{step}",
                          String(
                            missions.findIndex(
                              (m) => m.level === activeMission.level
                            ) + 1
                          )
                        )
                        .replace("{total}", String(missions.length))}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const currentIdx = missions.findIndex(
                      (m) => m.level === activeMission.level
                    )
                    const prevIdx =
                      (currentIdx - 1 + missions.length) % missions.length
                    onboarding.setReplayLevel(missions[prevIdx].level)
                  }}
                  className="flex size-5 items-center justify-center rounded-md border bg-background text-xs font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title={t.prevStep}
                >
                  ‹
                </button>
                <span className="px-0.5 font-mono text-[10px] tabular-nums">
                  {missions.findIndex((m) => m.level === activeMission.level) +
                    1}
                  /{missions.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const currentIdx = missions.findIndex(
                      (m) => m.level === activeMission.level
                    )
                    const nextIdx = (currentIdx + 1) % missions.length
                    onboarding.setReplayLevel(missions[nextIdx].level)
                  }}
                  className="flex size-5 items-center justify-center rounded-md border bg-background text-xs font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title={t.nextStep}
                >
                  ›
                </button>
              </div>
            </div>

            {/* Carousel Mission Card Container */}
            <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-b from-primary/10 via-primary/5 to-background p-3.5 shadow-xs">
              <div
                key={activeMission.title}
                className="animate-in space-y-1.5 transition-all duration-300 ease-out fade-in-60 slide-in-from-right-6"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-primary">
                    {activeMission.completed ? (
                      <CheckCircle
                        className="size-4 animate-in text-emerald-500 zoom-in"
                        weight="fill"
                      />
                    ) : (
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-primary" />
                      </span>
                    )}
                    {activeMission.title}
                  </span>
                  <Badge
                    variant="outline"
                    className="h-4 px-1.5 text-[10px] font-bold text-muted-foreground"
                  >
                    {activeMission.subtitle}
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {activeMission.description}
                </p>
                <div className="pt-2">
                  {activeMission.isActionDialog ? (
                    <Button
                      size="sm"
                      className="h-8 w-full gap-1.5 text-xs font-semibold shadow-sm transition-transform hover:shadow-md active:scale-95"
                      onClick={handleSubscribe}
                    >
                      <Sparkle className="size-3.5" weight="fill" />
                      {activeMission.actionLabel}
                    </Button>
                  ) : activeMission.actionHref ? (
                    <Button
                      size="sm"
                      className="h-8 w-full gap-1.5 text-xs font-semibold shadow-sm transition-transform hover:shadow-md active:scale-95"
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
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {t.checklist}
              </span>
              <div className="space-y-1.5">
                {missions.map((m, idx) => {
                  const isCurrentActive =
                    onboarding.replayLevel !== null
                      ? activeMission.level === m.level
                      : false
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => {
                        if (onboarding.replayLevel === m.level) {
                          onboarding.setReplayLevel(null)
                        } else {
                          onboarding.setReplayLevel(m.level)
                        }
                      }}
                      className={`group relative flex w-full items-center justify-between gap-2 overflow-hidden rounded-md p-2 text-left text-xs transition-all duration-200 ease-out hover:bg-muted/70 ${
                        isCurrentActive
                          ? "translate-x-0.5 border border-border bg-accent/60 font-semibold text-foreground shadow-xs"
                          : m.completed
                            ? "text-muted-foreground hover:text-foreground"
                            : "text-muted-foreground opacity-60"
                      }`}
                    >
                      {isCurrentActive && (
                        <span className="absolute top-0 left-0 h-full w-1 animate-in rounded-r bg-emerald-500 duration-200 fade-in slide-in-from-left" />
                      )}
                      <div className="flex items-center gap-2 truncate">
                        {m.completed ? (
                          <CheckCircle
                            className={`size-4 shrink-0 text-emerald-500 transition-transform duration-200 ${
                              isCurrentActive
                                ? "scale-105"
                                : "group-hover:scale-105"
                            }`}
                            weight="fill"
                          />
                        ) : (
                          <Circle className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{m.title}</span>
                      </div>
                      {m.completed ? (
                        <Badge
                          variant={isCurrentActive ? "default" : "outline"}
                          className={`h-4 px-1.5 text-[9px] font-medium transition-all duration-150 ${
                            isCurrentActive
                              ? "bg-foreground text-background shadow-xs"
                              : "border-border/60 text-muted-foreground group-hover:text-foreground"
                          }`}
                        >
                          {isCurrentActive ? t.viewing : t.replay}
                        </Badge>
                      ) : null}
                    </button>
                  )
                })}

                {/* Bottom Done Anchor - Elegant Neutral with subtle Emerald Accent */}
                <div
                  className={`group relative flex w-full items-center justify-between gap-2 overflow-hidden rounded-lg border p-2.5 text-left text-xs transition-all duration-200 ${
                    progressPercent === 100
                      ? "border-border/60 bg-muted/40 font-medium text-foreground shadow-xs"
                      : "border-border/40 bg-muted/20 text-muted-foreground opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {progressPercent === 100 ? (
                      <div className="relative flex size-3 items-center justify-center">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <CheckCircle
                          className="relative size-4 text-emerald-500"
                          weight="fill"
                        />
                      </div>
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="font-semibold tracking-tight text-foreground">
                      {progressPercent === 100
                        ? t.readyForProduction
                        : t.allOnboardingComplete}
                    </span>
                  </div>
                  <Badge
                    variant={progressPercent === 100 ? "secondary" : "outline"}
                    className="h-4.5 border-emerald-500/30 px-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
                  >
                    {progressPercent === 100
                      ? "100% DONE"
                      : `${progressPercent}%`}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/50 pt-2 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  onboarding.graduateNow()
                  handleDismiss()
                  toast.success(t.dismissedToast)
                }}
                className="text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                {t.closeGuide}
              </button>
              <Link
                href={localizePathname({
                  pathname: "/console/support-tickets",
                  locale,
                })}
                className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                <Lifebuoy className="size-3.5" />
                {t.needHelp}
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={() => setIsExpanded(true)}
          className="group relative flex items-center gap-2 rounded-full border border-primary/40 bg-background/95 py-2 pr-3.5 pl-3 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:border-primary hover:bg-muted/80 active:scale-95"
          variant="outline"
        >
          {/* Compact Beacon Indicator */}
          <div className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </div>
          <span className="font-semibold text-foreground">
            {t.onboardingGuide}
          </span>
          <Badge
            variant={progressPercent === 100 ? "default" : "secondary"}
            className={`h-4.5 px-1.5 text-[10px] font-bold ${
              progressPercent === 100 ? "bg-emerald-600 text-white" : ""
            }`}
          >
            {progressPercent === 100 ? "100% ✓" : `${progressPercent}%`}
          </Badge>
          <CaretUp className="size-3.5 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:text-foreground" />
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

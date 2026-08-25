"use client"

import * as React from "react"
import Link from "next/link"
import {
  RocketLaunch,
  CheckCircle,
  Circle,
  Sparkle,
  Phone,
  Lightning,
  Key,
  ClockCountdown,
  ArrowRight,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { WhatsAppOnboardingState } from "./use-whatsapp-onboarding"

export type WhatsAppCommandCenterProps = {
  onboarding: WhatsAppOnboardingState
  onSubscribeClick: () => void
}

export function WhatsAppCommandCenter({
  onboarding,
  onSubscribeClick,
}: WhatsAppCommandCenterProps) {
  const {
    level,
    progressPercent,
    activeMission,
    hasSubscription,
    hasDevice,
    graduateNow,
  } = onboarding

  const numericLevel = level === "0_pending" ? 0.5 : level
  const levelName = React.useMemo(() => {
    switch (level) {
      case 0:
        return "Level 0 • Ground Control"
      case "0_pending":
        return "Level 0 • Tower Clearance Pending"
      case 1:
        return "Level 1 • Transponder Active"
      case 2:
        return "Level 2 • Flight Operations"
      case 3:
      default:
        return "Level 3 • Full Cockpit Master"
    }
  }, [level])

  return (
    <div className="animate-in space-y-6 duration-300 fade-in">
      {/* Hero Mission Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-md">
        <CardHeader className="p-6 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge className="gap-1.5 px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase">
                  <RocketLaunch className="size-3.5" weight="fill" />
                  {levelName}
                </Badge>
                <span className="text-xs font-semibold text-primary">
                  {activeMission.subtitle}
                </span>
              </div>
              <CardTitle className="text-2xl font-black tracking-tight sm:text-3xl">
                {activeMission.title}
              </CardTitle>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                {activeMission.description}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <div className="text-right">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Flight Readiness
                </span>
                <div className="text-3xl font-black tracking-tight text-primary">
                  {progressPercent}%
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={graduateNow}
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
              >
                Skip Tutorial
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-primary/20">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardHeader>

        <CardContent className="p-6 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            {activeMission.isActionDialog ? (
              <Button
                onClick={onSubscribeClick}
                size="lg"
                className="gap-2 font-semibold shadow-sm"
              >
                <Sparkle className="size-4" weight="fill" />
                {activeMission.actionLabel}
              </Button>
            ) : activeMission.actionHref ? (
              <Button
                asChild
                size="lg"
                className="gap-2 font-semibold shadow-sm"
              >
                <Link href={activeMission.actionHref}>
                  {activeMission.actionLabel}
                  <ArrowRight className="size-4" weight="bold" />
                </Link>
              </Button>
            ) : null}

            {level === 0 && (
              <Button variant="outline" size="lg" asChild>
                <Link href="/console/whatsapp/usage">Explore Quotas</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Level 0 Pending Wait State (Tower Clearance) */}
      {level === "0_pending" && (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <ClockCountdown className="size-5" weight="bold" />
              <CardTitle className="text-base font-bold">
                Transponder Verification in Progress
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              Your subscription is active! Platform admins are currently
              provisioning and linking your Meta WhatsApp Business number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-3 rounded-xl border bg-background/80 p-3">
                <CheckCircle
                  className="mt-0.5 size-4 shrink-0 text-emerald-500"
                  weight="fill"
                />
                <div className="text-xs">
                  <p className="font-semibold text-foreground">
                    Plan Subscribed
                  </p>
                  <p className="text-muted-foreground">
                    Active WhatsApp tier allocated
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="relative mt-1 flex size-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex size-3 rounded-full bg-amber-500" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-amber-700 dark:text-amber-300">
                    Admin Review
                  </p>
                  <p className="text-muted-foreground">
                    WABA number registration
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border bg-background/50 p-3 opacity-60">
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Cockpit Live</p>
                  <p className="text-muted-foreground">
                    Level 1 ready for take-off
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 text-xs">
              <span className="text-muted-foreground">
                Want to check your pending transponder hardware details?
              </span>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-7 text-xs"
              >
                <Link href="/console/whatsapp/devices">View Devices Tab</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tech Tree / Progression Roadmap */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">
            Mission Flight Roadmap
          </h2>
          <span className="text-xs text-muted-foreground">
            Progression unlocks advanced cockpit tabs
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Node 0: Plan */}
          <Card
            className={`relative overflow-hidden transition-all ${
              hasSubscription || hasDevice
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-primary/40 shadow-sm"
            }`}
          >
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkle className="size-4" weight="fill" />
                </div>
                {hasSubscription || hasDevice ? (
                  <CheckCircle
                    className="size-5 text-emerald-500"
                    weight="fill"
                  />
                ) : (
                  <Badge variant="outline" className="text-[10px] font-bold">
                    Lv 0
                  </Badge>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold">1. Plan Subscription</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Activate WhatsApp business tier.
                </p>
              </div>
              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {hasSubscription || hasDevice ? "✓ Unlocked" : "Pending Action"}
              </p>
            </CardContent>
          </Card>

          {/* Node 1: Device */}
          <Card
            className={`relative overflow-hidden transition-all ${
              hasDevice
                ? "border-emerald-500/40 bg-emerald-500/5"
                : level === "0_pending"
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "opacity-60"
            }`}
          >
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Phone className="size-4" weight="fill" />
                </div>
                {hasDevice ? (
                  <CheckCircle
                    className="size-5 text-emerald-500"
                    weight="fill"
                  />
                ) : (
                  <Badge variant="outline" className="text-[10px] font-bold">
                    Lv 1
                  </Badge>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold">2. Device Transponder</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Connect active Meta WhatsApp number.
                </p>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">
                {hasDevice
                  ? "✓ Messages & Contacts Unlocked"
                  : "Unlocks Messages & Contacts"}
              </p>
            </CardContent>
          </Card>

          {/* Node 2: Message & Template */}
          <Card
            className={`relative overflow-hidden transition-all ${
              numericLevel >= 2
                ? "border-emerald-500/40 bg-emerald-500/5"
                : hasDevice
                  ? "border-primary/40 shadow-sm"
                  : "opacity-60"
            }`}
          >
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Lightning className="size-4" weight="fill" />
                </div>
                {numericLevel >= 2 ? (
                  <CheckCircle
                    className="size-5 text-emerald-500"
                    weight="fill"
                  />
                ) : (
                  <Badge variant="outline" className="text-[10px] font-bold">
                    Lv 2
                  </Badge>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold">
                  3. Operations & Broadcasts
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Send 1st message and create template.
                </p>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">
                {numericLevel >= 2
                  ? "✓ Broadcasts & Catalogs Unlocked"
                  : "Unlocks Broadcasts & Catalogs"}
              </p>
            </CardContent>
          </Card>

          {/* Node 3: API & Automation */}
          <Card
            className={`relative overflow-hidden transition-all ${
              level === 3
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "opacity-60"
            }`}
          >
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Key className="size-4" weight="fill" />
                </div>
                {level === 3 ? (
                  <CheckCircle
                    className="size-5 text-emerald-500"
                    weight="fill"
                  />
                ) : (
                  <Badge variant="outline" className="text-[10px] font-bold">
                    Lv 3
                  </Badge>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold">4. Radar & Telemetry</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generate API Keys & Webhooks.
                </p>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">
                {level === 3
                  ? "✓ Full Cockpit Master"
                  : "Unlocks Logs & Full Telemetry"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

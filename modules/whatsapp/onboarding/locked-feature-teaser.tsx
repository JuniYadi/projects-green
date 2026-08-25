"use client"

import * as React from "react"
import Link from "next/link"
import {
  LockKeyOpen,
  RocketLaunch,
  ArrowRight,
  Sparkle,
  CheckCircle,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export type LockedFeatureTeaserProps = {
  featureTitle: string
  featureDescription: string
  unlockLevel: number
  prerequisiteDescription: string
  activeMissionHref: string
  activeMissionLabel: string
  onActionClick?: () => void
  icon?: React.ReactNode
}

export function LockedFeatureTeaser({
  featureTitle,
  featureDescription,
  unlockLevel,
  prerequisiteDescription,
  activeMissionHref,
  activeMissionLabel,
  onActionClick,
  icon,
}: LockedFeatureTeaserProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <Card className="max-w-xl border-dashed border-primary/40 bg-gradient-to-b from-primary/5 via-background to-background shadow-sm">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
            {icon || <LockKeyOpen className="size-8" weight="duotone" />}
          </div>

          <Badge
            variant="outline"
            className="mb-3 gap-1.5 border-primary/30 px-3 py-1 text-xs font-semibold text-primary"
          >
            <Sparkle className="size-3.5 fill-primary" />
            Locked Cockpit Feature • Level {unlockLevel}
          </Badge>

          <h2 className="text-2xl font-bold tracking-tight">{featureTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {featureDescription}
          </p>

          <div className="my-6 w-full rounded-xl border bg-muted/40 p-4 text-left">
            <div className="flex items-start gap-3">
              <CheckCircle
                className="mt-0.5 size-5 shrink-0 text-primary"
                weight="fill"
              />
              <div>
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Unlock Prerequisite
                </p>
                <p className="text-sm font-medium text-foreground">
                  {prerequisiteDescription}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {onActionClick ? (
              <Button onClick={onActionClick} className="gap-2 shadow-sm">
                <RocketLaunch className="size-4" weight="bold" />
                {activeMissionLabel}
              </Button>
            ) : (
              <Button asChild className="gap-2 shadow-sm">
                <Link href={activeMissionHref}>
                  <RocketLaunch className="size-4" weight="bold" />
                  {activeMissionLabel}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

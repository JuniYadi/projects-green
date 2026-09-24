"use client"

import type React from "react"

import { Button } from "@/components/ui/button"

import { cn } from "@/lib/utils"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type FeedShellProps = {
  children: React.ReactNode
  composer: React.ReactNode
  onNewDeployment: () => void
  hasActiveSession: boolean
  appName?: string
}

function FeedShell({
  children,
  composer,
  onNewDeployment,
  hasActiveSession,
  appName,
}: FeedShellProps) {
  const params = useParams<{ lang?: string }>()
  const t = getMessages(
    resolveLocaleOrDefault(params?.lang)
  ).pDeployAiFeedFeedShell
  const handleNewDeployment = () => {
    if (
      hasActiveSession &&
      !window.confirm("Start a new deployment and discard the active session?")
    ) {
      return
    }
    onNewDeployment()
  }

  return (
    <div className={cn("flex h-full min-h-[600px] flex-col")}>
      <header className="flex h-[73px] items-center justify-between border-b border-border px-6 py-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            {t.brand}
          </p>
          <h1 className="text-xl font-semibold">
            {t.title}
            {appName ? ` · ${appName}` : ""}
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleNewDeployment}>
          {t.newDeployment}
        </Button>
      </header>
      <main className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
        {children}
      </main>
      <div className="border-t border-border bg-background px-6 py-4">
        {composer}
      </div>
    </div>
  )
}

export { FeedShell }
export type { FeedShellProps }

"use client"

import * as React from "react"
import {
  useParams,
  useSearchParams,
  useRouter,
  usePathname,
} from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useWhatsAppOnboarding } from "@/modules/whatsapp/onboarding/use-whatsapp-onboarding"
import { LockedFeatureTeaser } from "@/modules/whatsapp/onboarding/locked-feature-teaser"
import { FlightHudWidget } from "@/modules/whatsapp/onboarding/flight-hud-widget"
import { WebhookLogsTabContent } from "./webhook-logs-tab-content"
import { AuditLogsTabContent } from "./audit-logs-tab-content"

export default function ConsoleWhatsAppLogsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const onboarding = useWhatsAppOnboarding({ locale })
  const tLocked =
    messages.console.whatsapp.onboarding.lockedFeatures.webhookLogs

  const tabParam = searchParams.get("tab")
  const activeTab = tabParam === "audit" ? "audit" : "webhooks"

  const handleTabChange = React.useCallback(
    (value: string) => {
      const q = new URLSearchParams(searchParams.toString())
      if (value === "audit") {
        q.set("tab", "audit")
      } else {
        q.delete("tab")
      }
      const searchStr = q.toString()
      router.replace(`${pathname}${searchStr ? `?${searchStr}` : ""}`, {
        scroll: false,
      })
    },
    [pathname, router, searchParams]
  )

  if (onboarding.isFeatureLocked("webhook_logs")) {
    return (
      <>
        <LockedFeatureTeaser
          featureTitle={tLocked.title}
          featureDescription={tLocked.description}
          unlockLevel={3}
          prerequisiteDescription={tLocked.prerequisite}
          activeMissionHref="/console/whatsapp/messages"
          activeMissionLabel={tLocked.activeLabel}
          locale={locale}
        />
        <FlightHudWidget onboarding={onboarding} locale={locale} />
      </>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <FlightHudWidget locale={locale} onboarding={onboarding} />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.console.whatsapp.logs.heading}
        </h1>
        <p className="text-sm text-muted-foreground">
          {messages.console.whatsapp.logs.description}
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full space-y-6"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="webhooks">
            {messages.console.whatsapp.logs.tabMessages}
          </TabsTrigger>
          <TabsTrigger value="audit">
            {messages.console.whatsapp.logs.tabActivity}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="m-0 space-y-6">
          <WebhookLogsTabContent locale={locale} messages={messages} />
        </TabsContent>

        <TabsContent value="audit" className="m-0 space-y-6">
          <AuditLogsTabContent locale={locale} messages={messages} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

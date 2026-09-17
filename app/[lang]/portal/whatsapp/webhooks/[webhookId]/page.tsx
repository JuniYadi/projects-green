import { withAuth } from "@workos-inc/authkit-nextjs"
import type { Metadata } from "next"
import Link from "next/link"

import { prisma } from "@/lib/prisma"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DeliveryLogsSection,
  TestPingButton,
} from "@/modules/whatsapp/webhooks/ui/portal-delivery-logs"

export const metadata: Metadata = { title: "Webhook Details" }

type WebhookDetailPageProps = {
  params: Promise<{
    lang: string
    webhookId: string
  }>
}

const resolveAuthTypeLabel = (
  authType: string | null | undefined,
  messages: ReturnType<typeof getMessages>
) => {
  const labels: Record<string, string> = {
    bearer: messages.pPortalWhatsappWebhooksPage.authBearerToken,
    basic: messages.pPortalWhatsappWebhooksPage.authBasicAuth,
    "custom-header": messages.pPortalWhatsappWebhooksPage.authCustomHeader,
    none: messages.pPortalWhatsappWebhooksPage.authNone,
  }

  return (
    labels[authType ?? ""] ??
    authType ??
    messages.pPortalWhatsappWebhooksPage.authNone
  )
}

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "—"
  if (typeof date === "string") date = new Date(date)
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export default async function PortalWebhookDetailPage({
  params,
}: WebhookDetailPageProps) {
  const { lang, webhookId } = await params
  const messages = getMessages(resolveLocaleOrDefault(lang))

  await withAuth({ ensureSignedIn: true })

  const webhook = await prisma.whatsappWebhook.findUnique({
    where: { id: webhookId },
    include: { whatsappDevice: { select: { phoneNumber: true } } },
  })

  if (!webhook) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <h1 className="text-2xl font-semibold">
          {messages.pPortalWhatsappWebhooksPage.notFoundTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {messages.pPortalWhatsappWebhooksPage.webhookNotFound}
        </p>
        <Button variant="outline" asChild>
          <Link href="/portal/whatsapp/webhooks">
            {messages.pPortalWhatsappWebhooksPage.backToWebhooks}
          </Link>
        </Button>
      </main>
    )
  }

  // Delivery logs are rendered client-side via DeliveryLogsSection

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <Button variant="ghost" size="sm" className="w-fit px-0" asChild>
          <Link href="/portal/whatsapp/webhooks">
            ← {messages.pPortalWhatsappWebhooksPage.backToWebhooks}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">
          {messages.pPortalWhatsappWebhooksPage.pageTitle}
        </h1>
      </header>

      {/* Config Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            {messages.pPortalWhatsappWebhooksPage.configurationTitle}
          </CardTitle>
          <CardDescription>
            {messages.pPortalWhatsappWebhooksPage.configurationDescription.replace(
              "{device}",
              webhook.whatsappDevice?.phoneNumber ?? webhook.whatsappDeviceId
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.pPortalWhatsappWebhooksPage.webhookUrlLabel}
              </dt>
              <dd className="mt-1 font-mono text-sm">{webhook.webhookUrl}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.pPortalWhatsappWebhooksPage.statusLabel}
              </dt>
              <dd className="mt-1">
                <Badge variant={webhook.active ? "success" : "secondary"}>
                  {webhook.active
                    ? messages.pPortalWhatsappWebhooksPage.statusActive
                    : messages.pPortalWhatsappWebhooksPage.statusInactive}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.pPortalWhatsappWebhooksPage.authTypeLabel}
              </dt>
              <dd className="mt-1 text-sm">
                {resolveAuthTypeLabel(webhook.authType, messages)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.pPortalWhatsappWebhooksPage.retryMaxAttemptsLabel}
              </dt>
              <dd className="mt-1 text-sm">{webhook.retryMaxAttempts}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.pPortalWhatsappWebhooksPage.retryIntervalLabel}
              </dt>
              <dd className="mt-1 text-sm">{`${webhook.retryIntervalMs}ms`}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.pPortalWhatsappWebhooksPage.createdLabel}
              </dt>
              <dd className="mt-1 text-sm">{formatDate(webhook.createdAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Delivery Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {messages.pPortalWhatsappWebhooksPage.deliveryLogsTitle}
              </CardTitle>
              <CardDescription>
                {messages.pPortalWhatsappWebhooksPage.deliveryLogsDescription}
              </CardDescription>
            </div>
            <TestPingButton webhookId={webhookId} />
          </div>
        </CardHeader>
        <CardContent>
          <DeliveryLogsSection webhookId={webhookId} />
        </CardContent>
      </Card>
    </main>
  )
}

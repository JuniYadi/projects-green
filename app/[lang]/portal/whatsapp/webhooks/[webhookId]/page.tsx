import { withAuth } from "@workos-inc/authkit-nextjs"
import Link from "next/link"

import { prisma } from "@/lib/prisma"
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

type WebhookDetailPageProps = {
  params: Promise<{
    lang: string
    webhookId: string
  }>
}

const AUTH_LABELS: Record<string, string> = {
  bearer: "Bearer Token",
  basic: "Basic Auth",
  "custom-header": "Custom Header",
  none: "None",
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
  const { webhookId } = await params

  await withAuth({ ensureSignedIn: true })

  const webhook = await prisma.whatsappWebhook.findUnique({
    where: { id: webhookId },
    include: { whatsappDevice: { select: { phoneNumber: true } } },
  })

  if (!webhook) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <h1 className="text-2xl font-semibold">Not Found</h1>
        <p className="text-sm text-muted-foreground">Webhook not found.</p>
        <Button variant="outline" asChild>
          <Link href="/portal/whatsapp/webhooks">Back to Webhooks</Link>
        </Button>
      </main>
    )
  }

  // Delivery logs are rendered client-side via DeliveryLogsSection

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <Button variant="ghost" size="sm" className="w-fit px-0" asChild>
          <Link href="/portal/whatsapp/webhooks">← Back to Webhooks</Link>
        </Button>
        <h1 className="text-2xl font-semibold">Webhook Detail</h1>
      </header>

      {/* Config Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Outgoing webhook settings for device{" "}
            {webhook.whatsappDevice?.phoneNumber ?? webhook.whatsappDeviceId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Webhook URL
              </dt>
              <dd className="mt-1 font-mono text-sm">{webhook.webhookUrl}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Status
              </dt>
              <dd className="mt-1">
                <Badge variant={webhook.active ? "success" : "secondary"}>
                  {webhook.active ? "Active" : "Inactive"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Auth Type
              </dt>
              <dd className="mt-1 text-sm">
                {AUTH_LABELS[webhook.authType ?? ""] ??
                  webhook.authType ??
                  "None"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Retry Max Attempts
              </dt>
              <dd className="mt-1 text-sm">{webhook.retryMaxAttempts}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Retry Interval
              </dt>
              <dd className="mt-1 text-sm">{webhook.retryIntervalMs}ms</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Created
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
              <CardTitle>Delivery Logs</CardTitle>
              <CardDescription>
                Outgoing webhook delivery attempts.
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

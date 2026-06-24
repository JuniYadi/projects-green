import { withAuth } from "@workos-inc/authkit-nextjs"
import Link from "next/link"

import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { getPlatformRoleForUser } from "@/lib/platform-role"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  webhookDispatcher,
  toDeliveryLogDTO,
} from "@/modules/whatsapp/webhooks/webhook-dispatcher.service"

type WebhookDetailPageProps = {
  params: Promise<{
    lang: string
    webhookId: string
  }>
  searchParams: Promise<{
    deliveryPage?: string
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

const STATUS_VARIANTS: Record<string, "success" | "destructive" | "warning" | "default"> = {
  SUCCESS: "success",
  FAILED: "destructive",
  DEAD_LETTERED: "destructive",
  PENDING: "warning",
}

export default async function PortalWebhookDetailPage({
  params,
  searchParams,
}: WebhookDetailPageProps) {
  const { lang, webhookId } = await params
  const { deliveryPage } = await searchParams
  const locale = resolveLocaleOrDefault(lang)

  const auth = await withAuth({ ensureSignedIn: true })
  const platformRole = await getPlatformRoleForUser({
    id: auth.user.id,
    email: auth.user.email,
  })

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

  const deliveryPageNum = Math.max(Number(deliveryPage) || 1, 1)
  const deliveryLimit = 20

  const result = await webhookDispatcher.getDeliveryLogs(webhookId, {
    page: deliveryPageNum,
    limit: deliveryLimit,
  })

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
                {AUTH_LABELS[webhook.authType ?? ""] ?? webhook.authType ?? "None"}
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
              <dd className="mt-1 text-sm">
                {webhook.retryIntervalMs}ms
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Created
              </dt>
              <dd className="mt-1 text-sm">
                {formatDate(webhook.createdAt)}
              </dd>
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
            <form
              action={`/portal/whatsapp/webhooks/${webhookId}`}
              method="GET"
              className="contents"
            >
              {/* ponytail: minimal action, form for test ping — server action would need client component */}
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {result.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No delivery logs yet.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attempt</TableHead>
                      <TableHead>HTTP Status</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.data.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">{log.eventType}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              STATUS_VARIANTS[log.status] ?? "default"
                            }
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.attempt}/{log.maxAttempts}
                        </TableCell>
                        <TableCell>
                          {log.responseStatus ? (
                            <span
                              className={
                                log.responseStatus >= 200 &&
                                log.responseStatus < 300
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {log.responseStatus}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {log.errorMessage ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(log.startedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {result.meta.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deliveryPageNum <= 1}
                    asChild
                  >
                    <Link
                      href={`/portal/whatsapp/webhooks/${webhookId}?deliveryPage=${deliveryPageNum - 1}`}
                    >
                      Previous
                    </Link>
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {deliveryPageNum} of {result.meta.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deliveryPageNum >= result.meta.totalPages}
                    asChild
                  >
                    <Link
                      href={`/portal/whatsapp/webhooks/${webhookId}?deliveryPage=${deliveryPageNum + 1}`}
                    >
                      Next
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

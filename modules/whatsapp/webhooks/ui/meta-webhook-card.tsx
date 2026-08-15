import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type MetaWebhookInfo = {
  appName: string
  callbackUrl: string
}

type MetaWebhookCardProps = {
  metaWebhook: MetaWebhookInfo | null
}

function MetaWebhookRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1 border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium">{children}</dd>
    </div>
  )
}

export function MetaWebhookCard({ metaWebhook }: MetaWebhookCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Meta Webhook Setup</CardTitle>
        <CardDescription>
          Inbound Meta webhook configuration for this device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {metaWebhook ? (
          <dl className="space-y-3">
            <MetaWebhookRow label="Meta App">
              {metaWebhook.appName}
            </MetaWebhookRow>
            <MetaWebhookRow label="Callback URL">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs break-all">
                {metaWebhook.callbackUrl}
              </code>
            </MetaWebhookRow>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No Meta App is attached to this device. Inbound Meta webhooks are
            not configured.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

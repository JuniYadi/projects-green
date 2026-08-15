import { getEmailBaseUrl } from "@/lib/email-url"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type MetaWebhookCardProps = {
  metaApp: {
    name: string
    callbackPath: string
  } | null
}

export function MetaWebhookCard({ metaApp }: MetaWebhookCardProps) {
  const callbackUrl = metaApp
    ? `${getEmailBaseUrl()}${metaApp.callbackPath}`
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meta Webhook</CardTitle>
        <CardDescription>
          Inbound Meta events use the callback configured for this device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {metaApp && callbackUrl ? (
          <dl className="space-y-3">
            <div className="space-y-1 border-b pb-3 last:border-0 last:pb-0">
              <dt className="text-sm text-muted-foreground">Meta App</dt>
              <dd className="text-sm font-medium">{metaApp.name}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Callback URL</dt>
              <dd>
                <code className="block rounded bg-muted px-2 py-1 text-xs break-all">
                  {callbackUrl}
                </code>
              </dd>
            </div>
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

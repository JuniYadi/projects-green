import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { DeviceMobile, Compass, Desktop } from "@phosphor-icons/react"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { AudienceBucket } from "../../opensearch/opensearch-traffic.types"

export interface TrafficAudienceCardProps {
  device: AudienceBucket[]
  browser: AudienceBucket[]
  os: AudienceBucket[]
}

function AudienceBucketList({
  buckets,
  emptyLabel,
}: {
  buckets: AudienceBucket[]
  emptyLabel: string
}) {
  if (buckets.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {buckets.map((b) => (
        <div key={b.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="truncate font-medium text-foreground">
              {b.label}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {b.percentage}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
            <div
              style={{ width: `${Math.max(b.percentage, 3)}%` }}
              className="h-full rounded-full bg-primary"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TrafficAudienceCard({
  device,
  browser,
  os,
}: TrafficAudienceCardProps) {
  const params = useParams<{ lang?: string }>()
  const t = getMessages(
    resolveLocaleOrDefault(params?.lang)
  ).pDeployOperateTrafficAudienceCard
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <DeviceMobile size={18} className="text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                {t.deviceTitle}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t.deviceDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AudienceBucketList buckets={device} emptyLabel={t.emptyState} />
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                {t.browserTitle}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t.browserDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AudienceBucketList buckets={browser} emptyLabel={t.emptyState} />
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Desktop size={18} className="text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                {t.osTitle}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t.osDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AudienceBucketList buckets={os} emptyLabel={t.emptyState} />
        </CardContent>
      </Card>
    </div>
  )
}

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { DeviceMobile, Compass, Desktop } from "@phosphor-icons/react"
import type { AudienceBucket } from "../../opensearch/opensearch-traffic.types"

export interface TrafficAudienceCardProps {
  device: AudienceBucket[]
  browser: AudienceBucket[]
  os: AudienceBucket[]
}

function AudienceBucketList({ buckets }: { buckets: AudienceBucket[] }) {
  if (buckets.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
        Belum ada data
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
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <DeviceMobile size={18} className="text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Perangkat
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Top 5 kelas perangkat
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AudienceBucketList buckets={device} />
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Browser
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Top 5 klien browser
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AudienceBucketList buckets={browser} />
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Desktop size={18} className="text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Sistem Operasi
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Top 5 sistem operasi
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AudienceBucketList buckets={os} />
        </CardContent>
      </Card>
    </div>
  )
}

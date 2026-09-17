import { useParams } from "next/navigation"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Compass, WarningCircle, CheckCircle } from "@phosphor-icons/react"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type {
  TrafficErrorPath,
  TrafficPathCount,
} from "../../opensearch/opensearch-traffic.types"

export interface TrafficTopPagesCardProps {
  topPages: TrafficPathCount[]
  troubledPages: TrafficErrorPath[]
  locale?: string
}

export function TrafficTopPagesCard({
  topPages,
  troubledPages,
  locale: localeProp,
}: TrafficTopPagesCardProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(localeProp ?? params?.lang)
  const messages = getMessages(locale)
  const t = messages.pDeployOperateTrafficTopPagesCard
  const numLocale = locale === "en" ? "en-US" : "id-ID"
  const maxViews = topPages.length > 0 ? topPages[0].views : 1

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* 1. Halaman Terpopuler */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                {t.topPagesTitle}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t.topPagesDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {topPages.length === 0 ? (
            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              {t.emptyTopPages}
            </div>
          ) : (
            <div className="space-y-3">
              {topPages.map((page, idx) => {
                const ratio = Math.max(
                  Math.round((page.views / maxViews) * 100),
                  5
                )
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="max-w-[240px] truncate font-mono text-foreground sm:max-w-[320px]">
                        {page.path}
                      </span>
                      <span className="font-semibold text-muted-foreground">
                        {page.views.toLocaleString(numLocale)} {t.viewsUnit}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
                      <div
                        style={{ width: `${ratio}%` }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Deteksi Error & Link Rusak */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <WarningCircle size={18} className="text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                {t.troubledPagesTitle}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t.troubledPagesDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {troubledPages.length === 0 ? (
            <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-center text-xs text-emerald-500">
              <CheckCircle size={24} weight="duotone" />
              <div>
                <p className="font-semibold">{t.allLinksCleanTitle}</p>
                <p className="text-muted-foreground">
                  {t.allLinksCleanDescription}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {troubledPages.map((err, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/10 p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-destructive/30 bg-destructive/10 font-mono text-[10px] text-destructive"
                    >
                      {err.sampleStatus}
                    </Badge>
                    <span className="max-w-[200px] truncate font-mono text-foreground sm:max-w-[280px]">
                      {err.path}
                    </span>
                  </div>
                  <span className="font-medium text-destructive">
                    {t.failedCount.replace(
                      "{count}",
                      err.errors.toLocaleString(numLocale)
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

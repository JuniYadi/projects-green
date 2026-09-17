import { useParams } from "next/navigation"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CountryFlag } from "@/components/ui/country-flag"
import { GlobeHemisphereWest, Users, Eye } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { TrafficCountryCount } from "../../opensearch/opensearch-traffic.types"
import type { IpGeoInfo } from "../../opensearch/geoip-lookup.service"

export interface TrafficGeoCardProps {
  topCountries: TrafficCountryCount[]
  topIps: IpGeoInfo[]
  onReviewIp?: (ip: string) => void
  locale?: string
}

export function TrafficGeoCard({
  topCountries,
  topIps,
  onReviewIp,
  locale: localeProp,
}: TrafficGeoCardProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(localeProp ?? params?.lang)
  const messages = getMessages(locale)
  const t = messages.pDeployOperateTrafficGeoCard
  const numLocale = locale === "en" ? "en-US" : "id-ID"
  const maxCountryReqs = topCountries.length > 0 ? topCountries[0].requests : 1

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* 1. Asal Negara Pengunjung */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <GlobeHemisphereWest size={18} className="text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                {t.countryOriginTitle}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t.countryOriginDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {topCountries.length === 0 ? (
            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              {t.emptyCountryData}
            </div>
          ) : (
            <div className="space-y-3">
              {topCountries.map((c, idx) => {
                const ratio = Math.max(
                  Math.round((c.requests / maxCountryReqs) * 100),
                  5
                )
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <CountryFlag
                          country={c.countryCode}
                          className="rounded-2xs h-3.5 w-5 shrink-0 object-cover shadow-2xs"
                          fallback={
                            <GlobeHemisphereWest
                              size={16}
                              className="shrink-0 text-muted-foreground"
                            />
                          }
                        />
                        <span>{c.countryName}</span>
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 font-mono text-[10px]"
                        >
                          {c.countryCode}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {c.percentage}%
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          ({c.requests.toLocaleString(numLocale)} {t.reqUnit})
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
                      <div
                        style={{ width: `${ratio}%` }}
                        className="h-full rounded-full bg-emerald-500"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Top 10 Pengunjung Klien IP */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                {t.topIpsTitle}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t.topIpsDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {topIps.length === 0 ? (
            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              {t.emptyIpData}
            </div>
          ) : (
            <div className="max-h-[280px] space-y-2 overflow-y-auto">
              {topIps.map((item, idx) => {
                const total = item.requestsCount || 1
                const segments = [
                  {
                    key: "2xx",
                    count: item.status2xx,
                    className: "bg-emerald-500",
                  },
                  {
                    key: "3xx",
                    count: item.status3xx,
                    className: "bg-sky-500",
                  },
                  {
                    key: "4xx",
                    count: item.status4xx,
                    className: "bg-amber-500",
                  },
                  {
                    key: "5xx",
                    count: item.status5xx,
                    className: "bg-rose-500",
                  },
                ].filter((seg) => seg.count > 0)
                return (
                  <div
                    key={idx}
                    className="space-y-1.5 rounded-md border border-border bg-muted/10 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CountryFlag
                          country={item.countryCode}
                          className="rounded-2xs h-3.5 w-5 shrink-0 object-cover shadow-2xs"
                          fallback={
                            <GlobeHemisphereWest
                              size={16}
                              className="shrink-0 text-muted-foreground"
                            />
                          }
                        />
                        <div>
                          <div className="font-mono font-medium text-foreground">
                            {item.ip}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {[item.city, item.countryName]
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-semibold text-foreground">
                            {item.requestsCount.toLocaleString(numLocale)}
                          </span>
                          <span className="ml-1 text-[11px] text-muted-foreground">
                            {t.reqUnit}
                          </span>
                        </div>
                        {onReviewIp ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => onReviewIp(item.ip)}
                            title={t.reviewIpTitle}
                          >
                            <Eye size={12} className="mr-1" />
                            {t.reviewButton}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-muted/20">
                      {segments.map((seg) => (
                        <div
                          key={seg.key}
                          style={{ width: `${(seg.count / total) * 100}%` }}
                          className={`h-full ${seg.className}`}
                          role="img"
                          aria-label={t.requestsCountLabel
                            .replace("{key}", seg.key)
                            .replace(
                              "{count}",
                              seg.count.toLocaleString(numLocale)
                            )}
                          title={`${seg.key}: ${seg.count.toLocaleString(numLocale)}`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                        {item.successRatio}% {t.successSuffix}
                      </span>
                      {segments.map((seg) => (
                        <span
                          key={seg.key}
                          className="shrink-0 text-[10px] text-muted-foreground"
                        >
                          {seg.count.toLocaleString(numLocale)} {seg.key}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

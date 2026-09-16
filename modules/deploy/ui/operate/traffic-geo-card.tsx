import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CountryFlag } from "@/components/ui/country-flag"
import { GlobeHemisphereWest, Users } from "@phosphor-icons/react"
import type { TrafficCountryCount } from "../../opensearch/opensearch-traffic.types"
import type { IpGeoInfo } from "../../opensearch/geoip-lookup.service"

export interface TrafficGeoCardProps {
  topCountries: TrafficCountryCount[]
  topIps: IpGeoInfo[]
}

export function TrafficGeoCard({ topCountries, topIps }: TrafficGeoCardProps) {
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
                Asal Negara Pengunjung (GeoIP)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Distribusi geografis berdasarkan resolusi alamat IP klien
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {topCountries.length === 0 ? (
            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              Belum ada data geolokasi pengunjung
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
                          ({c.requests.toLocaleString("id-ID")} req)
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
                Top 10 Alamat IP Pengunjung
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                IP dengan frekuensi permintaan paling aktif ke aplikasi
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {topIps.length === 0 ? (
            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              Belum ada data client IP yang tercatat
            </div>
          ) : (
            <div className="max-h-[280px] space-y-2 overflow-y-auto">
              {topIps.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/10 px-3 py-2 text-xs"
                >
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
                  <div className="text-right">
                    <span className="font-semibold text-foreground">
                      {item.requestsCount.toLocaleString("id-ID")}
                    </span>
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      req
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { VpnPackageSummary } from "@/lib/vpn-client"
import { recommendedPackageId } from "@/lib/vpn-packages"

import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
type Props = {
  packages: VpnPackageSummary[]
  locale?: string
}

function formatPrice(price: string, currency: string): string {
  const amount = Number(price)
  if (Number.isNaN(amount)) return `${currency} ${price}`
  if (currency === "IDR") return `Rp${amount.toLocaleString("id-ID")}`
  return `${currency} ${amount.toLocaleString("en-US")}`
}

function displayPrice(pkg: VpnPackageSummary): string {
  return formatPrice(
    pkg.convertedPrice ?? pkg.price,
    pkg.convertedCurrency ?? pkg.currency
  )
}

function bestFor(pkg: VpnPackageSummary, t: Record<string, string>): string {
  if (pkg.serverCount >= 10 || pkg.regions.length >= 6) return t.bestForTeams
  if (pkg.serverCount >= 5 || pkg.regions.length >= 3)
    return t.bestForMultiRegion
  return t.bestForFirstVpn
}

export function VpnPackageComparison({ packages, locale: propLocale }: Props) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(propLocale ?? params?.lang)
  const messages = getMessages(locale)
  const t = messages.pConsoleVpnPackageComparison
  if (packages.length === 0) return null

  const recommendedId = recommendedPackageId(packages)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.comparePackages}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-36">{t.feature}</TableHead>
              {packages.map((pkg) => (
                <TableHead key={pkg.id} className="min-w-40">
                  <span className="flex items-center gap-2">
                    {pkg.name}
                    {pkg.id === recommendedId && (
                      <Badge variant="secondary">{t.mostCoverage}</Badge>
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">{t.price}</TableCell>
              {packages.map((pkg) => (
                <TableCell key={pkg.id}>
                  {displayPrice(pkg)} {t.perMonth}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">{t.regions}</TableCell>
              {packages.map((pkg) => (
                <TableCell key={pkg.id}>{pkg.regions.length}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">{t.regionCoverage}</TableCell>
              {packages.map((pkg) => (
                <TableCell key={pkg.id}>
                  {pkg.regions.length > 0 ? pkg.regions.join(", ") : "-"}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">{t.servers}</TableCell>
              {packages.map((pkg) => (
                <TableCell key={pkg.id}>{pkg.serverCount}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">{t.protocols}</TableCell>
              {packages.map((pkg) => (
                <TableCell key={pkg.id}>{pkg.protocolCount}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">{t.bestFor}</TableCell>
              {packages.map((pkg) => (
                <TableCell key={pkg.id}>{bestFor(pkg, t)}</TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

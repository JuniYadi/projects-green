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

type Props = {
  packages: VpnPackageSummary[]
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

function bestFor(pkg: VpnPackageSummary): string {
  if (pkg.serverCount >= 10 || pkg.regions.length >= 6) return "Teams"
  if (pkg.serverCount >= 5 || pkg.regions.length >= 3) return "Multi-region"
  return "First VPN"
}

export function VpnPackageComparison({ packages }: Props) {
  if (packages.length === 0) return null

  const recommendedId = recommendedPackageId(packages)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare Packages</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-36">Feature</TableHead>
              {packages.map((pkg) => (
                <TableHead key={pkg.id} className="min-w-40">
                  <span className="flex items-center gap-2">
                    {pkg.name}
                    {pkg.id === recommendedId && (
                      <Badge variant="secondary">Most coverage</Badge>
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Price</TableCell>
              {packages.map((pkg) => (
                <TableCell key={pkg.id}>{displayPrice(pkg)} / month</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Regions</TableCell>
              {packages.map((pkg) => (
                <TableCell key={pkg.id}>{pkg.regions.length}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Region coverage</TableCell>
              {packages.map((pkg) => (
                <TableCell key={pkg.id}>
                  {pkg.regions.length > 0 ? pkg.regions.join(", ") : "-"}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Servers</TableCell>
              {packages.map((pkg) => (
                <TableCell key={pkg.id}>{pkg.serverCount}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Protocols</TableCell>
              {packages.map((pkg) => (
                <TableCell key={pkg.id}>{pkg.protocolCount}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Best for</TableCell>
              {packages.map((pkg) => (
                <TableCell key={pkg.id}>{bestFor(pkg)}</TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

import Link from "next/link"

import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge, DeviceEmptyState } from "./_components/devices-ui"
import { Button } from "@/components/ui/button"
import { Plus } from "@phosphor-icons/react"

type DevicesPageProps = {
  params: Promise<{
    lang: string
  }>
}

const formatDate = (date: string) => {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date))
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount)
}

export default async function PortalWhatsAppDevicesPage({
  params,
}: DevicesPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)

  let devices: Array<{
    id: string
    phoneNumber: string
    name: string
    status: string
    balance: number
    quotaBase: number
    dailyLimitMessage: number
    organizationId: string
    createdAt: string
  }> = []

  try {
    const response = await whatsappClient.devices.list()
    if (response.ok) {
      devices = response.devices
    }
  } catch {
    // Devices will remain empty on error
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">WhatsApp Devices</h1>
        <p className="text-sm text-muted-foreground">
          Manage all WhatsApp Business devices across organizations.
        </p>
      </header>

      <section className="grid gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">All Devices</CardTitle>
                <CardDescription>
                  View and manage WhatsApp devices across all organizations
                </CardDescription>
              </div>
              <Link
                href={localizePathname({
                  pathname: "/portal/whatsapp/devices/new",
                  locale,
                })}
              >
                <Button size="sm">
                  <Plus className="mr-1.5 size-4" />
                  Add Device
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <DeviceEmptyState />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Quota Base</TableHead>
                    <TableHead className="text-right">Daily Limit</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <Link
                          href={localizePathname({
                            pathname: `/portal/whatsapp/devices/${device.id}`,
                            locale,
                          })}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {device.phoneNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {device.name || "-"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={device.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(device.balance)}
                      </TableCell>
                      <TableCell className="text-right">
                        {device.quotaBase.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {device.dailyLimitMessage.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(device.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

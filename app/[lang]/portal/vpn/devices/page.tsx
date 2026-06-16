import { VpnDevicesTable } from "../_components/vpn-devices-table"

export default function PortalVpnDevicesPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">VPN Devices</h1>
        <p className="text-sm text-muted-foreground">
          View and manage all VPN mobile devices across subscriptions.
        </p>
      </header>
      <VpnDevicesTable />
    </main>
  )
}

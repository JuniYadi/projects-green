import { VpnManagementTabs } from "./vpn-management-tabs"

export default async function AdminVpnPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">VPN Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage VPN regions, servers, and SSH keys.
        </p>
      </header>
      <VpnManagementTabs />
    </main>
  )
}

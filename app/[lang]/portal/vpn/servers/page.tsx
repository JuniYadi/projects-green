import { ServersTable } from "../_components/servers-table"

export default async function VpnServersPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Servers</h1>
        <p className="text-sm text-muted-foreground">
          Add VPN servers and control which protocols each supports.
        </p>
      </header>
      <ServersTable />
    </main>
  )
}

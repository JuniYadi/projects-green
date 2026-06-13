import { RegionsTable } from "../_components/regions-table"

export default async function VpnRegionsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Regions</h1>
        <p className="text-sm text-muted-foreground">
          Define where VPN servers are located.
        </p>
      </header>
      <RegionsTable />
    </main>
  )
}

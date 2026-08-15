import { PackagesTable } from "../_components/packages-table"

export default async function VpnPackagesPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Packages</h1>
        <p className="text-sm text-muted-foreground">
          A VPN package owns server and protocol composition. The global VPN
          catalog owns plans, terms, offers, and publishing; each package maps
          to one catalog plan.
        </p>
      </header>
      <PackagesTable />
    </main>
  )
}

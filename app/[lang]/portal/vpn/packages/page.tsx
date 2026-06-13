import { PackagesTable } from "../_components/packages-table"

export default async function VpnPackagesPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Packages</h1>
        <p className="text-sm text-muted-foreground">
          Define VPN packages, pricing, and the servers each package includes.
        </p>
      </header>
      <PackagesTable />
    </main>
  )
}

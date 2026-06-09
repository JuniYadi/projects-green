import { OrganizationsTable } from "./organizations-table"

export default async function OrganizationsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Manage all organizations on the platform
        </p>
      </header>
      <OrganizationsTable />
    </main>
  )
}

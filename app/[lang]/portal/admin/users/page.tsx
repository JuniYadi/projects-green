import type { Metadata } from "next"

import { UsersTable } from "./users-table"

export const metadata: Metadata = { title: "Users" }

export default async function UsersPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage and inspect all users across organizations on the platform
        </p>
      </header>
      <UsersTable />
    </main>
  )
}

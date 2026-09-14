import type { Metadata } from "next"

import { InvitationsTable } from "./invitations-table"

export const metadata: Metadata = { title: "Invitations" }

export default async function InvitationsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Invitations</h1>
        <p className="text-sm text-muted-foreground">
          View, send, and manage invitations across all organizations on the
          platform
        </p>
      </header>
      <InvitationsTable />
    </main>
  )
}

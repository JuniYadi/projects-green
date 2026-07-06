"use client"

import { useState } from "react"
import { AdminTopupForm } from "@/components/billing/admin/admin-topup-form"

export default function PortalBillingTopupPage() {
  const [orgId, setOrgId] = useState("")
  const [entered, setEntered] = useState(false)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">Top Up</h1>
        <p className="text-muted-foreground">
          Credit balance to any organization
        </p>
      </header>

      {!entered ? (
        <div className="max-w-md space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the organization ID (UUID) to top up its billing balance.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Organization ID (UUID)"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              onClick={() => orgId.trim() && setEntered(true)}
              disabled={!orgId.trim()}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Org ID:</span>
            <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{orgId}</code>
            <button
              onClick={() => { setEntered(false); setOrgId("") }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Change
            </button>
          </div>
          <AdminTopupForm orgId={orgId} onSuccess={() => {}} />
        </div>
      )}
    </main>
  )
}

import { AuditLogsTable } from "../_components/audit-logs-table"

export default async function VpnAuditLogsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Track every VPN provisioning step, revocation, configuration
          download, and admin action. Expand any row to inspect the full
          detail payload.
        </p>
      </header>
      <AuditLogsTable />
    </main>
  )
}

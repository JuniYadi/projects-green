import { Suspense } from "react"
import { getAdminAuditLogs, type AdminAuditLogItem } from "@/lib/billing-client"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function ActionBadge({ action }: { action: string }) {
  const colorMap: Record<string, string> = {
    CREATED: "bg-green-500/10 text-green-600 border-green-500/20",
    UPDATED: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    DELETED: "bg-red-500/10 text-red-600 border-red-500/20",
    RUN_STARTED: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    RUN_FINISHED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    INVOICE_GENERATED: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    PAYMENT_CONFIRMED: "bg-green-500/10 text-green-600 border-green-500/20",
    ORDER_CREATED: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    BALANCE_ADJUSTED: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    TOPUP_PERFORMED: "bg-teal-500/10 text-teal-600 border-teal-500/20",
    SUBSCRIPTION_ACTIVATED:
      "bg-green-500/10 text-green-600 border-green-500/20",
    SUBSCRIPTION_CANCELLED: "bg-red-500/10 text-red-600 border-red-500/20",
    CONTACT_ADDED: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    CONTACT_REMOVED: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    SETTINGS_CHANGED: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  }

  const colorClass = colorMap[action] ?? "bg-muted text-muted-foreground"

  return (
    <Badge variant="outline" className={`border ${colorClass}`}>
      {action}
    </Badge>
  )
}

async function AuditLogsList() {
  const { logs, pagination } = await getAdminAuditLogs({ limit: 50 })

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No audit logs found.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-medium">
            Billing Audit Trail ({pagination.total} total)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pr-4 pb-2 font-medium">Timestamp</th>
                  <th className="pr-4 pb-2 font-medium">Entity Type</th>
                  <th className="pr-4 pb-2 font-medium">Entity ID</th>
                  <th className="pr-4 pb-2 font-medium">Action</th>
                  <th className="pr-4 pb-2 font-medium">Actor</th>
                  <th className="pb-2 font-medium">Context</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: AdminAuditLogItem) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                        {log.entityType}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                      {log.entityId}
                    </td>
                    <td className="py-3 pr-4">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      <div className="space-y-0.5">
                        <div className="text-xs">{log.actorType}</div>
                        {log.actorId && (
                          <div className="font-mono text-xs text-muted-foreground/70">
                            {log.actorId}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {log.contextJson ? (
                        <pre className="max-w-xs overflow-hidden text-xs text-muted-foreground">
                          {JSON.stringify(log.contextJson)}
                        </pre>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function AuditLogsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide billing audit trail
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96" />}>
        <AuditLogsList />
      </Suspense>
    </main>
  )
}

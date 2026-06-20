import { CheckCircle, XCircle, ArrowsClockwise, Circle } from "@phosphor-icons/react"
import type { VpnServerAccountEntry } from "./vpn-admin-client"

export type AuditEventType =
  | "PROVISIONING_STARTED"
  | "PROVISIONING_SUCCESS"
  | "PROVISIONING_FAILED"
  | "PROVISIONING_RETRIED"
  | "PROVISIONING_REVOKED"

export type AuditEvent = {
  type: AuditEventType
  timestamp: string
  detail?: string
}

type Props = {
  account: VpnServerAccountEntry
  events: AuditEvent[]
}

const EVENT_CONFIG: Record<
  AuditEventType,
  { icon: React.ElementType; color: string; label: string }
> = {
  PROVISIONING_STARTED: {
    icon: Circle,
    color: "text-blue-500",
    label: "Started",
  },
  PROVISIONING_SUCCESS: {
    icon: CheckCircle,
    color: "text-green-500",
    label: "Success",
  },
  PROVISIONING_FAILED: {
    icon: XCircle,
    color: "text-red-500",
    label: "Failed",
  },
  PROVISIONING_RETRIED: {
    icon: ArrowsClockwise,
    color: "text-amber-500",
    label: "Retried",
  },
  PROVISIONING_REVOKED: {
    icon: XCircle,
    color: "text-gray-500",
    label: "Revoked",
  },
}

export function ProvisioningTimeline({ account, events }: Props) {
  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={getStatusVariant(account.provisioningStatus)}>
          {account.provisioningStatus}
        </Badge>
        <span>No audit events yet</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={getStatusVariant(account.provisioningStatus)}>
          {account.provisioningStatus}
        </Badge>
        <span>{account.serverName}</span>
        <span className="text-xs">{account.protocol}</span>
      </div>
      <ol className="relative border-l border-border pl-4 space-y-3">
        {events.map((event, i) => {
          const config = EVENT_CONFIG[event.type]
          const Icon = config.icon
          return (
            <li key={i} className="relative">
              <Icon
                className={`absolute -left-5 top-0.5 h-4 w-4 ${config.color}`}
                weight="fill"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{config.label}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
                {event.detail && (
                  <span className="text-xs text-muted-foreground">
                    {event.detail}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function getStatusVariant(
  status: VpnServerAccountEntry["provisioningStatus"]
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "default"
    case "PENDING":
    case "PROVISIONING":
      return "outline"
    case "FAILED":
      return "destructive"
    case "REVOKED":
      return "secondary"
  }
}

import { Badge } from "@/components/ui/badge"

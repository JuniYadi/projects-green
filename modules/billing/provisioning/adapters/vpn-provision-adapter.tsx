"use client"

import { useEffect, useState } from "react"
import { z } from "zod"

import {
  listVpnServers,
  type VpnServerItem,
} from "@/app/[lang]/portal/vpn/_components/vpn-admin-client"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ProductProvisionAdapter } from "../product-provision-adapter.types"

export type VpnPlanConfig = {
  serverIds: string[]
  customUsername: boolean
}

export const DEFAULT_VPN_PLAN_CONFIG: VpnPlanConfig = {
  serverIds: [],
  customUsername: false,
}
export const DEFAULT_VPN_BLUEPRINT = DEFAULT_VPN_PLAN_CONFIG

const vpnPlanConfigSchema = z.object({
  serverIds: z.array(z.string().trim().min(1)).default([]),
  customUsername: z.boolean().default(false),
})
export function parseVpnPlanConfig(value: unknown): VpnPlanConfig {
  const raw = value as { provisioning?: unknown } | null | undefined
  const parsed = vpnPlanConfigSchema.safeParse(raw?.provisioning ?? raw)
  return parsed.success ? parsed.data : DEFAULT_VPN_PLAN_CONFIG
}

export const parseVpnBlueprint = parseVpnPlanConfig
export function validateVpnPlanConfig(value: unknown) {
  const raw = value as { provisioning?: unknown } | null | undefined
  const parsed = vpnPlanConfigSchema.safeParse(raw?.provisioning ?? raw)
  if (!parsed.success) {
    return {
      valid: false,
      errors: zodErrors(parsed.error),
    }
  }

  if (parsed.data.serverIds.length === 0) {
    return {
      valid: false,
      errors: { serverIds: "Select at least one active VPN server." },
    }
  }

  return { valid: true as const }
}

function zodErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [
      String(issue.path[0] ?? "config"),
      issue.message,
    ])
  )
}

function protocolLabel(protocol: "openVpn" | "wireGuard" | "proxy") {
  return protocol === "openVpn"
    ? "OpenVPN"
    : protocol === "wireGuard"
      ? "WireGuard"
      : "Proxy"
}

export function VpnPlanConfigComponent({
  value,
  onChange,
  disabled,
  errors,
}: Readonly<{
  value: VpnPlanConfig
  onChange: (config: VpnPlanConfig) => void
  disabled?: boolean
  errors?: Record<string, string>
}>) {
  const [servers, setServers] = useState<VpnServerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void listVpnServers()
      .then((response) => {
        if (mounted)
          setServers(response.data.filter((server) => server.isActive))
      })
      .catch((error: unknown) => {
        if (mounted) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load servers."
          )
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const toggleServer = (serverId: string, checked: boolean) => {
    const serverIds = checked
      ? [...new Set([...value.serverIds, serverId])]
      : value.serverIds.filter((id) => id !== serverId)
    onChange({ ...value, serverIds })
  }

  return (
    <section className="space-y-4 rounded-md border p-4">
      <div>
        <h3 className="font-medium">VPN provisioning</h3>
        <p className="text-sm text-muted-foreground">
          Choose the active servers that should provision this plan.
        </p>
      </div>
      {loading && (
        <p className="text-sm text-muted-foreground">Loading VPN servers...</p>
      )}
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {!loading && !loadError && servers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No active VPN servers are available.
        </p>
      )}
      <div className="space-y-2">
        {servers.map((server) => (
          <label
            key={server.id}
            className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
          >
            <Switch
              checked={value.serverIds.includes(server.id)}
              onCheckedChange={(checked) => toggleServer(server.id, checked)}
              disabled={disabled}
              aria-label={`Use ${server.name}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{server.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {server.hostname} · {server.region.name}
              </span>
              <span className="mt-1 flex flex-wrap gap-1">
                {(["openVpn", "wireGuard", "proxy"] as const)
                  .filter((protocol) => server.protocols[protocol].enabled)
                  .map((protocol) => (
                    <Badge key={protocol} variant="secondary">
                      {protocolLabel(protocol)}
                    </Badge>
                  ))}
              </span>
            </span>
          </label>
        ))}
      </div>
      {errors?.serverIds && (
        <p className="text-sm text-destructive" role="alert">
          {errors.serverIds}
        </p>
      )}
      <div className="flex items-center justify-between gap-4 border-t pt-3">
        <Label htmlFor="vpn-custom-username">Allow custom username</Label>
        <Switch
          id="vpn-custom-username"
          checked={value.customUsername}
          onCheckedChange={(customUsername) =>
            onChange({ ...value, customUsername })
          }
          disabled={disabled}
        />
      </div>
    </section>
  )
}

export const VpnProvisionAdapter: ProductProvisionAdapter<VpnPlanConfig> = {
  id: "VPN",
  name: "VPN",
  description: "Provision VPN access on selected active servers.",
  defaultConfig: DEFAULT_VPN_PLAN_CONFIG,
  defaultBlueprint: DEFAULT_VPN_PLAN_CONFIG,
  parsePlanConfig: parseVpnPlanConfig,
  parseBlueprint: parseVpnBlueprint,
  PlanConfigComponent: VpnPlanConfigComponent,
  validatePlanConfig: validateVpnPlanConfig,
}

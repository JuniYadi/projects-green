"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowsClockwise, ArrowUp, ArrowDown } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { eden } from "@/lib/eden"
import { useTemplates } from "@/modules/whatsapp/templates/api/templates.hooks"
import { TemplateList } from "@/modules/whatsapp/templates/ui/template-list"
import type { WhatsAppTemplate } from "@/lib/api/whatsapp-client"

type TemplatesPageClientProps = {
  isSuperAdmin: boolean
}

const SYNC_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "SYNCED", label: "Synced" },
  { value: "NOT_SYNCED", label: "Not Synced" },
  { value: "NOT_IN_META", label: "Not In Meta" },
] as const

export function TemplatesPageClient({ isSuperAdmin }: TemplatesPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const organizationId = searchParams.get("organizationId") ?? undefined
  const whatsappDeviceId = searchParams.get("whatsappDeviceId") ?? undefined
  const syncStatus = searchParams.get("syncStatus") ?? undefined
  const sort = searchParams.get("sort") ?? "desc"

  const { templates, loading, error, reload } = useTemplates({
    organizationId,
    whatsappDeviceId,
    syncStatus: syncStatus || undefined,
    sort,
  })

  // ── Org list for super_admin ────────────────────────────────────────
  const [organizations, setOrganizations] = React.useState<
    { id: string; name: string }[]
  >([])
  const [orgsLoading, setOrgsLoading] = React.useState(false)
  const [orgsError, setOrgsError] = React.useState<string | null>(null)

  const loadOrganizations = React.useCallback(async () => {
    if (!isSuperAdmin) return
    setOrgsLoading(true)
    setOrgsError(null)
    try {
      const { data } = await eden.api.admin.organizations.get({
        $query: { limit: 100 },
      })
      const body = data as unknown as {
        ok: boolean
        data: { organizations: { id: string; name: string }[] }
      }
      if (body?.ok) {
        setOrganizations(body.data.organizations)
      }
    } catch {
      setOrgsError("Failed to load organizations")
    } finally {
      setOrgsLoading(false)
    }
  }, [isSuperAdmin])

  React.useEffect(() => {
    if (isSuperAdmin) void loadOrganizations()
  }, [isSuperAdmin, loadOrganizations])

  // ── Device list ─────────────────────────────────────────────────────
  const [devices, setDevices] = React.useState<
    { id: string; phoneNumber: string; name?: string | null }[]
  >([])
  const [devicesLoading, setDevicesLoading] = React.useState(false)
  const [devicesError, setDevicesError] = React.useState<string | null>(null)

  const loadDevices = React.useCallback(async () => {
    setDevicesLoading(true)
    setDevicesError(null)
    try {
      const query: Record<string, string> = {}
      if (organizationId) query.organizationId = organizationId
      const { data } = await eden.api.whatsapp.devices.get({
        $query: query,
      })
      const body = data as unknown as {
        ok: boolean
        devices: { id: string; phoneNumber: string; name?: string | null }[]
      }
      if (body?.ok) {
        setDevices(body.devices)
      }
    } catch {
      setDevicesError("Failed to load devices")
    } finally {
      setDevicesLoading(false)
    }
  }, [organizationId])

  React.useEffect(() => {
    void loadDevices()
  }, [loadDevices])

  // ── Filter helpers ──────────────────────────────────────────────────

  const setParam = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.set("page", "1")
    const qs = params.toString()
    router.push(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }

  const clearFilters = () => {
    router.push(window.location.pathname, { scroll: false })
  }

  const hasFilters = !!(organizationId || whatsappDeviceId || syncStatus || sort !== "desc")

  // ── Navigation on select ────────────────────────────────────────────

  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    if (template.whatsappDeviceId) {
      router.push(
        `/portal/whatsapp/devices/${template.whatsappDeviceId}?tab=template`
      )
    } else {
      router.push(`./${template.id}`)
    }
  }

  return (
    <ErrorBoundary>
      <div className="space-y-4">
        {/* ── Filter bar ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Org filter — super_admin only */}
          {isSuperAdmin && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">
                Organization
              </label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                value={organizationId ?? ""}
                onChange={(e) => setParam("organizationId", e.target.value || undefined)}
                disabled={orgsLoading}
                aria-label="Filter by organization"
              >
                <option value="">All organizations</option>
                {orgsError ? (
                  <option value="" disabled>
                    {orgsError}
                  </option>
                ) : (
                  organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Device filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Device</label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
              value={whatsappDeviceId ?? ""}
              onChange={(e) => setParam("whatsappDeviceId", e.target.value || undefined)}
              disabled={devicesLoading}
              aria-label="Filter by device"
            >
              <option value="">All devices</option>
              {devicesError ? (
                <option value="" disabled>
                  {devicesError}
                </option>
              ) : (
                devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.phoneNumber}{d.name ? ` — ${d.name}` : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
              value={syncStatus ?? ""}
              onChange={(e) => setParam("syncStatus", e.target.value || undefined)}
              aria-label="Filter by sync status"
            >
              {SYNC_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Date</label>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setParam("sort", sort === "desc" ? "asc" : "desc")}
              aria-label={`Sort ${sort === "desc" ? "ascending" : "descending"}`}
            >
              {sort === "desc" ? (
                <ArrowDown className="size-4" weight="bold" />
              ) : (
                <ArrowUp className="size-4" weight="bold" />
              )}
              <span className="ml-1.5">{sort === "desc" ? "Newest" : "Oldest"}</span>
            </Button>
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>

        {/* ── Template list ──────────────────────────────────────────── */}
        <TemplateList
          templates={templates}
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          onSelectTemplate={handleSelectTemplate}
          emptyMessage={
            hasFilters
              ? "No templates matching filters"
              : "No templates configured yet"
          }
          emptyActionLabel={hasFilters ? "Clear Filters" : undefined}
          onEmptyAction={hasFilters ? clearFilters : undefined}
        />
      </div>
    </ErrorBoundary>
  )
}

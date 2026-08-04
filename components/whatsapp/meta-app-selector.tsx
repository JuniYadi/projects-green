"use client"

import { useEffect, useState } from "react"

import { eden } from "@/lib/eden"
import { Label } from "@/components/ui/label"

type MetaApp = {
  id: string
  name: string
  metaAppId: string
  active: boolean
  callbackPath: string
}

type MetaAppSelectorProps = {
  value: string
  environment: "SANDBOX" | "LIVE"
  onChange: (value: string) => void
  allowUnassign?: boolean
  requiredForLive?: boolean
  error?: string
  disabled?: boolean
  loadOnMount?: boolean
}

export function MetaAppSelector({
  value,
  environment,
  onChange,
  allowUnassign = false,
  requiredForLive = true,
  error,
  disabled = false,
  loadOnMount = true,
}: MetaAppSelectorProps) {
  const [apps, setApps] = useState<MetaApp[]>([])
  const [isLoading, setIsLoading] = useState(loadOnMount)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!loadOnMount) return

    let cancelled = false
    void eden.api.admin.whatsapp["meta-apps"]
      .get()
      .then(({ data: body, error }) => {
        if (cancelled) return
        if (error || !body?.ok || !Array.isArray(body.data)) {
          throw new Error("Failed to load Meta Apps.")
        }
        setApps(
          body.data.flatMap((item) => {
            if (!item || typeof item !== "object") return []
            const candidate = item as Partial<MetaApp>
            if (
              typeof candidate.id !== "string" ||
              typeof candidate.name !== "string" ||
              typeof candidate.metaAppId !== "string" ||
              typeof candidate.callbackPath !== "string"
            ) {
              return []
            }
            return [
              {
                id: candidate.id,
                name: candidate.name,
                metaAppId: candidate.metaAppId,
                active: candidate.active === true,
                callbackPath: candidate.callbackPath,
              },
            ]
          })
        )
      })
      .catch(() => {
        if (!cancelled) setLoadError("Failed to load Meta Apps.")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [loadOnMount])

  const activeApps = apps.filter((app) => app.active)
  const selectedApp = apps.find((app) => app.id === value)
  const options =
    selectedApp && !selectedApp.active
      ? [selectedApp, ...activeApps.filter((app) => app.id !== selectedApp.id)]
      : activeApps
  const selectionError =
    error ||
    (requiredForLive && environment === "LIVE" && !value
      ? "MetaApp selection is required for LIVE devices."
      : undefined)

  return (
    <div className="grid gap-2 md:col-span-2">
      <Label htmlFor="whatsapp-meta-app">MetaApp</Label>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading Meta Apps…</p>
      ) : loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : (
        <>
          <select
            id="whatsapp-meta-app"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled || (activeApps.length === 0 && !allowUnassign)}
            required={requiredForLive && environment === "LIVE"}
            aria-invalid={Boolean(selectionError)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
          >
            <option value="">
              {environment === "LIVE" && !allowUnassign
                ? "No MetaApp selected"
                : "No MetaApp (unassigned)"}
            </option>
            {options.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name} ({app.metaAppId}){app.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
          {activeApps.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No active Meta Apps available.
            </p>
          )}
          {selectionError && (
            <p className="text-xs text-destructive">{selectionError}</p>
          )}
        </>
      )}
      {selectedApp && (
        <div className="rounded-md border bg-muted/30 p-3 text-xs">
          <p className="font-medium">{selectedApp.name}</p>
          <p className="text-muted-foreground">
            Meta App ID: {selectedApp.metaAppId}
          </p>
          <p className="text-muted-foreground">
            Callback path: {selectedApp.callbackPath}
          </p>
        </div>
      )}
    </div>
  )
}

export type { MetaApp, MetaAppSelectorProps }

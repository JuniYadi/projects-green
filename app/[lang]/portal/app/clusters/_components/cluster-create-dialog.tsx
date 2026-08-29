"use client"

import { useEffect, useState } from "react"

import { eden } from "@/lib/eden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ServiceRegionOption = {
  id: string
  code: string
  name: string
  country: string
  flag: string | null
  isActive: boolean
}

type ClusterCreateDialogProps = {
  onClose: () => void
  onCreated: () => void
}

export function ClusterCreateDialog({
  onClose,
  onCreated,
}: ClusterCreateDialogProps) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [regions, setRegions] = useState<ServiceRegionOption[]>([])
  const [regionsLoading, setRegionsLoading] = useState(true)
  const [selectedRegionId, setSelectedRegionId] = useState("")
  const [status, setStatus] = useState<"PLANNED" | "ACTIVE">("PLANNED")
  const [isDefault, setIsDefault] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadRegions = async () => {
      try {
        const { data: payload, error: resError } =
          await eden.api.admin.regions.get()
        if (resError || !payload || !payload.ok) {
          const errPayload = (resError?.value || payload) as
            | { message?: string }
            | undefined
          throw new Error(errPayload?.message || "Failed to load regions")
        }
        if (cancelled) return
        const rawList = Array.isArray(payload.data)
          ? (payload.data as ServiceRegionOption[])
          : []
        const activeRegions = rawList.filter((r) => r.isActive)
        setRegions(activeRegions)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load regions"
          )
        }
      } finally {
        if (!cancelled) setRegionsLoading(false)
      }
    }

    void loadRegions()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const selectedRegion = regions.find((r) => r.id === selectedRegionId)
    if (!selectedRegion) {
      setError("Please select a region.")
      setSubmitting(false)
      return
    }

    try {
      const { data: payload } = await eden.api.admin[
        "app-hosting"
      ].clusters.post({
        code,
        name,
        region: selectedRegion.name,
        regionId: selectedRegion.id,
        status,
        isDefault,
      })

      if (!payload || !payload.ok) {
        throw new Error(payload?.message ?? "Failed to create cluster.")
      }

      onCreated()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to create cluster."
      )
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Create Cluster</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new hosting cluster to the inventory.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cluster-code">Code</Label>
            <Input
              id="cluster-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="us-east-1"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cluster-name">Name</Label>
            <Input
              id="cluster-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="US East"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cluster-region">Region</Label>
            <Select
              value={selectedRegionId}
              onValueChange={setSelectedRegionId}
              disabled={regionsLoading || regions.length === 0}
            >
              <SelectTrigger id="cluster-region">
                <SelectValue
                  placeholder={
                    regionsLoading
                      ? "Loading regions..."
                      : regions.length === 0
                        ? "No active regions available"
                        : "Select a region"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.flag ? `${r.flag} ` : ""}
                    {r.name} ({r.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cluster-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "PLANNED" | "ACTIVE")}
            >
              <SelectTrigger id="cluster-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PLANNED">Planned</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cluster-default"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="cluster-default" className="text-sm">
              Set as default cluster
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Cluster"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

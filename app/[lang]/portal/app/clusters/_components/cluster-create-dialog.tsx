"use client"

import { useEffect, useState } from "react"

import { eden } from "@/lib/eden"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { useParams } from "next/navigation"
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
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale).console.app.clusterCreate

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
            { message?: string } | undefined
          throw new Error(errPayload?.message || messages.loadRegionsError)
        }
        if (cancelled) return
        const rawList = Array.isArray(payload.data)
          ? (payload.data as ServiceRegionOption[])
          : []
        setRegions(rawList.filter((region) => region.isActive))
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : messages.loadRegionsError
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
  }, [messages.loadRegionsError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const selectedRegion = regions.find((r) => r.id === selectedRegionId)
    if (!selectedRegion) {
      setError(messages.selectRegionError)
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
        throw new Error(payload?.message ?? messages.createFailed)
      }

      onCreated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : messages.createFailed)
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cluster-create-title"
      aria-describedby="cluster-create-description"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg">
        <h2 id="cluster-create-title" className="text-lg font-semibold">
          {messages.heading}
        </h2>
        <p
          id="cluster-create-description"
          className="mt-1 text-sm text-muted-foreground"
        >
          {messages.description}
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
            <Label htmlFor="cluster-code">{messages.code}</Label>
            <Input
              id="cluster-code"
              name="cluster.code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={messages.codePlaceholder}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cluster-name">{messages.name}</Label>
            <Input
              id="cluster-name"
              name="cluster.name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={messages.namePlaceholder}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cluster-region">{messages.region}</Label>
            <Select
              value={selectedRegionId}
              onValueChange={setSelectedRegionId}
              disabled={regionsLoading || regions.length === 0}
            >
              <SelectTrigger id="cluster-region" name="cluster.region">
                <SelectValue
                  placeholder={
                    regionsLoading
                      ? messages.regionLoading
                      : regions.length === 0
                        ? messages.regionEmpty
                        : messages.regionPlaceholder
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
            <Label htmlFor="cluster-status">{messages.status}</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "PLANNED" | "ACTIVE")}
            >
              <SelectTrigger id="cluster-status" name="cluster.status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PLANNED">{messages.planned}</SelectItem>
                <SelectItem value="ACTIVE">{messages.enabled}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cluster-default"
              name="cluster.isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="cluster-default" className="text-sm">
              {messages.defaultCluster}
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {messages.cancel}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? messages.creating : messages.create}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

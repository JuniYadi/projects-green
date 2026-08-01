"use client"

import { useState } from "react"

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
  const [region, setRegion] = useState("")
  const [status, setStatus] = useState<"PLANNED" | "ACTIVE">("PLANNED")
  const [isDefault, setIsDefault] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const { data: payload } = await eden.api.admin[
        "app-hosting"
      ].clusters.post({
        code,
        name,
        region,
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
            <Input
              id="cluster-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="us-east-1"
              required
            />
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

"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useCallback, useEffect, useState, type FormEvent } from "react"

interface PaymentGateway {
  id: string
  name: string
  provider: string
  status: "active" | "inactive"
  createdAt: string
}

type GatewaysRequestState =
  | { status: "loading" }
  | { status: "success"; data: PaymentGateway[] }
  | { status: "error"; message: string }

export function GatewaysTab() {
  const [state, setState] = useState<GatewaysRequestState>({ status: "loading" })
  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null)

  const fetchGateways = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/payments/gateways")

      if (!response.ok) {
        setState({ status: "error", message: "Failed to load gateways" })
        return
      }

      const payload = await response.json()

      if (payload.ok) {
        setState({ status: "success", data: payload.data || [] })
      } else {
        setState({ status: "error", message: payload.message || "Failed to load gateways" })
      }
    } catch {
      setState({ status: "error", message: "Failed to load gateways" })
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchGateways()
  }, [fetchGateways])

  async function handleCreateGateway(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/portal/payments/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") || ""),
          type: String(formData.get("type") || ""),
          config: {
            merchantCode: String(formData.get("merchantCode") || ""),
            apiKey: String(formData.get("apiKey") || ""),
            sandboxUrl: String(formData.get("sandboxUrl") || ""),
            productionUrl: String(formData.get("productionUrl") || ""),
          },
        }),
      })
      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        setState({
          status: "error",
          message: payload.message || "Failed to create gateway",
        })
        return
      }

      setIsCreating(false)
      await fetchGateways()
    } catch {
      setState({ status: "error", message: "Failed to create gateway" })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateGateway(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingGateway) return
    const formData = new FormData(event.currentTarget)
    setIsSubmitting(true)

    try {
      const response = await fetch(
        `/api/portal/payments/gateways/${editingGateway.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(formData.get("name") || ""),
            config: {
              merchantCode: String(formData.get("merchantCode") || ""),
              apiKey: String(formData.get("apiKey") || ""),
              sandboxUrl: String(formData.get("sandboxUrl") || ""),
              productionUrl: String(formData.get("productionUrl") || ""),
            },
          }),
        }
      )
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setState({
          status: "error",
          message: payload.message || "Failed to update gateway",
        })
        return
      }
      setEditingGateway(null)
      await fetchGateways()
    } catch {
      setState({ status: "error", message: "Failed to update gateway" })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (state.status === "error") {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {state.message}
        <div className="mt-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void fetchGateways()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const gateways = state.data

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Payment Gateways</CardTitle>
          {!editingGateway && (
            <Button type="button" size="sm" onClick={() => setIsCreating(true)}>
              Add Gateway
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCreating && (
          <form
            className="rounded-lg border bg-muted/20 p-4"
            onSubmit={handleCreateGateway}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>Gateway name</span>
                <Input name="name" placeholder="Midtrans production" required />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Provider type</span>
                <Input name="type" placeholder="midtrans" required />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Merchant code</span>
                <Input name="merchantCode" placeholder="M12345" />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>API key</span>
                <Input name="apiKey" type="password" placeholder="Optional" />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Sandbox URL</span>
                <Input name="sandboxUrl" placeholder="https://sandbox.example.com" />
              </label>
              <label className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Production URL</span>
                <Input name="productionUrl" placeholder="https://api.example.com" />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create gateway"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {editingGateway && (
          <form
            className="rounded-lg border bg-muted/20 p-4"
            onSubmit={handleUpdateGateway}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>Gateway name</span>
                <Input
                  name="name"
                  defaultValue={editingGateway.name}
                  required
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Merchant code</span>
                <Input name="merchantCode" placeholder="Optional" />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>API key</span>
                <Input name="apiKey" type="password" placeholder="Optional" />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Sandbox URL</span>
                <Input name="sandboxUrl" placeholder="https://sandbox.example.com" />
              </label>
              <label className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Production URL</span>
                <Input name="productionUrl" placeholder="https://api.example.com" />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save gateway"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditingGateway(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {!editingGateway && (
          <>
            {gateways.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No payment gateways configured yet.
              </div>
            ) : (
              <div className="space-y-3">
                {gateways.map((gateway) => (
                  <div
                    key={gateway.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{gateway.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{gateway.provider}</span>
                        <Badge
                          variant={gateway.status === "active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {gateway.status}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingGateway(gateway)}
                    >
                      Configure
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCallback, useEffect, useState } from "react"

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

  const fetchGateways = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/payments/gateways")

      if (!response.ok) {
        setState({ status: "error", message: "Failed to load gateways" })
        return
      }

      const payload = await response.json()

      if (payload.ok) {
        setState({ status: "success", data: payload.gateways || [] })
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
          <Button type="button" size="sm">
            Add Gateway
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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
                <Button type="button" size="sm" variant="outline">
                  Configure
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

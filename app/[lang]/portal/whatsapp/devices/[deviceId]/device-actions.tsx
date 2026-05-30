"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowsClockwise, CheckCircle } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

type DeviceActionsProps = {
  deviceId: string
}

type ActionState = "idle" | "verifying" | "reconnecting"

export function DeviceActions({ deviceId }: DeviceActionsProps) {
  const router = useRouter()
  const [actionState, setActionState] = useState<ActionState>("idle")

  async function handleVerify() {
    setActionState("verifying")

    try {
      const response = await fetch(`/api/whatsapp/devices/${deviceId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()

      if (!response.ok || data.ok === false) {
        throw new Error(data.message || "Failed to verify device")
      }

      toast.success("Device verified successfully")
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to verify device"
      toast.error(message)
    } finally {
      setActionState("idle")
    }
  }

  async function handleReconnect() {
    setActionState("reconnecting")

    try {
      const response = await fetch(
        `/api/whatsapp/devices/${deviceId}/reconnect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      )

      const data = await response.json()

      if (!response.ok || data.ok === false) {
        throw new Error(data.message || "Failed to reconnect device")
      }

      toast.success("Device reconnected successfully")
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reconnect device"
      toast.error(message)
    } finally {
      setActionState("idle")
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleVerify}
        disabled={actionState !== "idle"}
      >
        <CheckCircle
          weight="bold"
          className="mr-1.5 size-4"
        />
        {actionState === "verifying" ? "Verifying..." : "Verify"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleReconnect}
        disabled={actionState !== "idle"}
      >
        <ArrowsClockwise
          weight="bold"
          className="mr-1.5 size-4"
        />
        {actionState === "reconnecting" ? "Reconnecting..." : "Reconnect"}
      </Button>
    </div>
  )
}

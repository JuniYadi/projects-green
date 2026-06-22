"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CloudArrowDown } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { whatsappClient } from "@/lib/api/whatsapp-client"

export function SyncButton({ deviceId }: { deviceId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleSync() {
    setLoading(true)
    try {
      const res = await whatsappClient.devices.syncTemplates(deviceId)
      if (!res.ok) throw new Error((res as { message?: string })?.message || "Failed to sync")
      toast.success(res.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync templates")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleSync} disabled={loading}>
      <CloudArrowDown weight="bold" className="mr-1 size-3.5" />
      {loading ? "Syncing..." : "Sync"}
    </Button>
  )
}

"use client"

import { useState } from "react"
import { eden } from "@/lib/eden"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowsClockwise,
  CheckCircle,
  PencilSimple,
  Pause,
  Trash,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type DeviceActionsProps = {
  deviceId: string
  deviceStatus: string
}

type ActionState = "idle" | "verifying" | "reconnecting"

export function DeviceActions({
  deviceId,
  deviceStatus,
}: DeviceActionsProps) {
  const router = useRouter()
  const [actionState, setActionState] = useState<ActionState>("idle")
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Edit form state
  const [editPhoneNumber, setEditPhoneNumber] = useState("")
  const [editCallbackUrl, setEditCallbackUrl] = useState("")

  async function handleVerify() {
    setActionState("verifying")

    try {
      const { data } = await eden.api.whatsapp.devices[deviceId].verify.post()

      if (!data || data.ok === false) {
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
      const { data } = await eden.api.whatsapp.devices[deviceId].reconnect.post()

      if (!data || data.ok === false) {
        throw new Error(data.message || "Failed to reconnect device")
      }

      toast.success("Device reconnected successfully")
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to reconnect device"
      toast.error(message)
    } finally {
      setActionState("idle")
    }
  }

  async function handleEdit() {
    setIsEditing(true)
    try {
      const payload: Record<string, unknown> = {}
      if (editPhoneNumber.trim()) payload.phoneNumber = editPhoneNumber.trim()
      if (editCallbackUrl.trim()) payload.callbackUrl = editCallbackUrl.trim()

      if (Object.keys(payload).length === 0) {
        toast.error("No changes to save.")
        setIsEditing(false)
        return
      }

      const { data } = await eden.api.admin.devices[deviceId].patch(payload)

      if (!data || data.ok === false) {
        if (data.error === "VALIDATION_ERROR") {
          const fieldMessages = data.fieldErrors
            ? Object.entries(data.fieldErrors)
                .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
                .join("\n")
            : ""
          toast.error(data.message || "Validation failed", {
            description: fieldMessages || undefined,
          })
          return
        }
        throw new Error(data.message || "Failed to update device")
      }

      toast.success("Device updated successfully")
      setEditOpen(false)
      setEditPhoneNumber("")
      setEditCallbackUrl("")
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update device"
      toast.error(message)
    } finally {
      setIsEditing(false)
    }
  }

  async function handleDeactivate() {
    setIsDeactivating(true)
    try {
      const { data } = await eden.api.admin.devices[deviceId].patch({ status: "NON_ACTIVE" })

      if (!data || data.ok === false) {
        throw new Error(data.message || "Failed to deactivate device")
      }

      toast.success("Device deactivated successfully")
      setDeactivateOpen(false)
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to deactivate device"
      toast.error(message)
    } finally {
      setIsDeactivating(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const { data } = await eden.api.admin.devices[deviceId].delete()

      if (!data || data.ok === false) {
        throw new Error(data.message || "Failed to delete device")
      }

      toast.success("Device deleted successfully")
      setDeleteOpen(false)
      router.push("/portal/whatsapp/devices")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete device"
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const isActive = deviceStatus === "ACTIVE"

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleVerify}
          disabled={actionState !== "idle"}
        >
          <CheckCircle weight="bold" className="mr-1.5 size-4" />
          {actionState === "verifying" ? "Verifying..." : "Verify"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReconnect}
          disabled={actionState !== "idle"}
        >
          <ArrowsClockwise weight="bold" className="mr-1.5 size-4" />
          {actionState === "reconnecting" ? "Reconnecting..." : "Reconnect"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditOpen(true)}
        >
          <PencilSimple weight="bold" className="mr-1.5 size-4" />
          Edit
        </Button>
        {isActive && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDeactivateOpen(true)}
          >
            <Pause weight="bold" className="mr-1.5 size-4" />
            Deactivate
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash weight="bold" className="mr-1.5 size-4" />
          Delete
        </Button>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>
              Update device configuration. Leave fields empty to keep current
              values.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                value={editPhoneNumber}
                onChange={(e) => setEditPhoneNumber(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-callback">Callback URL</Label>
              <Input
                id="edit-callback"
                value={editCallbackUrl}
                onChange={(e) => setEditCallbackUrl(e.target.value)}
                placeholder="https://example.com/whatsapp/callback"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false)
                setEditPhoneNumber("")
                setEditCallbackUrl("")
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleEdit()} disabled={isEditing}>
              {isEditing ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Device</DialogTitle>
            <DialogDescription>
              This device will be set to non-active and will no longer be able
              to send messages. Its data and history will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeactivate()}
              disabled={isDeactivating}
            >
              {isDeactivating ? "Deactivating..." : "Deactivate Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Device</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. The device will be
              removed from the system, and WhatsApp service for this number will
              be terminated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

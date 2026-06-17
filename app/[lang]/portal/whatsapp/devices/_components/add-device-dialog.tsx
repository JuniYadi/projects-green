"use client"

import { useState, useCallback } from "react"
import { eden } from "@/lib/eden"
import { useRouter } from "next/navigation"
import { Plus } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Organization = {
  id: string
  name: string
}

type AddDeviceForm = {
  organizationId: string
  phoneNumber: string
  name: string
  displayName: string
  whatsappBusinessAccountId: string
  whatsappPhoneId: string
  whatsappApplicationId: string
  callbackUrl: string
}

const emptyForm: AddDeviceForm = {
  organizationId: "",
  phoneNumber: "",
  name: "",
  displayName: "",
  whatsappBusinessAccountId: "",
  whatsappPhoneId: "",
  whatsappApplicationId: "",
  callbackUrl: "",
}

export function AddDeviceDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<AddDeviceForm>(emptyForm)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [orgsLoaded, setOrgsLoaded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadOrganizations = useCallback(async () => {
    if (orgsLoaded) return
    setLoadingOrgs(true)
    try {
      const { data: body } = await eden.api.admin.organizations.get({ $query: { limit: 100 } })
      if (body?.ok) {
        setOrganizations((body as { data: { organizations: Organization[] } }).data.organizations)
        setOrgsLoaded(true)
      }
    } catch {
      toast.error("Failed to load organizations.")
    } finally {
      setLoadingOrgs(false)
    }
  }, [orgsLoaded])

  const handleOpenChange = async (nextOpen: boolean) => {
    if (nextOpen) {
      await loadOrganizations()
    }
    setOpen(nextOpen)
  }

  const e164PhoneRegex = /^\+[1-9]\d{1,14}$/

  const handleSubmit = async () => {
    if (!form.organizationId.trim() || !form.phoneNumber.trim()) {
      toast.error("Organization and phone number are required.")
      return
    }

    if (!e164PhoneRegex.test(form.phoneNumber.trim())) {
      toast.error(
        "Phone number must be in E.164 format (e.g. +6281234567890)",
      )
      return
    }

    setIsSubmitting(true)
    try {
      const { data: body } = await eden.api.admin.devices.post({
        organizationId: form.organizationId,
        phoneNumber: form.phoneNumber,
        name: form.name || "Admin Device",
        displayName: form.displayName || undefined,
        whatsappBusinessAccountId:
          form.whatsappBusinessAccountId || undefined,
        whatsappPhoneId: form.whatsappPhoneId || undefined,
        whatsappApplicationId: form.whatsappApplicationId || undefined,
        callbackUrl: form.callbackUrl || undefined,
      } as never)

      if (!body?.ok) {
        throw new Error((body as { message?: string })?.message || "Failed to add device.")
      }

      toast.success("Device added successfully.")
      setOpen(false)
      setForm(emptyForm)
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add device."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" />
          Add Device
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add WhatsApp Device</DialogTitle>
          <DialogDescription>
            Register a new WhatsApp Business device for an organization.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="add-org">Organization</Label>
            <Select
              value={form.organizationId}
              onValueChange={(value) =>
                setForm({ ...form, organizationId: value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    loadingOrgs ? "Loading..." : "Select organization"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-phone">Phone Number</Label>
            <Input
              id="add-phone"
              value={form.phoneNumber}
              onChange={(e) =>
                setForm({ ...form, phoneNumber: e.target.value })
              }
              placeholder="+1234567890"
              inputMode="tel"
              autoComplete="tel"
              required
              aria-required="true"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-display-name">
              WhatsApp Display Name
            </Label>
            <Input
              id="add-display-name"
              value={form.displayName}
              onChange={(e) =>
                setForm({ ...form, displayName: e.target.value })
              }
              placeholder="My Business Account"
            />
            <p className="text-xs text-muted-foreground">
              Shown in WhatsApp conversations. Optional.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-waba-id">
              WhatsApp Business Account ID
            </Label>
            <Input
              id="add-waba-id"
              value={form.whatsappBusinessAccountId}
              onChange={(e) =>
                setForm({
                  ...form,
                  whatsappBusinessAccountId: e.target.value,
                })
              }
              placeholder="WABA-xxxxxxxxxxxx"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-phone-id">WhatsApp Phone ID</Label>
            <Input
              id="add-phone-id"
              value={form.whatsappPhoneId}
              onChange={(e) =>
                setForm({ ...form, whatsappPhoneId: e.target.value })
              }
              placeholder="Phone-xxxxxxxxxxxx"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-app-id">
              WhatsApp Application ID
            </Label>
            <Input
              id="add-app-id"
              value={form.whatsappApplicationId}
              onChange={(e) =>
                setForm({
                  ...form,
                  whatsappApplicationId: e.target.value,
                })
              }
              placeholder="App-xxxxxxxxxxxx"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-callback">Callback URL</Label>
            <Input
              id="add-callback"
              value={form.callbackUrl}
              onChange={(e) =>
                setForm({ ...form, callbackUrl: e.target.value })
              }
              placeholder="https://example.com/whatsapp/callback"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false)
              setForm(emptyForm)
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Adding..." : "Add Device"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

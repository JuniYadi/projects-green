"use client"

import * as React from "react"
import { useParams } from "next/navigation"

import { PencilSimple, Phone } from "@phosphor-icons/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
import { Textarea } from "@/components/ui/textarea"
import { TabsDeviceDetail } from "@/modules/whatsapp/webhooks/ui/tabs-device-detail"
import { type DeviceDetail } from "@/modules/whatsapp/devices/devices.schemas"
import { whatsappClient } from "@/lib/api/whatsapp-client"
import { resolveLocaleOrDefault, localizePathname } from "@/lib/i18n/pathname"
import { toast } from "sonner"
import {
  VERTICALS,
  type Vertical,
  type UpdateBusinessProfileInput,
} from "@/lib/whatsapp/meta-cloud/types/business-profile"
type PageState = "loading" | "error" | "loaded"
type ProfileFormState = {
  about: string
  description: string
  address: string
  email: string
  profile_picture_url: string
  website1: string
  website2: string
  vertical: "" | Vertical
}

const EMPTY_PROFILE_FORM: ProfileFormState = {
  about: "",
  description: "",
  address: "",
  email: "",
  profile_picture_url: "",
  website1: "",
  website2: "",
  vertical: "",
}

const toProfileForm = (
  profile: Record<string, unknown> | null
): ProfileFormState => {
  const websites = Array.isArray(profile?.websites) ? profile.websites : []

  return {
    ...EMPTY_PROFILE_FORM,
    about: (profile?.about as string) || "",
    description: (profile?.description as string) || "",
    address: (profile?.address as string) || "",
    email: (profile?.email as string) || "",
    profile_picture_url: (profile?.profile_picture_url as string) || "",
    website1: (websites[0] as string) || "",
    website2: (websites[1] as string) || "",
    vertical: ((profile?.vertical as string) || "") as "" | Vertical,
  }
}


const formatDate = (date: string | null) => {
  if (!date) return "N/A"
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date))
}

type InfoRowProps = {
  label: string
  value: string | number | React.ReactNode
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

export default function ConsoleWhatsAppDeviceDetailPage() {
  const params = useParams<{ deviceId: string; lang?: string }>()
  const deviceId = params?.deviceId

  const locale = resolveLocaleOrDefault(params?.lang)
  const devicesPath = localizePathname({
    pathname: "/console/whatsapp/devices",
    locale,
  })

  const [device, setDevice] = React.useState<DeviceDetail | null>(null)
  const [pageState, setPageState] = React.useState<PageState>("loading")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [profileDialogOpen, setProfileDialogOpen] = React.useState(false)
  const [profileSubmitting, setProfileSubmitting] = React.useState(false)
  const [profileForm, setProfileForm] = React.useState<ProfileFormState>(
    EMPTY_PROFILE_FORM
  )

  const loadDevice = React.useCallback(async () => {
    if (!deviceId) {
      setErrorMessage("Device ID is missing")
      setPageState("error")
      return
    }

    setPageState("loading")
    setErrorMessage("")

    try {
      const response = await whatsappClient.devices.get(deviceId)
      if (!response.ok) {
        throw new Error("Device not found")
      }
      setDevice(response.device)
      setProfileForm(
        toProfileForm(response.device.whatsappProfile as Record<string, unknown> | null)
      )
      setPageState("loaded")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load device"
      setErrorMessage(message)
      setPageState("error")
    }
  }, [deviceId])

  React.useEffect(() => {
    ;(async () => {
      await loadDevice()
    })()
  }, [loadDevice])

  // Loading state
  if (pageState === "loading") {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="mb-3 h-4 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  // Error state
  if (pageState === "error" || !device) {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Phone className="mb-3 size-10 text-muted-foreground" weight="fill" />
          <p className="text-sm text-destructive">
            {errorMessage || "Device not found"}
          </p>
        </div>
      </main>
    )
  }

  // Overview tab content (basic device info, read-only)
  const profile = device.whatsappProfile as Record<string, unknown> | null

  const overviewContent = (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Device Information</CardTitle>
          <CardDescription>Basic device details</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <InfoRow label="Phone Number" value={device.phoneNumber} />
            <InfoRow label="Name" value={device.name || "-"} />
            <InfoRow
              label="Status"
              value={
                <Badge
                  variant={device.status === "ACTIVE" ? "success" : "secondary"}
                >
                  {device.status}
                </Badge>
              }
            />
            <InfoRow
              label="Usage"
              value={`${device.quotaBaseOut} / ${device.quotaBase} messages`}
            />
            <InfoRow
              label="Daily Limit"
              value={
                device.dailyLimitMessage > 0
                  ? `${device.dailyLimitMessage} msg/day`
                  : "No limit"
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timestamps</CardTitle>
          <CardDescription>Device lifecycle dates</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <InfoRow label="Created" value={formatDate(device.createdAt)} />
            <InfoRow
              label="Last Updated"
              value={formatDate(device.updatedAt)}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp Profile</CardTitle>
          <CardDescription>Meta business profile information</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <InfoRow
              label="About"
              value={(profile?.about as string) || "Not set"}
            />
            <InfoRow
              label="Description"
              value={(profile?.description as string) || "Not set"}
            />
            <InfoRow
              label="Email"
              value={(profile?.email as string) || "Not set"}
            />
            <InfoRow
              label="Website"
              value={
                (profile?.websites as string[])?.length
                  ? (profile?.websites as string[]).join(", ")
                  : "Not set"
              }
            />
            <InfoRow
              label="Vertical"
              value={(profile?.vertical as string) || "Not set"}
            />
            <InfoRow
              label="Address"
              value={(profile?.address as string) || "Not set"}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  )

  const handleSaveProfile = async () => {
    setProfileSubmitting(true)
    try {
      const payload: Record<string, unknown> = { messaging_product: "whatsapp" }
      const trimmedAbout = profileForm.about.trim()
      const trimmedDescription = profileForm.description.trim()
      const trimmedAddress = profileForm.address.trim()
      const trimmedEmail = profileForm.email.trim()
      const trimmedUrl = profileForm.profile_picture_url.trim()
      const trimmedWebsite1 = profileForm.website1.trim()
      const trimmedWebsite2 = profileForm.website2.trim()

      if (trimmedAbout) payload.about = trimmedAbout
      if (trimmedDescription) payload.description = trimmedDescription
      if (trimmedAddress) payload.address = trimmedAddress
      if (trimmedEmail) payload.email = trimmedEmail
      if (trimmedUrl) payload.profile_picture_url = trimmedUrl
      if (trimmedWebsite1 || trimmedWebsite2) {
        payload.websites = [trimmedWebsite1, trimmedWebsite2].filter(Boolean)
      }
      if (profileForm.vertical) payload.vertical = profileForm.vertical

      const response = await whatsappClient.devices.profile.update(
        deviceId,
        payload
      )
      if (!response.ok) {
        throw new Error(
          (response as unknown as { message?: string }).message ||
            "Failed to update profile"
        )
      }
      setDevice((prev) =>
        prev ? { ...prev, whatsappProfile: response.profile } : prev
      )
      setProfileForm(
        toProfileForm(response.profile as Record<string, unknown> | null)
      )
      setProfileDialogOpen(false)
      toast("WhatsApp profile updated")
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to update profile"
      )
    } finally {
      setProfileSubmitting(false)
    }
  }

  const profileDialog = (
    <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PencilSimple className="mr-2 size-4" />
          Edit WhatsApp Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit WhatsApp Profile</DialogTitle>
          <DialogDescription>
            Update your Meta business profile information.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-about">About</Label>
            <Textarea
              id="profile-about"
              maxLength={139}
              value={profileForm.about}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, about: e.target.value }))
              }
              placeholder="Short description about your business"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-description">Description</Label>
            <Textarea
              id="profile-description"
              value={profileForm.description}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Detailed description of your business"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-address">Address</Label>
            <Input
              id="profile-address"
              value={profileForm.address}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, address: e.target.value }))
              }
              placeholder="Business address"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={profileForm.email}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, email: e.target.value }))
              }
              placeholder="contact@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-url">Profile Picture URL</Label>
            <Input
              id="profile-url"
              type="url"
              value={profileForm.profile_picture_url}
              onChange={(e) =>
                setProfileForm((f) => ({
                  ...f,
                  profile_picture_url: e.target.value,
                }))
              }
              placeholder="https://example.com/image.jpg"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-website1">Website 1</Label>
            <Input
              id="profile-website1"
              type="url"
              value={profileForm.website1}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, website1: e.target.value }))
              }
              placeholder="https://example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-website2">Website 2</Label>
            <Input
              id="profile-website2"
              type="url"
              value={profileForm.website2}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, website2: e.target.value }))
              }
              placeholder="https://example2.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-vertical">Vertical</Label>
            <Select
              value={profileForm.vertical}
              onValueChange={(v) =>
                setProfileForm((f) => ({
                  ...f,
                  vertical: v as Vertical,
                }))
              }
            >
              <SelectTrigger id="profile-vertical">
                <SelectValue placeholder="Select vertical" />
              </SelectTrigger>
              <SelectContent>
                {VERTICALS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setProfileDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSaveProfile} disabled={profileSubmitting}>
            {profileSubmitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <TabsDeviceDetail
      device={{
        id: device.id,
        phoneNumber: device.phoneNumber,
        name: device.name,
        status: device.status,
        organizationId: device.organizationId,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
      }}
      backHref={devicesPath}
      overviewChildren={overviewContent}
      actions={profileDialog}
    />
  )
}

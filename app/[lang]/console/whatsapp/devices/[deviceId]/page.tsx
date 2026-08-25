"use client"
import {
  getWhatsAppText,
  WhatsAppText,
} from "@/modules/whatsapp/ui/whatsapp-text"

import * as React from "react"
import { useParams } from "next/navigation"

import {
  CheckCircle,
  Image,
  PencilSimple,
  Phone,
  ChatCircle,
  PaperPlaneTilt,
  ChartDonut,
  ArrowsClockwise,
} from "@phosphor-icons/react"
import { detectCountryFromPhone } from "@/modules/whatsapp/messages/phone-number"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault, localizePathname } from "@/lib/i18n/pathname"
import { toast } from "sonner"
import {
  VERTICALS,
  type Vertical,
} from "@/lib/whatsapp/meta-cloud/types/business-profile"
type PageState = "loading" | "error" | "loaded"
const PROFILE_PICTURE_TYPES = ["image/jpeg", "image/png"]
const PROFILE_PICTURE_SIZE_LIMIT = 5 * 1024 * 1024

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

type MetaNameStatusBadgeProps = {
  nameStatus: string | null | undefined
  profile: Record<string, unknown> | null
}

export function MetaNameStatusBadge({
  nameStatus,
  profile,
}: MetaNameStatusBadgeProps) {
  const syncState = getProfileString(
    profile,
    "meta_name_status_sync_state"
  ).toUpperCase()
  const normalizedStatus = nameStatus?.toUpperCase()

  if (syncState === "UNAVAILABLE") {
    return <Badge variant="secondary">Meta unavailable</Badge>
  }

  if (syncState === "UNKNOWN") {
    return (
      <Badge variant="secondary">
        <WhatsAppText id="s69" />
      </Badge>
    )
  }

  if (normalizedStatus === "APPROVED") {
    return <Badge variant="success">Approved</Badge>
  }

  if (normalizedStatus === "PENDING" || normalizedStatus === "PENDING_REVIEW") {
    return <Badge variant="warning">Pending</Badge>
  }

  if (normalizedStatus === "DECLINED" || normalizedStatus === "REJECTED") {
    return <Badge variant="destructive">Rejected</Badge>
  }

  return (
    <Badge variant="secondary">
      <WhatsAppText id="s70" />
    </Badge>
  )
}

const getProfileString = (
  profile: Record<string, unknown> | null,
  key: string
) => {
  const value = profile?.[key]
  return typeof value === "string" ? value.trim() : ""
}

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase() || "WA"

type WhatsAppProfilePreviewProps = {
  device: DeviceDetail
  profile: Record<string, unknown> | null
  messages: ReturnType<typeof getMessages>["console"]["whatsapp"]["devices"]
}

function WhatsAppProfilePreview({
  device,
  profile,
  messages,
}: WhatsAppProfilePreviewProps) {
  const displayName =
    device.verifiedName ||
    getProfileString(profile, "name") ||
    (device.name !== device.phoneNumber ? device.name : null) ||
    device.phoneNumber
  const about =
    getProfileString(profile, "about") ||
    getProfileString(profile, "description")
  const email = getProfileString(profile, "email")
  const websites = Array.isArray(profile?.websites)
    ? (profile?.websites as string[]).filter(Boolean)
    : []
  const address = getProfileString(profile, "address")
  const category =
    getProfileString(profile, "category") ||
    getProfileString(profile, "vertical")
  const profilePictureUrl = getProfileString(profile, "profile_picture_url")
  const isVerified =
    device.nameStatus?.toUpperCase() === "APPROVED" ||
    profile?.isOfficialBusinessAccount === true

  return (
    <Card
      data-testid="whatsapp-profile-preview"
      className="overflow-hidden border shadow-sm [--card-spacing:0px]"
    >
      <CardHeader className="bg-emerald-800 px-5 py-4 text-white dark:bg-emerald-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold tracking-wide text-white">
              <WhatsAppText id="s71" />
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className="border-white/20 bg-white/10 text-[11px] font-normal text-white"
          >
            <WhatsAppText id="s72" />
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 border-2 border-emerald-500/20 shadow-sm">
            {profilePictureUrl ? (
              <AvatarImage
                src={profilePictureUrl}
                alt={`${displayName} profile`}
              />
            ) : null}
            <AvatarFallback className="bg-emerald-100 text-lg font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-base font-bold text-foreground">
                {displayName}
              </p>
              {isVerified && (
                <CheckCircle
                  weight="fill"
                  className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-label="Verified"
                />
              )}
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {device.phoneNumber}
            </p>
            <div className="pt-0.5">
              <Badge
                variant={device.status === "ACTIVE" ? "success" : "secondary"}
                className="px-1.5 py-0 text-[10px] font-normal"
              >
                {device.status === "ACTIVE"
                  ? messages.active
                  : messages.inactive}
              </Badge>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/30 p-3.5 text-xs">
          <p className="mb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            <WhatsAppText id="s73" />
          </p>
          {about ? (
            <p className="leading-relaxed whitespace-pre-wrap text-foreground/90">
              {about}
            </p>
          ) : (
            <p className="text-muted-foreground italic">
              <WhatsAppText id="s74" />
            </p>
          )}
        </div>

        <div className="space-y-2.5 text-xs">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <WhatsAppText id="s75" />
          </p>
          <div className="space-y-2.5 rounded-xl border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Category</span>
              {category ? (
                <span className="font-medium">{category}</span>
              ) : (
                <span className="text-muted-foreground italic">
                  <WhatsAppText id="s76" />
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                <WhatsAppText id="s12" />
              </span>
              {email ? (
                <span className="font-medium">{email}</span>
              ) : (
                <span className="text-muted-foreground italic">
                  <WhatsAppText id="s76" />
                </span>
              )}
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-muted-foreground">Website</span>
              {websites.length > 0 ? (
                <span className="max-w-[200px] truncate text-right font-medium">
                  {websites.join(", ")}
                </span>
              ) : (
                <span className="text-muted-foreground italic">
                  <WhatsAppText id="s76" />
                </span>
              )}
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-muted-foreground">Address</span>
              {address ? (
                <span className="text-right font-medium">{address}</span>
              ) : (
                <span className="text-muted-foreground italic">
                  <WhatsAppText id="s76" />
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
export default function ConsoleWhatsAppDeviceDetailPage() {
  const params = useParams<{ deviceId: string; lang?: string }>()
  const deviceId = params?.deviceId
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const deviceMessages = messages.console.whatsapp.devices
  const devicesPath = localizePathname({
    pathname: "/console/whatsapp/devices",
    locale,
  })

  const [device, setDevice] = React.useState<DeviceDetail | null>(null)
  const [usageStats, setUsageStats] = React.useState<{
    inbound: number
    outbound: number
    total: number
  }>({ inbound: 0, outbound: 0, total: 0 })
  const [isSyncing, setIsSyncing] = React.useState(false)
  const [pageState, setPageState] = React.useState<PageState>("loading")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [profileDialogOpen, setProfileDialogOpen] = React.useState(false)
  const [profileSubmitting, setProfileSubmitting] = React.useState(false)
  const [profilePictureFile, setProfilePictureFile] =
    React.useState<File | null>(null)
  const [profilePicturePreviewUrl, setProfilePicturePreviewUrl] =
    React.useState("")
  const [profileForm, setProfileForm] =
    React.useState<ProfileFormState>(EMPTY_PROFILE_FORM)

  React.useEffect(() => {
    return () => {
      if (profilePicturePreviewUrl) {
        URL.revokeObjectURL(profilePicturePreviewUrl)
      }
    }
  }, [profilePicturePreviewUrl])

  const clearProfilePictureSelection = () => {
    setProfilePictureFile(null)
    setProfilePicturePreviewUrl("")
  }

  const handleProfilePictureChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] ?? null
    if (!file) {
      clearProfilePictureSelection()
      return
    }
    if (!PROFILE_PICTURE_TYPES.includes(file.type)) {
      toast(deviceMessages.invalidFileType)
      event.target.value = ""
      return
    }
    if (file.size > PROFILE_PICTURE_SIZE_LIMIT) {
      toast(deviceMessages.fileTooLarge)
      event.target.value = ""
      return
    }
    setProfilePictureFile(file)
    setProfilePicturePreviewUrl(URL.createObjectURL(file))
  }

  const loadDevice = React.useCallback(async () => {
    if (!deviceId) {
      setErrorMessage(deviceMessages.unableToLoad)
      setPageState("error")
      return
    }

    setPageState("loading")
    setErrorMessage("")

    try {
      const [deviceRes, usageRes] = await Promise.allSettled([
        whatsappClient.devices.get(deviceId),
        whatsappClient.usage.overview(),
      ])

      if (deviceRes.status === "rejected" || !deviceRes.value.ok) {
        throw new Error(deviceMessages.unableToLoad)
      }

      const foundDevice = deviceRes.value.device
      setDevice(foundDevice)
      setProfileForm(
        toProfileForm(
          foundDevice.whatsappProfile as Record<string, unknown> | null
        )
      )

      if (usageRes.status === "fulfilled" && usageRes.value.ok) {
        const devUsage = usageRes.value.devices?.find(
          (d) =>
            d.deviceId === deviceId || d.phoneNumber === foundDevice.phoneNumber
        )
        if (devUsage) {
          const inCount = devUsage.messageInboxCount || 0
          const outCount = devUsage.messageOutboxCount || 0
          setUsageStats({
            inbound: inCount,
            outbound: outCount,
            total: inCount + outCount,
          })
        }
      }

      clearProfilePictureSelection()
      setPageState("loaded")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : deviceMessages.unableToLoad
      setErrorMessage(message)
      setPageState("error")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId])

  const handleSyncMeta = async () => {
    if (!deviceId) return
    setIsSyncing(true)
    try {
      const res = await whatsappClient.devices.profile.syncMeta(deviceId)
      if (res.ok) {
        toast.success("Successfully synchronized profile with Meta!")
        await loadDevice()
      } else {
        toast.error("Failed to synchronize with Meta")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setIsSyncing(false)
    }
  }

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
            {errorMessage || deviceMessages.unableToLoad}
          </p>
        </div>
      </main>
    )
  }

  // Overview tab content (basic device info, read-only)
  const profile = device.whatsappProfile as Record<string, unknown> | null
  const currentProfilePictureUrl =
    typeof profile?.profile_picture_url === "string"
      ? profile.profile_picture_url
      : undefined
  const profilePictureUrl = profilePicturePreviewUrl || currentProfilePictureUrl

  // Quota calculation (quotaBaseOut is remaining base quota)
  const totalQuota = device.quotaBase > 0 ? device.quotaBase : 1000
  const remainingQuota = Math.max(0, Math.min(device.quotaBaseOut, totalQuota))
  const usedQuota = Math.max(0, totalQuota - remainingQuota)
  const quotaPercent = Math.min(Math.round((usedQuota / totalQuota) * 100), 100)
  const quotaBarColor =
    quotaPercent >= 90
      ? "bg-destructive"
      : quotaPercent >= 75
        ? "bg-amber-500"
        : "bg-emerald-500"

  const countryInfo = detectCountryFromPhone(device.phoneNumber)

  const overviewContent = (
    <div className="space-y-6">
      {/* ── 1. KPI Usage Summary Cards (Full Width) ────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              <WhatsAppText id="s44" />
            </CardTitle>
            <ChatCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageStats.total.toLocaleString()}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <WhatsAppText id="s48" />
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Inbound Received
            </CardTitle>
            <ChatCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageStats.inbound.toLocaleString()}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <WhatsAppText id="s77" />
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              <WhatsAppText id="s78" />
            </CardTitle>
            <PaperPlaneTilt className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageStats.outbound.toLocaleString()}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <WhatsAppText id="s79" />
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Quota Consumption
            </CardTitle>
            <ChartDonut className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-sm font-bold">
                {usedQuota.toLocaleString()} / {totalQuota.toLocaleString()}
              </span>
              <span className="font-medium text-muted-foreground">
                {quotaPercent}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-300 ${quotaBarColor}`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {remainingQuota.toLocaleString()} msgs remaining
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 2. Two-Column Split Layout (55% Details, 45% WhatsApp Preview) ─── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Device Information & Technical Specs */}
        <div className="space-y-6 lg:col-span-7">
          <Card className="shadow-xs">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base font-semibold">
                <WhatsAppText id="s80" />
              </CardTitle>
              <CardDescription>
                <WhatsAppText id="s81" />
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <dl className="space-y-3.5">
                <InfoRow
                  label="Phone Number"
                  value={
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{device.phoneNumber}</span>
                      {countryInfo && (
                        <Badge
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {countryInfo.country}
                        </Badge>
                      )}
                    </div>
                  }
                />
                <InfoRow
                  label="Display Name"
                  value={device.verifiedName || device.name || "—"}
                />
                <InfoRow
                  label="Meta Name Status"
                  value={
                    <MetaNameStatusBadge
                      nameStatus={device.nameStatus}
                      profile={profile}
                    />
                  }
                />
                <InfoRow
                  label="Device Status"
                  value={
                    <Badge
                      variant={
                        device.status === "ACTIVE" ? "success" : "secondary"
                      }
                    >
                      {device.status}
                    </Badge>
                  }
                />
                <InfoRow
                  label="Daily Limit"
                  value={
                    device.dailyLimitMessage > 0
                      ? `${device.dailyLimitMessage.toLocaleString()} msgs / day`
                      : "No Limit"
                  }
                />
                {Number(device.balance) > 0 && (
                  <InfoRow
                    label="Device Balance"
                    value={`Rp${Number(device.balance).toLocaleString("id-ID")}`}
                  />
                )}
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base font-semibold">
                Lifecycle Timestamps
              </CardTitle>
              <CardDescription>
                <WhatsAppText id="s82" />
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <dl className="space-y-3.5">
                <InfoRow
                  label="Created At"
                  value={formatDate(device.createdAt)}
                />
                <InfoRow
                  label="Last Synchronized"
                  value={formatDate(device.updatedAt)}
                />
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: WhatsApp Business Profile Preview */}
        <div className="lg:col-span-5">
          <WhatsAppProfilePreview
            device={device}
            profile={profile}
            messages={deviceMessages}
          />
        </div>
      </div>
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
      const trimmedWebsite1 = profileForm.website1.trim()
      const trimmedWebsite2 = profileForm.website2.trim()

      if (trimmedAbout) payload.about = trimmedAbout
      if (trimmedDescription) payload.description = trimmedDescription
      if (trimmedAddress) payload.address = trimmedAddress
      if (trimmedEmail) payload.email = trimmedEmail
      if (trimmedWebsite1 || trimmedWebsite2) {
        payload.websites = [trimmedWebsite1, trimmedWebsite2].filter(Boolean)
      }
      if (profileForm.vertical) payload.vertical = profileForm.vertical

      let response: { ok: boolean; profile: Record<string, unknown> } | null =
        null
      const hasTextFields = Object.keys(payload).some(
        (key) => key !== "messaging_product"
      )

      if (hasTextFields || !profilePictureFile) {
        response = await whatsappClient.devices.profile.update(
          deviceId,
          payload
        )
        if (!response.ok) {
          throw new Error(deviceMessages.unableToUpdate)
        }
      }

      if (profilePictureFile) {
        response = await whatsappClient.devices.profile.uploadPicture(
          deviceId,
          profilePictureFile
        )
      }

      if (!response) throw new Error(deviceMessages.unableToUpdate)

      setDevice((prev) =>
        prev ? { ...prev, whatsappProfile: response.profile } : prev
      )
      setProfileForm(
        toProfileForm(response.profile as Record<string, unknown> | null)
      )
      clearProfilePictureSelection()
      setProfileDialogOpen(false)
      toast(deviceMessages.updated)
    } catch (err) {
      toast(err instanceof Error ? err.message : deviceMessages.unableToUpdate)
    } finally {
      setProfileSubmitting(false)
    }
  }

  const profileDialog = (
    <Dialog
      open={profileDialogOpen}
      onOpenChange={(open) => {
        setProfileDialogOpen(open)
        if (!open) clearProfilePictureSelection()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PencilSimple className="mr-2 size-4" />
          <WhatsAppText id="s83" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <WhatsAppText id="s83" />
          </DialogTitle>
          <DialogDescription>
            <WhatsAppText id="s84" />
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-about">
              <WhatsAppText id="s85" />
            </Label>
            <Input
              id="profile-about"
              maxLength={139}
              value={profileForm.about}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, about: e.target.value }))
              }
              placeholder={getWhatsAppText("s86", locale)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-description">
              <WhatsAppText id="s87" />
            </Label>
            <Textarea
              id="profile-description"
              value={profileForm.description}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder={getWhatsAppText("s88", locale)}
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
            <Label htmlFor="profile-email">
              <WhatsAppText id="s12" />
            </Label>
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
            <Label htmlFor="profile-picture-file">
              <WhatsAppText id="s89" />
            </Label>
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarImage
                  src={profilePictureUrl}
                  alt="WhatsApp profile picture preview"
                />
                <AvatarFallback>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative placeholder icon */}
                  <Image
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 gap-1">
                <Input
                  id="profile-picture-file"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleProfilePictureChange}
                />
                <p className="text-xs text-muted-foreground">
                  <WhatsAppText id="s90" />
                </p>
                {profilePictureFile && (
                  <p className="truncate text-xs font-medium">
                    {profilePictureFile.name}
                  </p>
                )}
              </div>
            </div>
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
                <SelectValue placeholder={getWhatsAppText("s91", locale)} />
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
          <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>
            <WhatsAppText id="s15" />
          </Button>
          <Button onClick={handleSaveProfile} disabled={profileSubmitting}>
            {profileSubmitting
              ? deviceMessages.saving
              : deviceMessages.saveChanges || "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const actionButtons = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void handleSyncMeta()}
        disabled={isSyncing}
        title={getWhatsAppText("s92", locale)}
      >
        <ArrowsClockwise
          className={`mr-2 size-4 ${isSyncing ? "animate-spin" : ""}`}
        />
        {isSyncing ? "Syncing..." : "Sync from Meta"}
      </Button>
      {profileDialog}
    </div>
  )

  return (
    <TabsDeviceDetail
      device={{
        id: device.id,
        phoneNumber: device.phoneNumber,
        name: device.name,
        verifiedName: device.verifiedName,
        nameStatus: device.nameStatus,
        status: device.status,
        organizationId: device.organizationId,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
      }}
      backHref={devicesPath}
      messageJourneyBasePath="/console/whatsapp/messages"
      overviewChildren={overviewContent}
      actions={actionButtons}
    />
  )
}

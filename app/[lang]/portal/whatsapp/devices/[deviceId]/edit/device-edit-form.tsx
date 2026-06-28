"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FloppyDisk, X } from "@phosphor-icons/react"
import { toast } from "sonner"

import { eden } from "@/lib/eden"
import { localizePathname } from "@/lib/i18n/pathname"
import type { AppLocale } from "@/lib/i18n/config"
import { updateDeviceSchema } from "@/modules/whatsapp/devices/devices.schemas"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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

type DeviceEditInitialData = {
  id: string
  phoneNumber: string
  status: "ACTIVE" | "NON_ACTIVE" | "DISCONNECTED" | "UNKNOWN"
  whatsappBusinessAccountId: string
  whatsappPhoneId: string
  whatsappApplicationId: string
  whatsappVersion: string
  callbackUrl: string
  quotaBase: string
  quotaBaseIn: string
  quotaBaseOut: string
  dailyLimitMessage: string
  balance: string
  expiredAt: string
  rates: string
  s3: string
  displayName: string
  whatsappProfile: Record<string, unknown>
  features: Record<string, unknown>
}

type DeviceEditFormProps = {
  locale: AppLocale
  device: DeviceEditInitialData
  backHref: string
}

type ApiValidationError = {
  ok: false
  error?: string
  message?: string
  fieldErrors?: Record<string, string | string[]>
}

type FormState = Omit<
  DeviceEditInitialData,
  "id" | "whatsappProfile" | "features"
> & {
  token: string
  profileCategory: string
  profileDescription: string
  profileEmail: string
  profilePicture: string
  profileWebsiteLines: string
  isGreenVerified: boolean
  isOfficialBusinessAccount: boolean
}

const toNumber = (value: string) =>
  value.trim() === "" ? undefined : Number(value)

const stringValue = (
  record: Record<string, unknown>,
  key: string,
  fallback = ""
) => {
  const value = record[key]
  return value == null ? fallback : String(value)
}

const booleanValue = (record: Record<string, unknown>, key: string) =>
  record[key] === true

const websiteLines = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String).join("\n")
  }

  return value == null ? "" : String(value)
}

function fieldErrorDescription(
  fieldErrors?: Record<string, string | string[]>
) {
  if (!fieldErrors) return undefined

  return Object.entries(fieldErrors)
    .map(([field, messages]) => {
      const text = Array.isArray(messages) ? messages.join(", ") : messages
      return `${field}: ${text}`
    })
    .join("\n")
}

export function DeviceEditForm({
  locale,
  device,
  backHref,
}: DeviceEditFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<FormState>({
    phoneNumber: device.phoneNumber,
    status: device.status,
    whatsappBusinessAccountId: device.whatsappBusinessAccountId,
    whatsappPhoneId: device.whatsappPhoneId,
    whatsappApplicationId: device.whatsappApplicationId,
    whatsappVersion: device.whatsappVersion,
    callbackUrl: device.callbackUrl,
    quotaBase: device.quotaBase,
    quotaBaseIn: device.quotaBaseIn,
    quotaBaseOut: device.quotaBaseOut,
    dailyLimitMessage: device.dailyLimitMessage,
    balance: device.balance,
    expiredAt: device.expiredAt,
    rates: device.rates,
    s3: device.s3,
    displayName: device.displayName,
    token: "",
    profileCategory: stringValue(device.whatsappProfile, "category"),
    profileDescription: stringValue(device.whatsappProfile, "description"),
    profileEmail: stringValue(device.whatsappProfile, "email"),
    profilePicture: stringValue(device.whatsappProfile, "profilePicture"),
    profileWebsiteLines: websiteLines(device.whatsappProfile.website),
    isGreenVerified: booleanValue(device.whatsappProfile, "isGreenVerified"),
    isOfficialBusinessAccount: booleanValue(
      device.whatsappProfile,
      "isOfficialBusinessAccount"
    ),
  })

  const updateForm = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      const whatsappProfile = {
        category: form.profileCategory.trim(),
        description: form.profileDescription.trim(),
        email: form.profileEmail.trim(),
        isGreenVerified: form.isGreenVerified,
        isOfficialBusinessAccount: form.isOfficialBusinessAccount,
        name: form.displayName.trim(),
        profilePicture: form.profilePicture.trim(),
        website: form.profileWebsiteLines
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean),
      }

      const payload = {
        phoneNumber: form.phoneNumber,
        status: form.status,
        whatsappBusinessAccountId: form.whatsappBusinessAccountId,
        whatsappPhoneId: form.whatsappPhoneId,
        whatsappApplicationId: form.whatsappApplicationId,
        whatsappVersion: form.whatsappVersion || "v24.0",
        callbackUrl: form.callbackUrl,
        quotaBase: toNumber(form.quotaBase),
        quotaBaseIn: toNumber(form.quotaBaseIn),
        quotaBaseOut: toNumber(form.quotaBaseOut),
        dailyLimitMessage: toNumber(form.dailyLimitMessage),
        balance: toNumber(form.balance),
        expiredAt: form.expiredAt
          ? new Date(form.expiredAt).toISOString()
          : undefined,
        rates: form.rates,
        s3: form.s3,
        displayName: form.displayName,
        token: form.token.trim() || undefined,
        whatsappProfile,
      }

      const validated = updateDeviceSchema.parse(payload)
      const { data } = await eden.api.admin.devices[device.id].patch(
        validated as never
      )

      if (!data?.ok) {
        const body = data as ApiValidationError
        if (body.error === "VALIDATION_ERROR") {
          toast.error(body.message || "Validation failed", {
            description: fieldErrorDescription(body.fieldErrors),
          })
          return
        }

        throw new Error(body.message || "Failed to update device.")
      }

      toast.success("Device updated successfully.")
      router.push(
        localizePathname({
          pathname: `/portal/whatsapp/devices/${device.id}`,
          locale,
        })
      )
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update device."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Meta Configuration</CardTitle>
          <CardDescription>
            WhatsApp Cloud API identifiers, callback, and token.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              value={form.phoneNumber}
              onChange={(event) =>
                updateForm({ phoneNumber: event.target.value })
              }
              placeholder="+6281234567890"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) =>
                updateForm({ status: value as FormState["status"] })
              }
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="NON_ACTIVE">Non-active</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wabaId">WhatsApp Business Account ID</Label>
            <Input
              id="wabaId"
              value={form.whatsappBusinessAccountId}
              onChange={(event) =>
                updateForm({
                  whatsappBusinessAccountId: event.target.value,
                })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phoneId">WhatsApp Phone Number ID</Label>
            <Input
              id="phoneId"
              value={form.whatsappPhoneId}
              onChange={(event) =>
                updateForm({ whatsappPhoneId: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="applicationId">WhatsApp Application ID</Label>
            <Input
              id="applicationId"
              value={form.whatsappApplicationId}
              onChange={(event) =>
                updateForm({ whatsappApplicationId: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="version">Graph API Version</Label>
            <Input
              id="version"
              value={form.whatsappVersion}
              onChange={(event) =>
                updateForm({ whatsappVersion: event.target.value })
              }
              placeholder="v24.0"
            />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="callbackUrl">Callback URL</Label>
            <Input
              id="callbackUrl"
              value={form.callbackUrl}
              onChange={(event) =>
                updateForm({ callbackUrl: event.target.value })
              }
              placeholder="https://example.com/whatsapp/callback"
            />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="token">Meta Access Token</Label>
            <Textarea
              id="token"
              value={form.token}
              onChange={(event) => updateForm({ token: event.target.value })}
              placeholder="Leave empty to keep the current encrypted token"
              className="min-h-24 font-mono"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quota and Billing</CardTitle>
          <CardDescription>
            Limits, balances, rates, and expiry for the device.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="quotaBase">Quota Base</Label>
            <Input
              id="quotaBase"
              type="number"
              min="0"
              value={form.quotaBase}
              onChange={(event) =>
                updateForm({ quotaBase: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="quotaBaseIn">Quota Base In</Label>
            <Input
              id="quotaBaseIn"
              type="number"
              min="0"
              value={form.quotaBaseIn}
              onChange={(event) =>
                updateForm({ quotaBaseIn: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="quotaBaseOut">Quota Base Out</Label>
            <Input
              id="quotaBaseOut"
              type="number"
              min="0"
              value={form.quotaBaseOut}
              onChange={(event) =>
                updateForm({ quotaBaseOut: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dailyLimitMessage">Daily Limit Message</Label>
            <Input
              id="dailyLimitMessage"
              type="number"
              min="0"
              value={form.dailyLimitMessage}
              onChange={(event) =>
                updateForm({ dailyLimitMessage: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="balance">Balance</Label>
            <Input
              id="balance"
              type="number"
              min="0"
              step="0.01"
              value={form.balance}
              onChange={(event) => updateForm({ balance: event.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="expiredAt">Expired At</Label>
            <Input
              id="expiredAt"
              type="datetime-local"
              value={form.expiredAt}
              onChange={(event) =>
                updateForm({ expiredAt: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="rates">Rates</Label>
            <Input
              id="rates"
              value={form.rates}
              onChange={(event) => updateForm({ rates: event.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="s3">S3 Path</Label>
            <Input
              id="s3"
              value={form.s3}
              onChange={(event) => updateForm({ s3: event.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Profile</CardTitle>
          <CardDescription>
            Fixed profile shape saved to the WhatsApp profile field.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={form.displayName}
              onChange={(event) =>
                updateForm({ displayName: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profileCategory">Category</Label>
            <Input
              id="profileCategory"
              value={form.profileCategory}
              onChange={(event) =>
                updateForm({ profileCategory: event.target.value })
              }
              placeholder="BUSINESS"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profileDescription">Description</Label>
            <Input
              id="profileDescription"
              value={form.profileDescription}
              onChange={(event) =>
                updateForm({ profileDescription: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profileEmail">Email</Label>
            <Input
              id="profileEmail"
              type="email"
              value={form.profileEmail}
              onChange={(event) =>
                updateForm({ profileEmail: event.target.value })
              }
              placeholder="contact@example.com"
            />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="profilePicture">Profile Picture</Label>
            <Input
              id="profilePicture"
              value={form.profilePicture}
              onChange={(event) =>
                updateForm({ profilePicture: event.target.value })
              }
              placeholder="ok"
            />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="profileWebsite">Website</Label>
            <Textarea
              id="profileWebsite"
              value={form.profileWebsiteLines}
              onChange={(event) =>
                updateForm({ profileWebsiteLines: event.target.value })
              }
              placeholder="https://premiumfast.net/"
              className="min-h-20"
            />
            <p className="text-xs text-muted-foreground">
              Enter one URL per line. Each line is saved as one item in the
              website array.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-md border p-3">
            <Checkbox
              id="isGreenVerified"
              checked={form.isGreenVerified}
              onCheckedChange={(checked) =>
                updateForm({ isGreenVerified: checked === true })
              }
            />
            <Label htmlFor="isGreenVerified">Green Verified</Label>
          </div>

          <div className="flex items-center gap-3 rounded-md border p-3">
            <Checkbox
              id="isOfficialBusinessAccount"
              checked={form.isOfficialBusinessAccount}
              onCheckedChange={(checked) =>
                updateForm({ isOfficialBusinessAccount: checked === true })
              }
            />
            <Label htmlFor="isOfficialBusinessAccount">
              Official Business Account
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={backHref}>
            <X className="mr-1.5 size-4" />
            Cancel
          </Link>
        </Button>
        <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
          <FloppyDisk className="mr-1.5 size-4" />
          {isSubmitting ? "Saving..." : "Save Device"}
        </Button>
      </div>
    </div>
  )
}

export type { DeviceEditInitialData }

"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Plus, Trash } from "@phosphor-icons/react"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { WizardData } from "./device-create-wizard"

type Props = {
  data: WizardData
  updateData: (patch: Partial<WizardData>) => void
  errors: Record<string, string>
}

function KeyValueEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
}) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const entries = Object.entries(value)
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")

  const addEntry = () => {
    if (!newKey.trim()) return
    onChange({ ...value, [newKey.trim()]: newValue })
    setNewKey("")
    setNewValue("")
  }

  const removeEntry = (key: string) => {
    const next = { ...value }
    delete next[key]
    onChange(next)
  }

  return (
    <div className="grid gap-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2">
          <Input value={k} readOnly className="flex-1 bg-muted" />
          <Input value={String(v)} readOnly className="flex-1 bg-muted" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeEntry(k)}
          >
            <Trash className="size-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder={
            messages.pWhatsappDevicesNewStepProfile.newEntryKeyPlaceholder
          }
        />
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={
            messages.pWhatsappDevicesNewStepProfile.newEntryValuePlaceholder
          }
        />
        <Button type="button" variant="outline" size="icon" onClick={addEntry}>
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function StepProfile({ data, updateData, errors }: Props) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  return (
    <div className="grid gap-5">
      <h2 className="text-lg font-semibold">
        {messages.pWhatsappDevicesNewStepProfile.stepTitle}
      </h2>
      <div className="grid gap-2">
        <Label htmlFor="display-name">
          {messages.pWhatsappDevicesNewStepProfile.displayNameLabel}
        </Label>
        <Input
          id="display-name"
          value={data.displayName}
          onChange={(e) => updateData({ displayName: e.target.value })}
          placeholder={
            messages.pWhatsappDevicesNewStepProfile.displayNamePlaceholder
          }
          aria-invalid={!!errors.displayName}
        />
        {errors.displayName && (
          <p className="text-xs text-destructive">{errors.displayName}</p>
        )}
      </div>

      {/* WhatsApp Profile */}
      <div className="grid gap-2">
        <Label>
          {messages.pWhatsappDevicesNewStepProfile.whatsappProfileLabel}
        </Label>
        <p className="text-xs text-muted-foreground">
          {messages.pWhatsappDevicesNewStepProfile.whatsappProfileDescription}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="profile-name" className="text-xs">
              {messages.pWhatsappDevicesNewStepProfile.profileNameLabel}
            </Label>
            <Input
              id="profile-name"
              value={(data.whatsappProfile.name as string) ?? ""}
              onChange={(e) =>
                updateData({
                  whatsappProfile: {
                    ...data.whatsappProfile,
                    name: e.target.value,
                  },
                })
              }
              placeholder={
                messages.pWhatsappDevicesNewStepProfile.profileNamePlaceholder
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-category" className="text-xs">
              {messages.pWhatsappDevicesNewStepProfile.profileCategoryLabel}
            </Label>
            <Input
              id="profile-category"
              value={(data.whatsappProfile.category as string) ?? ""}
              onChange={(e) =>
                updateData({
                  whatsappProfile: {
                    ...data.whatsappProfile,
                    category: e.target.value,
                  },
                })
              }
              placeholder={
                messages.pWhatsappDevicesNewStepProfile
                  .profileCategoryPlaceholder
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-desc" className="text-xs">
              {messages.pWhatsappDevicesNewStepProfile.profileDescriptionLabel}
            </Label>
            <Input
              id="profile-desc"
              value={(data.whatsappProfile.description as string) ?? ""}
              onChange={(e) =>
                updateData({
                  whatsappProfile: {
                    ...data.whatsappProfile,
                    description: e.target.value,
                  },
                })
              }
              placeholder={
                messages.pWhatsappDevicesNewStepProfile
                  .profileDescriptionPlaceholder
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-email" className="text-xs">
              {messages.pWhatsappDevicesNewStepProfile.profileEmailLabel}
            </Label>
            <Input
              id="profile-email"
              type="email"
              value={(data.whatsappProfile.email as string) ?? ""}
              onChange={(e) =>
                updateData({
                  whatsappProfile: {
                    ...data.whatsappProfile,
                    email: e.target.value,
                  },
                })
              }
              placeholder="contact@example.com"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-website" className="text-xs">
            {messages.pWhatsappDevicesNewStepProfile.profileWebsiteLabel}
          </Label>
          <Input
            id="profile-website"
            value={(data.whatsappProfile.website as string) ?? ""}
            onChange={(e) =>
              updateData({
                whatsappProfile: {
                  ...data.whatsappProfile,
                  website: e.target.value,
                },
              })
            }
            placeholder="https://example.com"
          />
        </div>
        {errors.whatsappProfile && (
          <p className="text-xs text-destructive">{errors.whatsappProfile}</p>
        )}
      </div>

      {/* Features */}
      <div className="grid gap-2">
        <Label>
          {messages.pWhatsappDevicesNewStepProfile.featureFlagsLabel}
        </Label>
        <p className="text-xs text-muted-foreground">
          {messages.pWhatsappDevicesNewStepProfile.featureFlagsDescription}
        </p>
        <KeyValueEditor
          value={data.features}
          onChange={(features) => updateData({ features })}
        />
        {errors.features && (
          <p className="text-xs text-destructive">{errors.features}</p>
        )}
      </div>

      {/* S3 Storage */}
      <div className="grid gap-2">
        <Label htmlFor="s3-path">
          {messages.pWhatsappDevicesNewStepProfile.s3StoragePathLabel}
        </Label>
        <Input
          id="s3-path"
          value={data.s3}
          onChange={(e) => updateData({ s3: e.target.value })}
          placeholder={
            messages.pWhatsappDevicesNewStepProfile.s3StoragePathPlaceholder
          }
          aria-invalid={!!errors.s3}
        />
        {errors.s3 && <p className="text-xs text-destructive">{errors.s3}</p>}
      </div>

      {/* Token */}
      <div className="grid gap-2">
        <Label htmlFor="token">
          {messages.pWhatsappDevicesNewStepProfile.deviceTokenLabel}
        </Label>
        <Input
          id="token"
          value={data.token}
          onChange={(e) => updateData({ token: e.target.value })}
          placeholder={
            messages.pWhatsappDevicesNewStepProfile.deviceTokenPlaceholder
          }
          aria-invalid={!!errors.token}
        />
        <p className="text-[11px] text-muted-foreground">
          {messages.pWhatsappDevicesNewStepProfile.deviceTokenHint}
        </p>
        {errors.token && (
          <p className="text-xs text-destructive">{errors.token}</p>
        )}
      </div>
    </div>
  )
}

"use client"

import { useParams } from "next/navigation"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MetaAppSelector } from "@/components/whatsapp/meta-app-selector"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { WizardData } from "./device-create-wizard"

type Props = {
  data: WizardData
  updateData: (patch: Partial<WizardData>) => void
  errors: Record<string, string>
}

export function StepWhatsappIds({ data, updateData, errors }: Props) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.pPortalWhatsappDevicesNewStepWhatsappIds

  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">{t.heading}</h2>
      <div className="grid gap-2">
        <Label htmlFor="device-environment">{t.environmentLabel}</Label>
        <select
          id="device-environment"
          value={data.environment}
          onChange={(event) =>
            updateData({
              environment: event.target.value as WizardData["environment"],
            })
          }
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
        >
          <option value="LIVE">{t.environmentLive}</option>
          <option value="SANDBOX">{t.environmentSandbox}</option>
        </select>
      </div>
      <MetaAppSelector
        value={data.whatsappMetaAppId}
        environment={data.environment}
        onChange={(value) => updateData({ whatsappMetaAppId: value })}
        error={errors.whatsappMetaAppId}
      />
      <div className="grid gap-2">
        <Label htmlFor="waba-id">{t.wabaIdLabel}</Label>
        <Input
          id="waba-id"
          value={data.whatsappBusinessAccountId}
          onChange={(e) =>
            updateData({ whatsappBusinessAccountId: e.target.value })
          }
          placeholder={t.wabaIdPlaceholder}
          aria-invalid={!!errors.whatsappBusinessAccountId}
        />
        {errors.whatsappBusinessAccountId && (
          <p className="text-xs text-destructive">
            {errors.whatsappBusinessAccountId}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone-id">{t.phoneIdLabel}</Label>
        <Input
          id="phone-id"
          value={data.whatsappPhoneId}
          onChange={(e) => updateData({ whatsappPhoneId: e.target.value })}
          placeholder={t.phoneIdPlaceholder}
          aria-invalid={!!errors.whatsappPhoneId}
        />
        {errors.whatsappPhoneId && (
          <p className="text-xs text-destructive">{errors.whatsappPhoneId}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="app-id">{t.applicationIdLabel}</Label>
        <Input
          id="app-id"
          value={data.whatsappApplicationId}
          onChange={(e) =>
            updateData({ whatsappApplicationId: e.target.value })
          }
          placeholder={t.applicationIdPlaceholder}
          aria-invalid={!!errors.whatsappApplicationId}
        />
        {errors.whatsappApplicationId && (
          <p className="text-xs text-destructive">
            {errors.whatsappApplicationId}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="wa-version">{t.versionLabel}</Label>
        <Input
          id="wa-version"
          value={data.whatsappVersion}
          onChange={(e) => updateData({ whatsappVersion: e.target.value })}
          placeholder={t.versionPlaceholder}
        />
        <p className="text-xs text-muted-foreground">{t.versionHint}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="callback">{t.callbackUrlLabel}</Label>
        <Input
          id="callback"
          value={data.callbackUrl}
          onChange={(e) => updateData({ callbackUrl: e.target.value })}
          placeholder="https://example.com/whatsapp/callback"
          aria-invalid={!!errors.callbackUrl}
        />
        {errors.callbackUrl && (
          <p className="text-xs text-destructive">{errors.callbackUrl}</p>
        )}
      </div>
    </div>
  )
}

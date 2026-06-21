"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { WizardData } from "./device-create-wizard"

type Props = {
  data: WizardData
  updateData: (patch: Partial<WizardData>) => void
  errors: Record<string, string>
}

export function StepWhatsappIds({ data, updateData, errors }: Props) {
  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">WhatsApp Business IDs</h2>
      <div className="grid gap-2">
        <Label htmlFor="waba-id">WhatsApp Business Account ID</Label>
        <Input
          id="waba-id"
          value={data.whatsappBusinessAccountId}
          onChange={(e) =>
            updateData({ whatsappBusinessAccountId: e.target.value })
          }
          placeholder="WABA-xxxxxxxxxxxx"
          aria-invalid={!!errors.whatsappBusinessAccountId}
        />
        {errors.whatsappBusinessAccountId && (
          <p className="text-xs text-destructive">
            {errors.whatsappBusinessAccountId}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone-id">WhatsApp Phone ID</Label>
        <Input
          id="phone-id"
          value={data.whatsappPhoneId}
          onChange={(e) => updateData({ whatsappPhoneId: e.target.value })}
          placeholder="Phone-xxxxxxxxxxxx"
          aria-invalid={!!errors.whatsappPhoneId}
        />
        {errors.whatsappPhoneId && (
          <p className="text-xs text-destructive">{errors.whatsappPhoneId}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="app-id">WhatsApp Application ID</Label>
        <Input
          id="app-id"
          value={data.whatsappApplicationId}
          onChange={(e) =>
            updateData({ whatsappApplicationId: e.target.value })
          }
          placeholder="App-xxxxxxxxxxxx"
          aria-invalid={!!errors.whatsappApplicationId}
        />
        {errors.whatsappApplicationId && (
          <p className="text-xs text-destructive">
            {errors.whatsappApplicationId}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="wa-version">WhatsApp Version</Label>
        <Input
          id="wa-version"
          value={data.whatsappVersion}
          onChange={(e) => updateData({ whatsappVersion: e.target.value })}
          placeholder="v24.0"
        />
        <p className="text-xs text-muted-foreground">
          Default: v24.0
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="callback">Callback URL</Label>
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

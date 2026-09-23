"use client"

import { useParams } from "next/navigation"
import { z } from "zod"

import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ProductProvisionAdapter } from "../product-provision-adapter.types"

export type WhatsAppPlanConfig = {
  quotaOut: number
  quotaIn: number
  maxDevices: number
  broadcast: boolean
}

export const DEFAULT_WHATSAPP_PLAN_CONFIG: WhatsAppPlanConfig = {
  quotaOut: 1000,
  quotaIn: 1000,
  maxDevices: 1,
  broadcast: false,
}
export const DEFAULT_WHATSAPP_BLUEPRINT = DEFAULT_WHATSAPP_PLAN_CONFIG

const whatsappPlanConfigSchema = z.object({
  quotaOut: z.number().finite().int().min(1).default(1000),
  quotaIn: z.number().finite().int().min(1).default(1000),
  maxDevices: z.number().finite().int().min(1).default(1),
  broadcast: z.boolean().default(false),
})

export function parseWhatsAppPlanConfig(value: unknown): WhatsAppPlanConfig {
  const raw = value as { provisioning?: unknown } | null | undefined
  const parsed = whatsappPlanConfigSchema.safeParse(raw?.provisioning ?? raw)
  return parsed.success ? parsed.data : DEFAULT_WHATSAPP_PLAN_CONFIG
}
export const parseWhatsAppBlueprint = parseWhatsAppPlanConfig

export function validateWhatsAppPlanConfig(value: unknown) {
  const raw = value as { provisioning?: unknown } | null | undefined
  const parsed = whatsappPlanConfigSchema.safeParse(raw?.provisioning ?? raw)
  if (!parsed.success) {
    return {
      valid: false,
      errors: zodErrors(parsed.error),
    }
  }
  return { valid: true as const }
}

function zodErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [
      String(issue.path[0] ?? "config"),
      issue.message,
    ])
  )
}

function NumberField({
  id,
  label,
  value,
  min,
  onChange,
  error,
  disabled,
}: Readonly<{
  id: string
  label: string
  value: number
  min: number
  onChange: (value: number) => void
  error?: string
  disabled?: boolean
}>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        aria-invalid={Boolean(error)}
      />
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function WhatsAppPlanConfigComponent({
  value,
  onChange,
  disabled,
  errors,
}: Readonly<{
  value: WhatsAppPlanConfig
  onChange: (config: WhatsAppPlanConfig) => void
  disabled?: boolean
  errors?: Record<string, string>
}>) {
  const params = useParams<{ lang?: string }>()
  const messages = getMessagesForMaybeLocale(
    params?.lang
  ).pBillingProvisioningAdaptersWhatsAppProvisionAdapter

  return (
    <section className="space-y-4 rounded-md border p-4">
      <div>
        <h3 className="font-medium">{messages.title}</h3>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          id="whatsapp-quota-out"
          label={messages.quotaOutLabel}
          value={value.quotaOut}
          min={1}
          onChange={(quotaOut) => onChange({ ...value, quotaOut })}
          error={errors?.quotaOut}
          disabled={disabled}
        />
        <NumberField
          id="whatsapp-quota-in"
          label={messages.quotaInLabel}
          value={value.quotaIn}
          min={1}
          onChange={(quotaIn) => onChange({ ...value, quotaIn })}
          error={errors?.quotaIn}
          disabled={disabled}
        />
        <NumberField
          id="whatsapp-max-devices"
          label={messages.maxDevicesLabel}
          value={value.maxDevices}
          min={1}
          onChange={(maxDevices) => onChange({ ...value, maxDevices })}
          error={errors?.maxDevices}
          disabled={disabled}
        />
      </div>
      <div className="flex items-center justify-between gap-4 border-t pt-3">
        <div>
          <Label htmlFor="whatsapp-broadcast">{messages.broadcastLabel}</Label>
          <p className="text-xs text-muted-foreground">
            {messages.broadcastDescription}
          </p>
        </div>
        <Switch
          id="whatsapp-broadcast"
          checked={value.broadcast}
          onCheckedChange={(broadcast) => onChange({ ...value, broadcast })}
          disabled={disabled}
        />
      </div>
    </section>
  )
}

export const WhatsAppProvisionAdapter: ProductProvisionAdapter<WhatsAppPlanConfig> =
  {
    id: "WHATSAPP",
    name: "WhatsApp",
    description: "Provision WhatsApp message quotas and device limits.",
    defaultConfig: DEFAULT_WHATSAPP_PLAN_CONFIG,
    defaultBlueprint: DEFAULT_WHATSAPP_PLAN_CONFIG,
    parsePlanConfig: parseWhatsAppPlanConfig,
    parseBlueprint: parseWhatsAppBlueprint,
    PlanConfigComponent: WhatsAppPlanConfigComponent,
    validatePlanConfig: validateWhatsAppPlanConfig,
  }

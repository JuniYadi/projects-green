"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Toggle } from "@/components/ui/toggle"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCallback, useEffect, useState, type FormEvent } from "react"

interface PaymentGateway {
  id: string
  name: string
  type: string
  supportedCurrencies: string[]
  isActive: boolean
  isDefault: boolean
  config: Record<string, string>
}

const CURRENCY_OPTIONS = ["IDR", "USD"] as const

const PROVIDER_OPTIONS = [
  {
    value: "duitku",
    label: "Duitku",
    supportedCurrencies: ["IDR"],
    configFields: [
      { key: "merchantCode", label: "Merchant Code", type: "string", placeholder: "M12345" },
      { key: "apiKey", label: "API Key", type: "password", placeholder: "Your Duitku API key" },
      { key: "sandboxUrl", label: "Sandbox URL", type: "url", placeholder: "https://sandbox.duitku.com" },
      { key: "productionUrl", label: "Production URL", type: "url", placeholder: "https://api.duitku.com" },
    ],
  },
  {
    value: "paypal",
    label: "PayPal",
    supportedCurrencies: ["USD"],
    configFields: [
      { key: "clientId", label: "Client ID", type: "string", placeholder: "Your PayPal REST app Client ID" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Your PayPal REST app Secret" },
      { key: "environment", label: "Environment", type: "select", placeholder: "", options: [{ label: "Sandbox", value: "sandbox" }, { label: "Production", value: "production" }] },
      { key: "webhookId", label: "Webhook ID", type: "string", placeholder: "Webhook verification ID from PayPal dashboard" },
    ],
  },
]

type ProviderOption = (typeof PROVIDER_OPTIONS)[number]
type ConfigField = ProviderOption["configFields"][number]

function readSupportedCurrencies(formData: FormData): string[] {
  return CURRENCY_OPTIONS.filter((code) => formData.get(`currency_${code}`) === "on")
}

function readConfigValues(
  formData: FormData,
  fields: ConfigField[]
): Record<string, string> {
  const config: Record<string, string> = {}
  for (const field of fields) {
    const value = String(formData.get(field.key) || "")
    if (value) config[field.key] = value
  }
  return config
}

type GatewaysRequestState =
  | { status: "loading" }
  | { status: "success"; data: PaymentGateway[] }
  | { status: "error"; message: string }

export function GatewaysTab() {
  const [state, setState] = useState<GatewaysRequestState>({ status: "loading" })
  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Track selected provider type for dynamic config fields
  const [selectedProvider, setSelectedProvider] = useState<string>("")
  const [editProviderType, setEditProviderType] = useState<string>("")

  const currentProvider = PROVIDER_OPTIONS.find((p) => p.value === selectedProvider)
  const editProvider = PROVIDER_OPTIONS.find((p) => p.value === editProviderType) || PROVIDER_OPTIONS.find((p) => p.value === editingGateway?.type)

  const fetchGateways = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/payments/gateways")

      if (!response.ok) {
        setState({ status: "error", message: "Failed to load gateways" })
        return
      }

      const payload = await response.json()

      if (payload.ok) {
        setState({ status: "success", data: payload.data || [] })
      } else {
        setState({ status: "error", message: payload.message || "Failed to load gateways" })
      }
    } catch {
      setState({ status: "error", message: "Failed to load gateways" })
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchGateways()
  }, [fetchGateways])

  async function handleToggle(gateway: PaymentGateway) {
    setTogglingId(gateway.id)
    try {
      const response = await fetch(`/api/portal/payments/gateways/${gateway.id}/toggle`, {
        method: "PATCH",
      })
      const payload = await response.json()
      if (payload.ok) {
        await fetchGateways()
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setTogglingId(null)
    }
  }

  async function handleCreateGateway(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setIsSubmitting(true)

    const providerType = String(formData.get("type") || "")
    const providerDef = PROVIDER_OPTIONS.find((p) => p.value === providerType)
    const config = providerDef ? readConfigValues(formData, providerDef.configFields) : {}
    const currencies = readSupportedCurrencies(formData)

    try {
      const response = await fetch("/api/portal/payments/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") || ""),
          type: providerType,
          supportedCurrencies: currencies,
          config,
        }),
      })
      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        setState({
          status: "error",
          message: payload.message || "Failed to create gateway",
        })
        return
      }

      setIsCreating(false)
      setSelectedProvider("")
      await fetchGateways()
    } catch {
      setState({ status: "error", message: "Failed to create gateway" })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateGateway(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingGateway) return
    const formData = new FormData(event.currentTarget)
    setIsSubmitting(true)

    const providerDef = PROVIDER_OPTIONS.find((p) => p.value === (editProviderType || editingGateway.type))
    const config = providerDef ? readConfigValues(formData, providerDef.configFields) : {}
    const currencies = readSupportedCurrencies(formData)

    try {
      const response = await fetch(
        `/api/portal/payments/gateways/${editingGateway.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(formData.get("name") || ""),
            supportedCurrencies: currencies,
            config,
          }),
        }
      )
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setState({
          status: "error",
          message: payload.message || "Failed to update gateway",
        })
        return
      }
      setEditingGateway(null)
      setEditProviderType("")
      await fetchGateways()
    } catch {
      setState({ status: "error", message: "Failed to update gateway" })
    } finally {
      setIsSubmitting(false)
    }
  }

  function renderConfigFields(
    fields: ConfigField[],
    defaults?: Record<string, string>
  ) {
    return fields.map((field) => {
      if (field.type === "select" && field.options) {
        return (
          <label key={field.key} className="space-y-2 text-sm font-medium">
            <span>{field.label}</span>
            <select
              name={field.key}
              defaultValue={defaults?.[field.key] || field.options[0].value}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )
      }

      return (
        <label key={field.key} className="space-y-2 text-sm font-medium">
          <span>{field.label}</span>
          <Input
            name={field.key}
            type={field.type === "password" ? "password" : "text"}
            placeholder={field.placeholder}
            defaultValue={defaults?.[field.key] || ""}
          />
        </label>
      )
    })
  }

  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (state.status === "error") {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {state.message}
        <div className="mt-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void fetchGateways()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const gateways = state.data

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Payment Gateways</CardTitle>
          {!editingGateway && (
            <Button type="button" size="sm" onClick={() => setIsCreating(true)}>
              Add Gateway
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCreating && (
          <form
            className="rounded-lg border bg-muted/20 p-4"
            onSubmit={handleCreateGateway}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Label className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Gateway name</span>
                <Input name="name" placeholder="My Duitku Gateway" required />
              </Label>

              <Label className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Provider type</span>
                <Select
                  name="type"
                  value={selectedProvider}
                  onValueChange={setSelectedProvider}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>

              {currentProvider && renderConfigFields(currentProvider.configFields)}

              <fieldset className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Supported currencies</span>
                <div className="flex gap-4">
                  {CURRENCY_OPTIONS.map((code) => (
                    <label key={code} className="flex items-center gap-2 font-normal">
                      <input
                        type="checkbox"
                        name={`currency_${code}`}
                        defaultChecked={currentProvider?.supportedCurrencies.includes(code) || false}
                      />
                      <span>{code}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs font-normal text-muted-foreground">
                  Defaults to the provider&apos;s supported currencies. Uncheck to restrict.
                </p>
              </fieldset>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" size="sm" disabled={isSubmitting || !selectedProvider}>
                {isSubmitting ? "Creating..." : "Create gateway"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsCreating(false)
                  setSelectedProvider("")
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {editingGateway && (
          <form
            className="rounded-lg border bg-muted/20 p-4"
            onSubmit={handleUpdateGateway}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Label className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Gateway name</span>
                <Input
                  name="name"
                  defaultValue={editingGateway.name}
                  required
                />
              </Label>

              <Label className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Provider</span>
                <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1">
                  <Badge variant="outline">{editingGateway.type}</Badge>
                </div>
              </Label>

              {editProvider && renderConfigFields(editProvider.configFields, editingGateway.config)}

              <fieldset className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Supported currencies</span>
                <div className="flex gap-4">
                  {CURRENCY_OPTIONS.map((code) => (
                    <label key={code} className="flex items-center gap-2 font-normal">
                      <input
                        type="checkbox"
                        name={`currency_${code}`}
                        defaultChecked={editingGateway.supportedCurrencies?.includes(code)}
                      />
                      <span>{code}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save gateway"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingGateway(null)
                  setEditProviderType("")
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {!editingGateway && (
          <>
            {gateways.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No payment gateways configured yet.
              </div>
            ) : (
              <div className="space-y-3">
                {gateways.map((gateway) => {
                  const providerDef = PROVIDER_OPTIONS.find((p) => p.value === gateway.type)
                  return (
                    <div
                      key={gateway.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">{gateway.name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{providerDef?.label || gateway.type}</span>
                          <Badge
                            variant={gateway.isActive ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {gateway.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {gateway.supportedCurrencies && gateway.supportedCurrencies.length > 0
                              ? gateway.supportedCurrencies.join(", ")
                              : "All currencies"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Toggle
                          variant="outline"
                          size="sm"
                          pressed={gateway.isActive}
                          disabled={togglingId === gateway.id}
                          onPressedChange={() => handleToggle(gateway)}
                          aria-label={`Toggle ${gateway.name}`}
                        >
                          {gateway.isActive ? "Active" : "Inactive"}
                        </Toggle>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingGateway(gateway)
                            setEditProviderType(gateway.type)
                          }}
                        >
                          Configure
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

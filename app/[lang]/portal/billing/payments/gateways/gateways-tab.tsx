"use client"

import { useParams } from "next/navigation"
import { eden } from "@/lib/eden"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Toggle } from "@/components/ui/toggle"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import { DataTable } from "@/components/data-table"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import type { ColumnDef } from "@tanstack/react-table"

import { invalidateBillingSetupStatus } from "@/components/billing/setup-status/billing-setup-banner"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

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

type ConfigField = {
  key: string
  type: "string" | "password" | "url" | "select" | "number"
  label: string
  placeholder?: string
  required: boolean
  defaultValue?: string
  options?: { label: string; value: string }[]
}

type ProviderOptionDTO = {
  value: string
  label: string
  supportedCurrencies: string[]
  configFields: ConfigField[]
}

function readSupportedCurrencies(formData: FormData): string[] {
  return CURRENCY_OPTIONS.filter(
    (code) => formData.get(`currency_${code}`) === "on"
  )
}

function readConfigValues(
  formData: FormData,
  fields: ConfigField[]
): Record<string, string> {
  const config: Record<string, string> = {}
  for (const field of fields) {
    const value = String(formData.get(field.key) || "")
    if (value && value !== "***ENCRYPTED***") config[field.key] = value
  }
  return config
}

function findMatchingProvider(
  providers: ProviderOptionDTO[],
  type?: string,
  name?: string
): ProviderOptionDTO | undefined {
  if (!type && !name) return undefined
  const t = (type || "").toLowerCase()
  const n = (name || "").toLowerCase()

  return (
    providers.find((p) => p.value.toLowerCase() === t) ||
    providers.find((p) => p.label.toLowerCase() === t) ||
    providers.find((p) => p.label.toLowerCase() === n) ||
    providers.find((p) => p.value.toLowerCase() === n) ||
    (t === "gateway" && n.includes("duitku")
      ? providers.find((p) => p.value === "duitku")
      : undefined) ||
    (t === "gateway" && n.includes("paypal")
      ? providers.find((p) => p.value === "paypal")
      : undefined) ||
    (t === "gateway"
      ? providers.find((p) => p.value === "duitku") || providers[0]
      : undefined)
  )
}

type GatewaysRequestState =
  | { status: "loading" }
  | { status: "success"; data: PaymentGateway[] }
  | { status: "error"; message: string }

export function GatewaysTab() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

  const [state, setState] = useState<GatewaysRequestState>({
    status: "loading",
  })
  const [providers, setProviders] = useState<ProviderOptionDTO[]>([])
  const [providersError, setProvidersError] = useState<string | null>(null)
  const [providersLoading, setProvidersLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(
    null
  )
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Track selected provider type for dynamic config fields
  const [selectedProvider, setSelectedProvider] = useState<string>("")
  const [editProviderType, setEditProviderType] = useState<string>("")

  const currentProvider = providers.find((p) => p.value === selectedProvider)
  const editProvider =
    providers.find((p) => p.value === editProviderType) ||
    findMatchingProvider(providers, editingGateway?.type, editingGateway?.name)

  const gatewayColumns = useMemo<ColumnDef<PaymentGateway>[]>(
    () => [
      {
        id: "gateway",
        accessorFn: (gateway) => gateway.name,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={
              messages.pBillingPaymentsGatewaysGatewaysTab.gatewayColumnTitle
            }
          />
        ),
        cell: ({ row }) => (
          <div className="grid gap-1">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">
              {findMatchingProvider(
                providers,
                row.original.type,
                row.original.name
              )?.label || row.original.type}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={
              messages.pBillingPaymentsGatewaysGatewaysTab.providerColumnTitle
            }
          />
        ),
        cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
      },
      {
        id: "currencies",
        accessorFn: (gateway) =>
          gateway.supportedCurrencies?.join(", ") || "all",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={
              messages.pBillingPaymentsGatewaysGatewaysTab.currenciesColumnTitle
            }
          />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.original.supportedCurrencies?.length
              ? row.original.supportedCurrencies.join(", ")
              : "All currencies"}
          </Badge>
        ),
      },
      {
        id: "status",
        accessorFn: (gateway) => (gateway.isActive ? "active" : "inactive"),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={
              messages.pBillingPaymentsGatewaysGatewaysTab.statusColumnTitle
            }
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant={row.original.isActive ? "default" : "secondary"}
            className="text-xs"
          >
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Toggle
              variant="outline"
              size="sm"
              pressed={row.original.isActive}
              disabled={togglingId === row.original.id}
              onPressedChange={() => handleToggle(row.original)}
              aria-label={`Toggle ${row.original.name}`}
            >
              {row.original.isActive ? "Inactive" : "Active"}
            </Toggle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const matched = findMatchingProvider(
                  providers,
                  row.original.type,
                  row.original.name
                )
                setEditingGateway(row.original)
                setEditProviderType(matched?.value || row.original.type)
              }}
            >
              {messages.pBillingPaymentsGatewaysGatewaysTab.configureButton}
            </Button>
          </div>
        ),
      },
    ],
    // ponytail: handleToggle is a stable hoisted async function, adding it to deps causes churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [togglingId, providers]
  )

  const fetchGateways = useCallback(async () => {
    try {
      const { data, error } = await eden.api.portal.payments.gateways.get()

      if (error) {
        setState({
          status: "error",
          message:
            (error.value as { message?: string })?.message ||
            "Failed to load gateways",
        })
        return
      }

      setState({ status: "success", data: (data as PaymentGateway[]) ?? [] })
    } catch {
      setState({ status: "error", message: "Failed to load gateways" })
    }
  }, [])

  const fetchProviders = useCallback(async () => {
    try {
      const { data, error } =
        await eden.api.portal.payments.gateways.providers.get()
      if (error) {
        setProvidersError("Failed to load providers")
        setProviders([])
      } else {
        setProvidersError(null)
        setProviders((data as ProviderOptionDTO[]) ?? [])
      }
    } catch {
      setProvidersError("Failed to load providers")
      setProviders([])
    } finally {
      setProvidersLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchGateways()
    void fetchProviders()
  }, [fetchGateways, fetchProviders])

  async function handleToggle(gateway: PaymentGateway) {
    setTogglingId(gateway.id)
    try {
      const { error } =
        await eden.api.portal.payments.gateways[gateway.id].toggle.patch()
      if (!error) {
        invalidateBillingSetupStatus()
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
    const providerDef = providers.find((p) => p.value === providerType)
    const config = providerDef
      ? readConfigValues(formData, providerDef.configFields)
      : {}
    const currencies = readSupportedCurrencies(formData)

    try {
      const body = {
        name: String(formData.get("name") || ""),
        type: providerType,
        supportedCurrencies: currencies,
        config,
      }
      const { error } = await eden.api.portal.payments.gateways.post(
        body as never
      )

      if (error) {
        setState({
          status: "error",
          message:
            (error.value as { message?: string })?.message ||
            "Failed to create gateway",
        })
        return
      }
      setIsCreating(false)
      setSelectedProvider("")
      invalidateBillingSetupStatus()
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

    const providerDef =
      providers.find(
        (p) => p.value === (editProviderType || editingGateway.type)
      ) ||
      findMatchingProvider(
        providers,
        editProviderType || editingGateway.type,
        editingGateway.name
      )

    const config = providerDef
      ? readConfigValues(formData, providerDef.configFields)
      : {}
    const currencies = readSupportedCurrencies(formData)

    try {
      const body = {
        name: String(formData.get("name") || ""),
        type: providerDef?.value || editProviderType || editingGateway.type,
        supportedCurrencies: currencies,
        config,
      }
      const { error } = await eden.api.portal.payments.gateways[
        editingGateway.id
      ].put(body as never)
      if (error) {
        setState({
          status: "error",
          message:
            (error.value as { message?: string })?.message ||
            "Failed to update gateway",
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
      const defaultValue =
        defaults?.[field.key] !== undefined && defaults[field.key] !== ""
          ? defaults[field.key]
          : field.defaultValue || ""

      const isEncrypted = defaults?.[field.key] === "***ENCRYPTED***"

      if (field.type === "select" && field.options) {
        return (
          <label key={field.key} className="space-y-2 text-sm font-medium">
            <span>{field.label}</span>
            <select
              name={field.key}
              defaultValue={defaultValue || field.options[0].value}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
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
            placeholder={
              isEncrypted
                ? "•••••••• (Leave blank to keep current)"
                : field.placeholder
            }
            defaultValue={isEncrypted ? "" : defaultValue}
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void fetchGateways()}
          >
            {messages.pBillingPaymentsGatewaysGatewaysTab.retryButton}
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
          <CardTitle className="text-base">
            {messages.pBillingPaymentsGatewaysGatewaysTab.cardTitle}
          </CardTitle>
          {!editingGateway && (
            <Button type="button" size="sm" onClick={() => setIsCreating(true)}>
              {messages.pBillingPaymentsGatewaysGatewaysTab.addGatewayButton}
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
                <span>
                  {
                    messages.pBillingPaymentsGatewaysGatewaysTab
                      .gatewayNameLabel
                  }
                </span>
                <Input
                  name="name"
                  placeholder={
                    messages.pBillingPaymentsGatewaysGatewaysTab
                      .gatewayNamePlaceholder
                  }
                  required
                />
              </Label>

              <Label className="space-y-2 text-sm font-medium md:col-span-2">
                <span>
                  {
                    messages.pBillingPaymentsGatewaysGatewaysTab
                      .providerTypeLabel
                  }
                </span>
                <Select
                  name="type"
                  value={selectedProvider}
                  onValueChange={setSelectedProvider}
                  disabled={providersLoading || providers.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        providersLoading
                          ? "Loading providers..."
                          : providersError
                            ? "Failed to load providers"
                            : providers.length === 0
                              ? "No providers available"
                              : messages.pBillingPaymentsGatewaysGatewaysTab
                                  .selectProviderPlaceholder
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>

              {providersError && (
                <p className="text-sm text-destructive">{providersError}</p>
              )}

              {currentProvider &&
                renderConfigFields(currentProvider.configFields)}

              <fieldset className="space-y-2 text-sm font-medium md:col-span-2">
                <span>
                  {
                    messages.pBillingPaymentsGatewaysGatewaysTab
                      .supportedCurrenciesLabel
                  }
                </span>
                <div className="flex gap-4">
                  {CURRENCY_OPTIONS.map((code) => (
                    <label
                      key={code}
                      className="flex items-center gap-2 font-normal"
                    >
                      <input
                        type="checkbox"
                        name={`currency_${code}`}
                        defaultChecked={
                          currentProvider?.supportedCurrencies.includes(code) ||
                          false
                        }
                      />
                      <span>{code}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs font-normal text-muted-foreground">
                  {messages.pBillingPaymentsGatewaysGatewaysTab.currenciesHint}
                </p>
              </fieldset>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !selectedProvider}
              >
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
                {messages.pBillingPaymentsGatewaysGatewaysTab.cancelButton}
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
                <span>
                  {
                    messages.pBillingPaymentsGatewaysGatewaysTab
                      .gatewayNameLabel
                  }
                </span>
                <Input
                  name="name"
                  defaultValue={editingGateway.name}
                  required
                />
              </Label>

              <Label className="space-y-2 text-sm font-medium md:col-span-2">
                <span>
                  {
                    messages.pBillingPaymentsGatewaysGatewaysTab
                      .providerColumnTitle
                  }
                </span>
                <Select
                  name="type"
                  value={editProvider?.value || editingGateway.type}
                  onValueChange={(val) => setEditProviderType(val)}
                  disabled={providersLoading || providers.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        messages.pBillingPaymentsGatewaysGatewaysTab
                          .selectProviderPlaceholder
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>

              {editProvider &&
                renderConfigFields(
                  editProvider.configFields,
                  editingGateway.config
                )}

              <fieldset className="space-y-2 text-sm font-medium md:col-span-2">
                <span>
                  {
                    messages.pBillingPaymentsGatewaysGatewaysTab
                      .supportedCurrenciesLabel
                  }
                </span>
                <div className="flex gap-4">
                  {CURRENCY_OPTIONS.map((code) => (
                    <label
                      key={code}
                      className="flex items-center gap-2 font-normal"
                    >
                      <input
                        type="checkbox"
                        name={`currency_${code}`}
                        defaultChecked={editingGateway.supportedCurrencies?.includes(
                          code
                        )}
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
                {messages.pBillingPaymentsGatewaysGatewaysTab.cancelButton}
              </Button>
            </div>
          </form>
        )}

        {!editingGateway && (
          <>
            {gateways.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {messages.pBillingPaymentsGatewaysGatewaysTab.emptyState}
              </div>
            ) : (
              <DataTable
                tableId="portal-payments-gateways"
                columns={gatewayColumns}
                data={gateways}
                searchPlaceholder={
                  messages.pBillingPaymentsGatewaysGatewaysTab.searchPlaceholder
                }
                searchableColumns={["gateway", "type", "currencies", "status"]}
                facetFilters={[
                  {
                    columnId: "status",
                    label:
                      messages.pBillingPaymentsGatewaysGatewaysTab
                        .statusColumnTitle,
                    allLabel: "All status",
                    options: [
                      { label: "Active", value: "active" },
                      { label: "Inactive", value: "inactive" },
                    ],
                  },
                ]}
                emptyMessage={
                  messages.pBillingPaymentsGatewaysGatewaysTab
                    .emptyFilterMessage
                }
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

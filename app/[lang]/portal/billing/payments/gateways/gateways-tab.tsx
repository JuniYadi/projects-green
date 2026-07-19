"use client"

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
    if (value) config[field.key] = value
  }
  return config
}

type GatewaysRequestState =
  | { status: "loading" }
  | { status: "success"; data: PaymentGateway[] }
  | { status: "error"; message: string }

export function GatewaysTab() {
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
    providers.find((p) => p.value === editingGateway?.type)

  const gatewayColumns = useMemo<ColumnDef<PaymentGateway>[]>(
    () => [
      {
        id: "gateway",
        accessorFn: (gateway) => gateway.name,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Gateway" />
        ),
        cell: ({ row }) => (
          <div className="grid gap-1">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">
              {providers.find((p) => p.value === row.original.type)?.label ||
                row.original.type}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Provider" />
        ),
        cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
      },
      {
        id: "currencies",
        accessorFn: (gateway) =>
          gateway.supportedCurrencies?.join(", ") || "all",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Currencies" />
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
          <DataTableColumnHeader column={column} title="Status" />
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
                setEditingGateway(row.original)
                setEditProviderType(row.original.type)
              }}
            >
              Configure
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

    const providerDef = providers.find(
      (p) => p.value === (editProviderType || editingGateway.type)
    )
    const config = providerDef
      ? readConfigValues(formData, providerDef.configFields)
      : {}
    const currencies = readSupportedCurrencies(formData)

    try {
      const body = {
        name: String(formData.get("name") || ""),
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
      if (field.type === "select" && field.options) {
        return (
          <label key={field.key} className="space-y-2 text-sm font-medium">
            <span>{field.label}</span>
            <select
              name={field.key}
              defaultValue={defaults?.[field.key] || field.options[0].value}
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void fetchGateways()}
          >
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
                              : "Select a provider..."
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
                <span>Supported currencies</span>
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
                  Defaults to the provider&apos;s supported currencies. Uncheck
                  to restrict.
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
                <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
                  <Badge variant="outline">{editingGateway.type}</Badge>
                </div>
              </Label>

              {editProvider &&
                renderConfigFields(
                  editProvider.configFields,
                  editingGateway.config
                )}

              <fieldset className="space-y-2 text-sm font-medium md:col-span-2">
                <span>Supported currencies</span>
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
              <DataTable
                tableId="portal-payments-gateways"
                columns={gatewayColumns}
                data={gateways}
                searchPlaceholder="Filter gateways..."
                searchableColumns={["gateway", "type", "currencies", "status"]}
                facetFilters={[
                  {
                    columnId: "status",
                    label: "Status",
                    allLabel: "All status",
                    options: [
                      { label: "Active", value: "active" },
                      { label: "Inactive", value: "inactive" },
                    ],
                  },
                ]}
                emptyMessage="No payment gateways match your filters."
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

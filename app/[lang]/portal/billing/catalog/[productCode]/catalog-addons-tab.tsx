"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@/components/ui/phosphor-icons"
import type {
  PlanAddonAttachmentForm,
  ProductPlanEditorForm,
} from "@/components/billing/admin/catalog/catalog-editor.types"

export function CatalogAddonsTab({
  addons,
  plans,
  onChange,
}: Readonly<{
  addons: PlanAddonAttachmentForm[]
  plans: ProductPlanEditorForm[]
  onChange: (addons: PlanAddonAttachmentForm[]) => void
}>) {
  // In a real implementation this would come from the addon catalog API.
  // For the UI-local mock, we provide a static list.
  const MOCK_AVAILABLE_ADDONS = [
    { code: "EXTRA_STORAGE", label: "Extra Storage" },
    { code: "DEDICATED_IP", label: "Dedicated IP" },
    { code: "PRIORITY_SUPPORT", label: "Priority Support" },
    { code: "WHATSAPP_PHONE_NUMBER", label: "WhatsApp Phone Number" },
    { code: "VPN_DEVICES", label: "Additional VPN Devices" },
  ]

  const attachedCodes = new Set(addons.map((a) => a.addonId))

  const attachAddon = () => {
    const available = MOCK_AVAILABLE_ADDONS.filter(
      (a) => !attachedCodes.has(a.code)
    )
    if (available.length === 0) return

    const nextAddon: PlanAddonAttachmentForm = {
      id: `new-addon-${crypto.randomUUID()}`,
      addonId: available[0].code,
      label: available[0].label,
      description: "",
      isRequired: false,
      displayOrder: addons.length,
      enabledTerms: {},
      isActive: true,
    }
    onChange([...addons, nextAddon])
  }

  const removeAddon = (id: string) => {
    onChange(addons.filter((a) => a.id !== id))
  }

  const moveAddon = (id: string, direction: "up" | "down") => {
    const index = addons.findIndex((a) => a.id === id)
    if (index < 0) return

    const newAddons = [...addons]
    const [removed] = newAddons.splice(index, 1)
    if (!removed) return

    const target = direction === "up" ? index - 1 : index + 1
    newAddons.splice(target, 0, removed)

    const reordered = newAddons.map((a, i) => ({ ...a, displayOrder: i }))
    onChange(reordered)
  }

  const updateAddon = (id: string, next: Partial<PlanAddonAttachmentForm>) => {
    onChange(addons.map((a) => (a.id === id ? { ...a, ...next } : a)))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {addons.length} add-on
          {addons.length !== 1 ? "s" : ""} attached to this product.
        </p>
        <Button variant="outline" size="sm" onClick={attachAddon}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Attach add-on
        </Button>
      </div>

      {addons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <PlusIcon className="h-10 w-10 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                No add-ons attached. Attach reusable add-ons to make them
                available as optional or required selections during checkout.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {addons.map((addon, index) => (
            <Card key={addon.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-medium">
                    {addon.label || addon.addonId}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveAddon(addon.id, "up")}
                      disabled={index === 0}
                      aria-label="Move up"
                    >
                      <ArrowUpIcon className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveAddon(addon.id, "down")}
                      disabled={index === addons.length - 1}
                      aria-label="Move down"
                    >
                      <ArrowDownIcon className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAddon(addon.id)}
                      aria-label="Remove add-on"
                    >
                      <TrashIcon className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Add-on</Label>
                  <Select
                    value={addon.addonId}
                    onValueChange={(value) =>
                      updateAddon(addon.id, { addonId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an add-on" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_AVAILABLE_ADDONS.filter(
                        (a) =>
                          !attachedCodes.has(a.code) || a.code === addon.addonId
                      ).map((a) => (
                        <SelectItem key={a.code} value={a.code}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input
                    value={addon.label}
                    onChange={(e) =>
                      updateAddon(addon.id, { label: e.target.value })
                    }
                    placeholder="Display label"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Description</Label>
                  <Input
                    value={addon.description}
                    onChange={(e) =>
                      updateAddon(addon.id, { description: e.target.value })
                    }
                    placeholder="Add-on description shown to customers"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={addon.isRequired}
                    onCheckedChange={(checked) =>
                      updateAddon(addon.id, { isRequired: checked })
                    }
                  />
                  <Label className="text-xs">Required</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={addon.isActive}
                    onCheckedChange={(checked) =>
                      updateAddon(addon.id, { isActive: checked })
                    }
                  />
                  <Label className="text-xs">Active</Label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CardDescription className="block">
        Plans available in this product: {plans.length}
      </CardDescription>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { eden } from "@/lib/eden"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WizardData } from "./device-create-wizard"

type Organization = { id: string; name: string }

type Props = {
  data: WizardData
  updateData: (patch: Partial<WizardData>) => void
  errors: Record<string, string>
}

export function StepOrganization({ data, updateData, errors }: Props) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    eden.api.admin.organizations
      .get({ $query: { limit: 100 } })
      .then(({ data: body }) => {
        if (body?.ok) {
          setOrganizations(
            (body as { data: { organizations: Organization[] } }).data
              .organizations
          )
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">Organization & Phone</h2>
      <div className="grid gap-2">
        <Label htmlFor="org">Organization</Label>
        <Select
          value={data.organizationId}
          onValueChange={(v) => updateData({ organizationId: v })}
        >
          <SelectTrigger
            className="w-full"
            aria-invalid={!!errors.organizationId}
          >
            <SelectValue
              placeholder={loading ? "Loading..." : "Select organization"}
            />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.organizationId && (
          <p className="text-xs text-destructive">{errors.organizationId}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          value={data.phoneNumber}
          onChange={(e) => updateData({ phoneNumber: e.target.value })}
          placeholder="+6281234567890"
          inputMode="tel"
          aria-invalid={!!errors.phoneNumber}
        />
        {errors.phoneNumber && (
          <p className="text-xs text-destructive">{errors.phoneNumber}</p>
        )}
        <p className="text-xs text-muted-foreground">
          E.164 international format with country code
        </p>
      </div>
    </div>
  )
}

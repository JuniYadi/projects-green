"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import { eden } from "@/lib/eden"

type SubscriptionType = "PAYG" | "BUNDLE" | "CUSTOM"
type BillingMode = "PACKAGE" | "PAYG" | "CUSTOM"

interface FormData {
  organizationId: string
  packageId: string
  planId: string
  pricingId: string
  type: SubscriptionType
  billingMode: BillingMode
  currentPeriodStart: string
  currentPeriodEnd: string
}

interface FormErrors {
  organizationId?: string
  packageId?: string
  planId?: string
  pricingId?: string
}

export default function CreateSubscriptionPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formData, setFormData] = useState<FormData>({
    organizationId: "",
    packageId: "",
    planId: "",
    pricingId: "",
    type: "PAYG",
    billingMode: "PACKAGE",
    currentPeriodStart: "",
    currentPeriodEnd: "",
  })

  function validateForm(): boolean {
    const newErrors: FormErrors = {}

    if (!formData.organizationId.trim()) {
      newErrors.organizationId = "Organization ID is required"
    }
    if (!formData.packageId.trim()) {
      newErrors.packageId = "Package ID is required"
    }
    if (!formData.planId.trim()) {
      newErrors.planId = "Plan ID is required"
    }
    if (!formData.pricingId.trim()) {
      newErrors.pricingId = "Pricing ID is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleChange(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!validateForm()) {
      toast.error("Please fix the form errors")
      return
    }

    setIsLoading(true)

    try {
      const body = {
        organizationId: formData.organizationId,
        packageId: formData.packageId,
        planId: formData.planId,
        pricingId: formData.pricingId,
        type: formData.type,
        billingMode: formData.billingMode,
        currentPeriodStart: formData.currentPeriodStart
          ? new Date(formData.currentPeriodStart).toISOString()
          : undefined,
        currentPeriodEnd: formData.currentPeriodEnd
          ? new Date(formData.currentPeriodEnd).toISOString()
          : undefined,
      }

      const { data: result, error } = await eden.api.billing.admin.subscriptions.post(
        body as never
      )

      if (error || !result?.ok) {
        throw new Error(
          result?.message ?? error?.message ?? "Failed to create subscription"
        )
      }

      toast.success("Subscription created successfully")
      router.push("/portal/billing/subscription")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create subscription"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <div className="flex items-center gap-4">
        <Link href="/portal/billing/subscription">
          <Button variant="ghost" size="icon">
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
        </Link>
        <header>
          <h1 className="text-2xl font-bold">Create Subscription</h1>
          <p className="text-muted-foreground">
            Create a new subscription on behalf of an organization
          </p>
        </header>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Subscription Details
          </CardTitle>
          <CardDescription>
            Configure the subscription plan, billing, and period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Organization ID *</FieldLabel>
                <Input
                  value={formData.organizationId}
                  onChange={(e) =>
                    handleChange("organizationId", e.target.value)
                  }
                  placeholder="org_abc123"
                />
                {errors.organizationId && (
                  <FieldError>{errors.organizationId}</FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel>Package ID *</FieldLabel>
                <Input
                  value={formData.packageId}
                  onChange={(e) => handleChange("packageId", e.target.value)}
                  placeholder="pkg_vpn"
                />
                {errors.packageId && (
                  <FieldError>{errors.packageId}</FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel>Plan ID *</FieldLabel>
                <Input
                  value={formData.planId}
                  onChange={(e) => handleChange("planId", e.target.value)}
                  placeholder="plan_basic"
                />
                {errors.planId && <FieldError>{errors.planId}</FieldError>}
              </Field>

              <Field>
                <FieldLabel>Pricing ID *</FieldLabel>
                <Input
                  value={formData.pricingId}
                  onChange={(e) => handleChange("pricingId", e.target.value)}
                  placeholder="price_basic_vpn_id"
                />
                {errors.pricingId && (
                  <FieldError>{errors.pricingId}</FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel>Type</FieldLabel>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    handleChange("type", value as SubscriptionType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAYG">Pay As You Go</SelectItem>
                    <SelectItem value="BUNDLE">Bundle</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Billing Mode</FieldLabel>
                <Select
                  value={formData.billingMode}
                  onValueChange={(value) =>
                    handleChange("billingMode", value as BillingMode)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PACKAGE">Package</SelectItem>
                    <SelectItem value="PAYG">Pay As You Go</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Period Start</FieldLabel>
                <Input
                  type="date"
                  value={formData.currentPeriodStart}
                  onChange={(e) =>
                    handleChange("currentPeriodStart", e.target.value)
                  }
                />
              </Field>

              <Field>
                <FieldLabel>Period End</FieldLabel>
                <Input
                  type="date"
                  value={formData.currentPeriodEnd}
                  onChange={(e) =>
                    handleChange("currentPeriodEnd", e.target.value)
                  }
                />
              </Field>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Subscription"}
              </Button>
              <Link href="/portal/billing/subscription">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

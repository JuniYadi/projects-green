"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { eden } from "@/lib/eden"
import { localizePathname } from "@/lib/i18n/pathname"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StepOrganization } from "./step-organization"
import { StepWhatsappIds } from "./step-whatsapp-ids"
import { StepQuotas } from "./step-quotas"
import { StepProfile } from "./step-profile"
import { StepReview } from "./step-review"

export type WizardData = {
  organizationId: string
  phoneNumber: string
  whatsappBusinessAccountId: string
  whatsappPhoneId: string
  whatsappApplicationId: string
  whatsappVersion: string
  callbackUrl: string
  quotaBase: string
  quotaBaseIn: string
  quotaBaseOut: string
  dailyLimitMessage: string
  balance: string
  expiredAt: string
  rates: string
  displayName: string
  whatsappProfile: Record<string, unknown>
  features: Record<string, unknown>
  s3: string
  token: string
}

const emptyData: WizardData = {
  organizationId: "",
  phoneNumber: "",
  whatsappBusinessAccountId: "",
  whatsappPhoneId: "",
  whatsappApplicationId: "",
  whatsappVersion: "v24.0",
  callbackUrl: "",
  quotaBase: "",
  quotaBaseIn: "",
  quotaBaseOut: "",
  dailyLimitMessage: "",
  balance: "",
  expiredAt: "",
  rates: "",
  displayName: "",
  whatsappProfile: {},
  features: {},
  s3: "",
  token: "",
}

const STEPS = [
  { label: "Organization & Phone" },
  { label: "WhatsApp Business IDs" },
  { label: "Quotas & Limits" },
  { label: "Profile & Features" },
  { label: "Review & Submit" },
]

const e164PhoneRegex = /^\+[1-9]\d{1,14}$/

function validateStep(
  step: number,
  data: WizardData
): Record<string, string> {
  const errors: Record<string, string> = {}

  if (step === 0) {
    if (!data.organizationId) errors.organizationId = "Organization is required"
    if (!data.phoneNumber) {
      errors.phoneNumber = "Phone number is required"
    } else if (!e164PhoneRegex.test(data.phoneNumber)) {
      errors.phoneNumber = "Must be E.164 format (e.g. +6281234567890)"
    }
  }

  if (step === 1) {
    // All fields optional in this step
  }

  if (step === 2) {
    // All fields optional — admin can set defaults
  }

  if (step === 3) {
    // All fields optional
  }

  return errors
}

import type { AppLocale } from "@/lib/i18n/config"

type DeviceCreateWizardProps = {
  locale: AppLocale
}

export function DeviceCreateWizard({ locale }: DeviceCreateWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>(emptyData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateData = useCallback(
    (patch: Partial<WizardData>) => setData((prev) => ({ ...prev, ...patch })),
    []
  )

  const handleNext = () => {
    const stepErrors = validateStep(step, data)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length === 0) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
    }
  }

  const handleBack = () => {
    setErrors({})
    setStep((s) => Math.max(s - 1, 0))
  }

  const handleStepClick = (targetStep: number) => {
    // Only allow going back to completed steps
    if (targetStep < step) {
      setErrors({})
      setStep(targetStep)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const payload = {
        organizationId: data.organizationId,
        phoneNumber: data.phoneNumber,
        name: data.displayName || data.phoneNumber,
        displayName: data.displayName || undefined,
        whatsappBusinessAccountId: data.whatsappBusinessAccountId || undefined,
        whatsappPhoneId: data.whatsappPhoneId || undefined,
        whatsappApplicationId: data.whatsappApplicationId || undefined,
        whatsappVersion: data.whatsappVersion || "v24.0",
        callbackUrl: data.callbackUrl || undefined,
        quotaBase: data.quotaBase ? Number(data.quotaBase) : undefined,
        quotaBaseIn: data.quotaBaseIn ? Number(data.quotaBaseIn) : undefined,
        quotaBaseOut: data.quotaBaseOut ? Number(data.quotaBaseOut) : undefined,
        dailyLimitMessage: data.dailyLimitMessage
          ? Number(data.dailyLimitMessage)
          : undefined,
        balance: data.balance ? Number(data.balance) : undefined,
        expiredAt: data.expiredAt
          ? new Date(data.expiredAt).toISOString()
          : undefined,
        rates: data.rates || undefined,
        s3: data.s3 || undefined,
        token: data.token || undefined,
        features:
          Object.keys(data.features).length > 0 ? data.features : undefined,
        whatsappProfile:
          Object.keys(data.whatsappProfile).length > 0
            ? data.whatsappProfile
            : undefined,
      }

      const { data: body } = await eden.api.admin.devices.post(payload as never)

      if (!body?.ok) {
        const errBody = body as {
          message?: string
          fieldErrors?: Record<string, string>
        }
        if (errBody?.fieldErrors) {
          setErrors(errBody.fieldErrors)
          // Find which step has the error and go there
          const fieldStepMap: Record<string, number> = {
            organizationId: 0,
            phoneNumber: 0,
            whatsappBusinessAccountId: 1,
            whatsappPhoneId: 1,
            whatsappApplicationId: 1,
            whatsappVersion: 1,
            callbackUrl: 1,
            quotaBase: 2,
            quotaBaseIn: 2,
            quotaBaseOut: 2,
            dailyLimitMessage: 2,
            balance: 2,
            expiredAt: 2,
            rates: 2,
            displayName: 3,
            whatsappProfile: 3,
            features: 3,
            s3: 3,
            token: 3,
          }
          const errorFields = Object.keys(errBody.fieldErrors)
          for (const f of errorFields) {
            if (fieldStepMap[f] !== undefined) {
              setStep(fieldStepMap[f])
              break
            }
          }
        }
        throw new Error(errBody?.message || "Failed to create device.")
      }

      const device = (body as { device?: { id?: string } }).device
      toast.success("Device created successfully.")
      router.push(
        localizePathname({
          pathname: `/portal/whatsapp/devices/${device?.id}`,
          locale,
        })
      )
    } catch (err) {
      if (err instanceof Error && !err.message.includes("fieldErrors")) {
        toast.error(err.message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const stepComponents = [
    <StepOrganization
      key="org"
      data={data}
      updateData={updateData}
      errors={errors}
    />,
    <StepWhatsappIds
      key="ids"
      data={data}
      updateData={updateData}
      errors={errors}
    />,
    <StepQuotas
      key="quotas"
      data={data}
      updateData={updateData}
      errors={errors}
    />,
    <StepProfile
      key="profile"
      data={data}
      updateData={updateData}
      errors={errors}
    />,
    <StepReview
      key="review"
      data={data}
      goToStep={handleStepClick}
    />,
  ]

  return (
    <>
      {/* Progress indicator */}
      <nav className="flex items-center gap-1 overflow-x-auto">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => handleStepClick(i)}
            disabled={i > step}
            className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              i === step
                ? "bg-primary text-primary-foreground"
                : i < step
                  ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-current/10 text-[10px] font-bold">
              {i + 1}
            </span>
            {s.label}
          </button>
        ))}
      </nav>

      {/* Step content */}
      <Card>
        <CardContent className="pt-6">{stepComponents[step]}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 0}
        >
          Previous
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext}>Next</Button>
        ) : (
          <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Device"}
          </Button>
        )}
      </div>
    </>
  )
}

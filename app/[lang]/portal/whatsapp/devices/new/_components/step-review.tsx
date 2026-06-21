"use client"

import { Button } from "@/components/ui/button"
import { Pencil } from "@phosphor-icons/react"
import type { WizardData } from "./device-create-wizard"

type Props = {
  data: WizardData
  goToStep: (step: number) => void
}

function ReviewSection({
  title,
  step,
  goToStep,
  children,
}: {
  title: string
  step: number
  goToStep: (s: number) => void
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => goToStep(step)}
        >
          <Pencil className="mr-1 size-3" />
          Edit
        </Button>
      </div>
      <div className="rounded-md border p-3 text-sm">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  )
}

export function StepReview({ data, goToStep }: Props) {
  const profileEntries = Object.entries(data.whatsappProfile).filter(
    ([, v]) => v !== ""
  )
  const featureEntries = Object.entries(data.features)

  return (
    <div className="grid gap-5">
      <h2 className="text-lg font-semibold">Review & Submit</h2>

      <ReviewSection title="Organization & Phone" step={0} goToStep={goToStep}>
        <Field label="Organization ID" value={data.organizationId} />
        <Field label="Phone Number" value={data.phoneNumber} />
      </ReviewSection>

      <ReviewSection
        title="WhatsApp Business IDs"
        step={1}
        goToStep={goToStep}
      >
        <Field
          label="Business Account ID"
          value={data.whatsappBusinessAccountId}
        />
        <Field label="Phone ID" value={data.whatsappPhoneId} />
        <Field label="Application ID" value={data.whatsappApplicationId} />
        <Field label="WhatsApp Version" value={data.whatsappVersion} />
        <Field label="Callback URL" value={data.callbackUrl} />
      </ReviewSection>

      <ReviewSection title="Quotas & Limits" step={2} goToStep={goToStep}>
        <Field label="Quota Base" value={data.quotaBase || "1000 (default)"} />
        <Field label="Quota Base In" value={data.quotaBaseIn || "0"} />
        <Field label="Quota Base Out" value={data.quotaBaseOut || "0"} />
        <Field
          label="Daily Message Limit"
          value={data.dailyLimitMessage || "0"}
        />
        <Field label="Balance" value={data.balance || "0"} />
        <Field label="Rates" value={data.rates} />
        <Field label="Expires At" value={data.expiredAt} />
      </ReviewSection>

      <ReviewSection title="Profile & Features" step={3} goToStep={goToStep}>
        <Field label="Display Name" value={data.displayName} />
        {profileEntries.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-xs text-muted-foreground">
              WhatsApp Profile:
            </p>
            {profileEntries.map(([k, v]) => (
              <Field key={k} label={k} value={String(v)} />
            ))}
          </div>
        )}
        {featureEntries.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-xs text-muted-foreground">
              Feature Flags:
            </p>
            {featureEntries.map(([k, v]) => (
              <Field key={k} label={k} value={String(v)} />
            ))}
          </div>
        )}
        <Field label="S3 Path" value={data.s3} />
        <Field label="Token" value={data.token ? "••••••••" : null} />
      </ReviewSection>
    </div>
  )
}

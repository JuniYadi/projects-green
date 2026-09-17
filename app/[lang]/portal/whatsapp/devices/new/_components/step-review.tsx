"use client"

import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Pencil } from "@phosphor-icons/react"
import type { WizardData } from "./device-create-wizard"
import { DEFAULT_QUOTA_BASE } from "@/modules/whatsapp/devices/devices.schemas"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

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
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

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
          {messages.pWhatsappDevicesNewStepReview.edit}
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
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)

  const profileEntries = Object.entries(data.whatsappProfile).filter(
    ([, v]) => v !== ""
  )
  const featureEntries = Object.entries(data.features)

  return (
    <div className="grid gap-5">
      <h2 className="text-lg font-semibold">
        {messages.pWhatsappDevicesNewStepReview.reviewAndSubmit}
      </h2>

      <ReviewSection
        title={messages.pWhatsappDevicesNewStepReview.organizationAndPhoneTitle}
        step={0}
        goToStep={goToStep}
      >
        <Field
          label={messages.pWhatsappDevicesNewStepReview.organizationIdLabel}
          value={data.organizationId}
        />
        <Field
          label={messages.pWhatsappDevicesNewStepReview.phoneNumberLabel}
          value={data.phoneNumber}
        />
      </ReviewSection>

      <ReviewSection
        title={messages.pWhatsappDevicesNewStepReview.whatsappBusinessIdsTitle}
        step={1}
        goToStep={goToStep}
      >
        <Field
          label={messages.pWhatsappDevicesNewStepReview.businessAccountIdLabel}
          value={data.whatsappBusinessAccountId}
        />
        <Field
          label={messages.pWhatsappDevicesNewStepReview.phoneIdLabel}
          value={data.whatsappPhoneId}
        />
        <Field
          label={messages.pWhatsappDevicesNewStepReview.applicationIdLabel}
          value={data.whatsappApplicationId}
        />
        <Field
          label={messages.pWhatsappDevicesNewStepReview.whatsappVersionLabel}
          value={data.whatsappVersion}
        />
        <Field
          label={messages.pWhatsappDevicesNewStepReview.callbackUrlLabel}
          value={data.callbackUrl}
        />
      </ReviewSection>

      <ReviewSection
        title={messages.pWhatsappDevicesNewStepReview.quotasAndLimitsTitle}
        step={2}
        goToStep={goToStep}
      >
        <Field
          label={messages.pWhatsappDevicesNewStepReview.quotaBaseLabel}
          value={data.quotaBase || `${DEFAULT_QUOTA_BASE} (default)`}
        />
        <Field
          label={messages.pWhatsappDevicesNewStepReview.quotaBaseOutLabel}
          value={data.quotaBaseOut || "0"}
        />
        <Field
          label={messages.pWhatsappDevicesNewStepReview.dailyMessageLimitLabel}
          value={data.dailyLimitMessage || "0"}
        />
        <Field
          label={messages.pWhatsappDevicesNewStepReview.balanceLabel}
          value={data.balance || "0"}
        />
        <Field
          label={messages.pWhatsappDevicesNewStepReview.ratesLabel}
          value={data.rates}
        />
        <Field
          label={messages.pWhatsappDevicesNewStepReview.expiresAtLabel}
          value={data.expiredAt}
        />
      </ReviewSection>

      <ReviewSection
        title={messages.pWhatsappDevicesNewStepReview.profileAndFeaturesTitle}
        step={3}
        goToStep={goToStep}
      >
        <Field
          label={messages.pWhatsappDevicesNewStepReview.displayNameLabel}
          value={data.displayName}
        />
        {profileEntries.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-xs text-muted-foreground">
              {messages.pWhatsappDevicesNewStepReview.whatsappProfileHeading}
            </p>
            {profileEntries.map(([k, v]) => (
              <Field key={k} label={k} value={String(v)} />
            ))}
          </div>
        )}
        {featureEntries.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-xs text-muted-foreground">
              {messages.pWhatsappDevicesNewStepReview.featureFlagsHeading}
            </p>
            {featureEntries.map(([k, v]) => (
              <Field key={k} label={k} value={String(v)} />
            ))}
          </div>
        )}
        <Field
          label={messages.pWhatsappDevicesNewStepReview.s3PathLabel}
          value={data.s3}
        />
        <Field
          label={messages.pWhatsappDevicesNewStepReview.tokenLabel}
          value={data.token ? "••••••••" : null}
        />
      </ReviewSection>
    </div>
  )
}

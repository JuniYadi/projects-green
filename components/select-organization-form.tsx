"use client"

import { useState } from "react"
import { eden } from "@/lib/eden"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { cn } from "@/lib/utils"

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"

type Organization = {
  id: string
  name: string
}

type SelectOrganizationFormProps = React.ComponentProps<"div"> & {
  email?: string
  organizations: Organization[]
  pendingAuthenticationToken: string
}

function getOrgInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function getOrgColor(id: string): string {
  // Deterministic color based on org id
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
  ]
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export function SelectOrganizationForm({
  className,
  email,
  organizations,
  pendingAuthenticationToken,
  ...props
}: SelectOrganizationFormProps) {
  const router = useRouter()
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale).pSelectOrgForm

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (organizationId: string) => {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const { data } = (await eden.api.auth[
        "organization-selection"
      ].complete.post({
        organizationId,
        pendingAuthenticationToken,
      })) as { data: { ok?: boolean; message?: string } | null }

      if (!data?.ok) {
        setSubmitError(
          data?.message ??
            "Failed to complete authentication. Please try again."
        )
        return
      }

      // Success — session cookie is set, redirect to console
      router.push("/console")
    } catch {
      setSubmitError(
        "Network error. Please check your connection and try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-bold">{messages.chooseOrganization}</h1>
          <FieldDescription>
            {email
              ? messages.accountBelongsWithEmail.replace("{email}", email)
              : messages.accountBelongs}
          </FieldDescription>
        </div>

        {submitError ? (
          <p className="text-xs text-destructive" role="alert">
            {submitError}
          </p>
        ) : null}

        {organizations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {messages.noOrgsFound}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {organizations.map((org) => {
              const isSelected = selectedOrgId === org.id
              const isThisSubmitting = isSubmitting && isSelected

              return (
                <button
                  key={org.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setSelectedOrgId(org.id)
                    handleSubmit(org.id)
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-all",
                    "hover:border-primary hover:bg-accent/50",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    isSelected
                      ? "border-primary bg-accent/50 ring-1 ring-primary"
                      : "border-border"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
                      getOrgColor(org.id)
                    )}
                  >
                    {getOrgInitials(org.name)}
                  </span>
                  <div className="flex-1">
                    <FieldLabel className="cursor-pointer">
                      {org.name}
                    </FieldLabel>
                  </div>
                  {isThisSubmitting ? (
                    <span className="text-xs text-muted-foreground">
                      {messages.signingIn}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}

        <Field>
          <FieldDescription className="text-center">
            {messages.needDifferentAccount}{" "}
            <Link href="/login" className="underline underline-offset-4">
              {messages.backToLogin}
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </div>
  )
}

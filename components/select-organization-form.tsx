"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"

type ApiErrorPayload = {
  ok?: false
  error?: string
  message?: string
}

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

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (organizationId: string) => {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(
        "/api/auth/organization-selection/complete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organizationId,
            pendingAuthenticationToken,
          }),
        }
      )

      const payload = (await response
        .json()
        .catch(() => null)) as ApiErrorPayload | null

      if (!response.ok) {
        setSubmitError(
          payload?.message ??
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
          <h1 className="text-xl font-bold">Choose an organization</h1>
          <FieldDescription>
            {email ? (
              <>
                Your account <strong>{email}</strong> belongs to multiple
                organizations. Select which one to sign in to.
              </>
            ) : (
              <>
                Your account belongs to multiple organizations. Select which one
                to sign in to.
              </>
            )}
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
              No organizations found. Please contact support.
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
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                      Signing in...
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}

        <Field>
          <FieldDescription className="text-center">
            Need to use a different account?{" "}
            <a href="/login" className="underline underline-offset-4">
              Back to login
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </div>
  )
}

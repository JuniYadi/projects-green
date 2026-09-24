"use client"

import { useState } from "react"
import { eden } from "@/lib/eden"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useMessages } from "@/components/use-messages"

type VerifyEmailFormProps = React.ComponentProps<"div"> & {
  email?: string
  nextPath?: string
  pendingAuthenticationToken: string
}

export function VerifyEmailForm({
  className,
  email,
  nextPath = "/",
  pendingAuthenticationToken,
  ...props
}: VerifyEmailFormProps) {
  const router = useRouter()
  const t = useMessages().sharedComponents.verifyEmailForm
  const encodedNext = encodeURIComponent(nextPath)
  const signInPath = `/login?next=${encodedNext}`

  const [code, setCode] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string[]>
  >({})

  const codeErrors = serverFieldErrors.code ?? []

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          event.stopPropagation()

          setSubmitError(null)
          setSubmitSuccess(null)
          setServerFieldErrors({})

          if (!pendingAuthenticationToken) {
            setSubmitError(
              "Verification session is missing. Please start login again."
            )
            return
          }

          setIsSubmitting(true)

          try {
            const { data } = await eden.api.auth[
              "email-verification"
            ].complete.post({
              code,
              pendingAuthenticationToken,
            })

            if (!data?.ok) {
              setServerFieldErrors(
                ((data as Record<string, unknown>)?.fieldErrors as Record<
                  string,
                  string[]
                >) ?? {}
              )
              setSubmitError(
                ((data as Record<string, unknown>)?.message as string) ??
                  "Invalid or expired verification code."
              )
              return
            }

            setSubmitSuccess("Email verified. Redirecting...")
            router.push(nextPath)
          } catch {
            setSubmitError("Network error. Please try again.")
          } finally {
            setIsSubmitting(false)
          }
        }}
      >
        <FieldGroup>
          <div className="flex flex-col gap-1 text-center">
            <h1 className="text-xl font-bold">{t.heading}</h1>
            <FieldDescription>
              {t.sentToPrefix}{" "}
              {email ? <strong>{email}</strong> : t.emailFallback}.
            </FieldDescription>
          </div>

          {submitError ? (
            <p className="text-xs text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}

          {!submitError && submitSuccess ? (
            <p className="text-xs text-emerald-600" role="status">
              {submitSuccess}
            </p>
          ) : null}

          <Field data-invalid={codeErrors.length > 0 ? "true" : "false"}>
            <FieldLabel htmlFor="code">{t.codeLabel}</FieldLabel>
            <Input
              id="code"
              name="code"
              type="text"
              value={code}
              placeholder={t.codePlaceholder}
              aria-invalid={codeErrors.length > 0}
              onChange={(event) => {
                setServerFieldErrors({})
                setSubmitError(null)
                setSubmitSuccess(null)
                setCode(event.target.value)
              }}
            />
            {codeErrors.length > 0 ? (
              <FieldError errors={codeErrors.map((message) => ({ message }))} />
            ) : null}
          </Field>

          <Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Verifying..." : "Verify email"}
            </Button>
            <FieldDescription className="text-center">
              {t.needNewCode} <a href={signInPath}>{t.backToLogin}</a>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { eden } from "@/lib/eden"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { XCircleIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"

type ApiErrorPayload = {
  ok?: false
  error?: string
  message?: string
  fieldErrors?: Record<string, string[]>
}

const VERIFICATION_CODE_LENGTH = 6
const VERIFICATION_CODE_ERROR =
  "Please enter the 6-digit verification code from your email."
const VERIFICATION_CODE_INDEXES = Array.from(
  { length: VERIFICATION_CODE_LENGTH },
  (_, index) => index
)
const createEmptyCodeDigits = () =>
  Array.from({ length: VERIFICATION_CODE_LENGTH }, () => "")

const emailSchema = z.email("Please enter a valid email address")

const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, VERIFICATION_CODE_ERROR)

type LoginFormProps = React.ComponentProps<"div"> & {
  nextPath?: string
  errorMessage?: string
}

export function LoginForm({
  className,
  nextPath = "/",
  errorMessage,
  ...props
}: LoginFormProps) {
  const router = useRouter()
  const encodedNext = encodeURIComponent(nextPath)
  const signInWithGooglePath = `/login/start?next=${encodedNext}&provider=google`
  const signInWithGithubPath = `/login/start?next=${encodedNext}&provider=github`
  const createAccountPath = `/login/start?intent=signup&next=${encodedNext}`

  const [email, setEmail] = useState("")
  const [codeDigits, setCodeDigits] = useState(createEmptyCodeDigits)
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([])
  const code = codeDigits.join("")
  const [isCodeStep, setIsCodeStep] = useState(false)
  const [isRequestingCode, setIsRequestingCode] = useState(false)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string[]>
  >({})

  const clearServerFieldError = (fieldName: "email" | "code") => {
    setServerFieldErrors((previous) => {
      if (!previous[fieldName]) {
        return previous
      }

      const next = { ...previous }
      delete next[fieldName]
      return next
    })
  }

  const clearCodeFeedback = () => {
    clearServerFieldError("code")
    setSubmitError(null)
    setSubmitSuccess(null)
  }

  const focusCodeInput = (index: number) => {
    codeInputRefs.current[index]?.focus()
  }

  useEffect(() => {
    if (isCodeStep) {
      codeInputRefs.current[0]?.focus()
    }
  }, [isCodeStep])

  const setCodeDigit = (index: number, rawValue: string) => {
    clearCodeFeedback()
    const digit = rawValue.replace(/\D/g, "").slice(-1)

    setCodeDigits((previous) => {
      const next = [...previous]
      next[index] = digit
      return next
    })

    if (digit && index < VERIFICATION_CODE_LENGTH - 1) {
      focusCodeInput(index + 1)
    }
  }

  const setCodeDigitRange = (startIndex: number, rawValue: string) => {
    clearCodeFeedback()
    const digits = rawValue
      .replace(/\D/g, "")
      .slice(0, VERIFICATION_CODE_LENGTH - startIndex)
      .split("")

    if (digits.length === 0) {
      return
    }

    setCodeDigits((previous) => {
      const next = [...previous]
      digits.forEach((digit, offset) => {
        next[startIndex + offset] = digit
      })
      return next
    })

    focusCodeInput(
      Math.min(startIndex + digits.length, VERIFICATION_CODE_LENGTH - 1)
    )
  }

  const handleCodeKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key !== "Backspace" || codeDigits[index] || index === 0) {
      return
    }

    event.preventDefault()
    setCodeDigits((previous) => {
      const next = [...previous]
      next[index - 1] = ""
      return next
    })
    focusCodeInput(index - 1)
  }

  const requestMagicCode = async () => {
    setSubmitError(null)
    setSubmitSuccess(null)
    setServerFieldErrors({})

    const emailResult = emailSchema.safeParse(email)

    if (!emailResult.success) {
      const message = emailResult.error.issues[0]?.message

      setServerFieldErrors({ email: message ? [message] : [] })
      setSubmitError(message ?? "Please enter a valid email address.")
      return
    }

    setIsRequestingCode(true)

    try {
      const { data: payload } = await eden.api.auth.magic.request.post({
        email: emailResult.data,
      })

      if (!payload) {
        setServerFieldErrors(
          (payload as ApiErrorPayload | null)?.fieldErrors ?? {}
        )
        setSubmitError(
          (payload as ApiErrorPayload | null)?.message ??
            "Failed to send verification code. Please try again."
        )
        return
      }

      setIsCodeStep(true)
      setSubmitSuccess(
        payload?.message ??
          "If this email is registered, we sent a verification code."
      )
    } catch {
      setSubmitError("Network error. Please try again.")
    } finally {
      setIsRequestingCode(false)
    }
  }

  const verifyMagicCode = async () => {
    setSubmitError(null)
    setSubmitSuccess(null)
    setServerFieldErrors({})

    const nextFieldErrors: Record<string, string[]> = {}

    const emailResult = emailSchema.safeParse(email)

    if (!emailResult.success) {
      const message = emailResult.error.issues[0]?.message
      nextFieldErrors.email = [message ?? "Please enter a valid email address."]
    }

    const codeResult = codeSchema.safeParse(code)

    if (!codeResult.success) {
      const message = codeResult.error.issues[0]?.message
      nextFieldErrors.code = [
        message ?? "Please enter the verification code from your email.",
      ]
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setServerFieldErrors(nextFieldErrors)
      setSubmitError("Please fix the highlighted fields and try again.")
      return
    }

    setIsVerifyingCode(true)

    try {
      const { data: payload } = await eden.api.auth.magic.verify.post({
        email: emailResult.data ?? email,
        code: codeResult.data ?? code,
      })

      if (!payload || !payload.ok) {
        setServerFieldErrors(
          (payload as { fieldErrors?: Record<string, string[]> })
            ?.fieldErrors ?? {}
        )
        setSubmitError(
          (payload as { message?: string })?.message ??
            "Invalid or expired code. Please try again."
        )
        return
      }

      setSubmitSuccess("Login successful.")
      window.location.assign(nextPath)
    } catch {
      setSubmitError("Network error. Please try again.")
    } finally {
      setIsVerifyingCode(false)
    }
  }

  const emailErrors = serverFieldErrors.email ?? []
  const codeErrors = serverFieldErrors.code ?? []

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()

          if (isCodeStep) {
            void verifyMagicCode()
            return
          }

          void requestMagicCode()
        }}
      >
        <FieldGroup>
          {errorMessage ? (
            <Alert variant="destructive">
              <XCircleIcon className="size-4 shrink-0" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
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

          {!isCodeStep ? (
            <>
              <Field>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    type="button"
                    aria-label="Login with Google"
                    className="w-full min-w-0 gap-2 px-2"
                    onClick={() => router.push(signInWithGooglePath)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <path
                        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                        fill="currentColor"
                      />
                    </svg>
                    Google
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    aria-label="Login with GitHub"
                    className="w-full min-w-0 gap-2 px-2"
                    onClick={() => router.push(signInWithGithubPath)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <path
                        d="M12 0C5.37 0 0 5.37 0 12a12 12 0 008.2 11.39c.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.48.99.1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.94 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.64.24 2.86.12 3.16.77.84 1.24 1.92 1.24 3.23 0 4.61-2.8 5.63-5.48 5.93.43.37.81 1.1.81 2.22 0 1.6-.02 2.89-.02 3.28 0 .32.22.7.83.58A12 12 0 0024 12c0-6.63-5.37-12-12-12z"
                        fill="currentColor"
                      />
                    </svg>
                    GitHub
                  </Button>
                </div>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with email code
              </FieldSeparator>

              <Field data-invalid={emailErrors.length > 0 ? "true" : "false"}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  placeholder="m@example.com"
                  aria-invalid={emailErrors.length > 0}
                  onChange={(event) => {
                    clearServerFieldError("email")
                    setSubmitError(null)
                    setSubmitSuccess(null)
                    setEmail(event.target.value)
                  }}
                />
                {emailErrors.length > 0 ? (
                  <FieldError
                    errors={emailErrors.map((message) => ({ message }))}
                  />
                ) : null}
              </Field>
            </>
          ) : null}

          {isCodeStep ? (
            <Field
              data-invalid={codeErrors.length > 0 ? "true" : "false"}
              className="items-center text-center"
            >
              <FieldLabel htmlFor="code" className="text-base">
                Enter verification code
              </FieldLabel>
              <FieldDescription className="text-center">
                Check {email} for the 6-digit code.
              </FieldDescription>
              <div
                className="flex justify-center gap-2"
                aria-label="Verification code"
              >
                {VERIFICATION_CODE_INDEXES.map((index) => (
                  <Input
                    key={index}
                    ref={(element) => {
                      codeInputRefs.current[index] = element
                    }}
                    id={index === 0 ? "code" : `code-${index + 1}`}
                    name={index === 0 ? "code" : undefined}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : undefined}
                    pattern="[0-9]*"
                    maxLength={1}
                    value={codeDigits[index] ?? ""}
                    aria-label={`Verification code digit ${index + 1}`}
                    aria-invalid={codeErrors.length > 0}
                    className="h-12 w-11 text-center text-lg font-semibold sm:w-12"
                    onChange={(event) =>
                      setCodeDigit(index, event.target.value)
                    }
                    onPaste={(event) => {
                      event.preventDefault()
                      setCodeDigitRange(
                        index,
                        event.clipboardData.getData("text")
                      )
                    }}
                    onKeyDown={(event) => handleCodeKeyDown(index, event)}
                  />
                ))}
              </div>
              {codeErrors.length > 0 ? (
                <FieldError
                  errors={codeErrors.map((message) => ({ message }))}
                />
              ) : null}
            </Field>
          ) : null}

          <Field>
            <Button
              type="submit"
              disabled={isRequestingCode || isVerifyingCode}
            >
              {!isCodeStep
                ? isRequestingCode
                  ? "Sending code..."
                  : "Send login code"
                : isVerifyingCode
                  ? "Verifying..."
                  : "Verify and login"}
            </Button>
            {isCodeStep ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setCodeDigits(createEmptyCodeDigits())
                  setIsCodeStep(false)
                  setServerFieldErrors({})
                  setSubmitError(null)
                  setSubmitSuccess(null)
                }}
              >
                Back to SSO or email
              </Button>
            ) : null}
            <FieldDescription className="text-center">
              Need an account?{" "}
              <a href={createAccountPath}>Create one with WorkOS</a>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}

"use client"

import { useState } from "react"
import { z } from "zod"
import { useRouter } from "next/navigation"

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

type ApiErrorPayload = {
  ok?: false
  error?: string
  message?: string
  fieldErrors?: Record<string, string[]>
}

const emailSchema = z.email("Please enter a valid email address")

const codeSchema = z
  .string()
  .trim()
  .min(1, "Please enter the verification code from your email.")

type LoginFormProps = React.ComponentProps<"div"> & {
  nextPath?: string
}

export function LoginForm({
  className,
  nextPath = "/",
  ...props
}: LoginFormProps) {
  const router = useRouter()
  const encodedNext = encodeURIComponent(nextPath)
  const signInWithApplePath = `/login/start?next=${encodedNext}&provider=apple`
  const signInWithGooglePath = `/login/start?next=${encodedNext}&provider=google`
  const signInWithGithubPath = `/login/start?next=${encodedNext}&provider=github`
  const signUpPath = `/signup?next=${encodedNext}`

  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
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
      const response = await fetch("/api/auth/magic/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: emailResult.data }),
      })

      const payload = (await response
        .json()
        .catch(() => null)) as ApiErrorPayload | { message?: string } | null

      if (!response.ok) {
        setServerFieldErrors((payload as ApiErrorPayload | null)?.fieldErrors ?? {})
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
      const response = await fetch("/api/auth/magic/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailResult.data,
          code: codeResult.data,
        }),
      })

      const payload = (await response
        .json()
        .catch(() => null)) as ApiErrorPayload | null

      if (!response.ok) {
        setServerFieldErrors(payload?.fieldErrors ?? {})
        setSubmitError(
          payload?.message ?? "Invalid or expired code. Please try again."
        )
        return
      }

      setSubmitSuccess("Login successful.")
      router.push(nextPath)
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

          <Field>
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push(signInWithApplePath)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                  fill="currentColor"
                />
              </svg>
              Login with Apple
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push(signInWithGooglePath)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
              Login with Google
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push(signInWithGithubPath)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12 0C5.37 0 0 5.37 0 12a12 12 0 008.2 11.39c.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.48.99.1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.94 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.64.24 2.86.12 3.16.77.84 1.24 1.92 1.24 3.23 0 4.61-2.8 5.63-5.48 5.93.43.37.81 1.1.81 2.22 0 1.6-.02 2.89-.02 3.28 0 .32.22.7.83.58A12 12 0 0024 12c0-6.63-5.37-12-12-12z"
                  fill="currentColor"
                />
              </svg>
              Login with GitHub
            </Button>
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
              <FieldError errors={emailErrors.map((message) => ({ message }))} />
            ) : null}
          </Field>

          {isCodeStep ? (
            <Field data-invalid={codeErrors.length > 0 ? "true" : "false"}>
              <FieldLabel htmlFor="code">Verification code</FieldLabel>
              <Input
                id="code"
                name="code"
                type="text"
                value={code}
                placeholder="Enter the code from your email"
                aria-invalid={codeErrors.length > 0}
                onChange={(event) => {
                  clearServerFieldError("code")
                  setSubmitError(null)
                  setSubmitSuccess(null)
                  setCode(event.target.value)
                }}
              />
              {codeErrors.length > 0 ? (
                <FieldError errors={codeErrors.map((message) => ({ message }))} />
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
                  setCode("")
                  setIsCodeStep(false)
                  setServerFieldErrors({})
                  setSubmitError(null)
                  setSubmitSuccess(null)
                }}
              >
                Use another email
              </Button>
            ) : null}
            <FieldDescription className="text-center">
              Don&apos;t have an account? <a href={signUpPath}>Sign up</a>
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

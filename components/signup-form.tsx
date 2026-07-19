"use client"

import { useMemo, useState } from "react"
import { eden } from "@/lib/eden"
import { useForm } from "@tanstack/react-form"
import { RowsIcon } from "@phosphor-icons/react"
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
import { signupSchema, type SignupInput } from "@/lib/validation"

const toErrorMessages = (errors: unknown[]) => {
  return errors.flatMap((error) => {
    if (typeof error === "string") {
      return [error]
    }

    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return [error.message]
    }

    return []
  })
}

type SignupFormProps = React.ComponentProps<"div"> & {
  nextPath?: string
}

export function SignupForm({
  className,
  nextPath = "/",
  ...props
}: SignupFormProps) {
  const router = useRouter()
  const encodedNext = encodeURIComponent(nextPath)
  const signUpWithApplePath = `/signup/start?next=${encodedNext}&provider=apple`
  const signUpWithGooglePath = `/signup/start?next=${encodedNext}&provider=google`
  const signUpWithGithubPath = `/signup/start?next=${encodedNext}&provider=github`
  const signInPath = `/login?next=${encodedNext}`
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string[]>
  >({})

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    } satisfies SignupInput,
    validators: {
      onChange: signupSchema,
      onSubmit: signupSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      setSubmitError(null)
      setSubmitSuccess(null)
      setServerFieldErrors({})

      try {
        const { data: payload } = (await eden.api.auth.signup.post(value)) as {
          data: {
            ok?: boolean
            message?: string
            fieldErrors?: Record<string, string[]>
          } | null
        }

        if (!payload?.ok) {
          setServerFieldErrors(payload?.fieldErrors ?? {})
          setSubmitError(
            payload?.message ??
              "Signup failed. Please check your input and try again."
          )
          return
        }

        setSubmitSuccess("Account created successfully.")
        formApi.reset()
        router.push(nextPath)
      } catch {
        setSubmitError("Network error. Please try again.")
      }
    },
  })

  const clearServerFieldError = (fieldName: keyof SignupInput) => {
    setServerFieldErrors((previous) => {
      if (!previous[fieldName]) {
        return previous
      }

      const next = { ...previous }
      delete next[fieldName]
      return next
    })
  }

  const formSummaryMessage = useMemo(() => {
    if (submitError) {
      return {
        kind: "error" as const,
        value: submitError,
      }
    }

    if (submitSuccess) {
      return {
        kind: "success" as const,
        value: submitSuccess,
      }
    }

    return null
  }, [submitError, submitSuccess])

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <FieldGroup>
          {formSummaryMessage ? (
            <p
              className={cn(
                "text-xs",
                formSummaryMessage.kind === "error"
                  ? "text-destructive"
                  : "text-emerald-600"
              )}
              role="alert"
            >
              {formSummaryMessage.value}
            </p>
          ) : null}
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-8 items-center justify-center rounded-md">
                <RowsIcon className="size-6" />
              </div>
              <span className="sr-only">Acme Inc.</span>
            </a>
            <h1 className="text-xl font-bold">Welcome to Acme Inc.</h1>
            <FieldDescription>
              Already have an account? <a href={signInPath}>Sign in</a>
            </FieldDescription>
          </div>

          <form.Field name="name">
            {(field) => {
              const errors = [
                ...toErrorMessages(field.state.meta.errors),
                ...(serverFieldErrors.name ?? []),
              ]
              const hasError =
                errors.length > 0 &&
                (field.state.meta.isTouched ||
                  (serverFieldErrors.name?.length ?? 0) > 0)

              return (
                <Field data-invalid={hasError ? "true" : "false"}>
                  <FieldLabel htmlFor={field.name}>Full name</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="text"
                    value={field.state.value}
                    placeholder="John Doe"
                    aria-invalid={hasError}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      clearServerFieldError("name")
                      setSubmitError(null)
                      setSubmitSuccess(null)
                      field.handleChange(event.target.value)
                    }}
                  />
                  {hasError ? (
                    <FieldError
                      errors={errors.map((message) => ({ message }))}
                    />
                  ) : null}
                </Field>
              )
            }}
          </form.Field>

          <form.Field name="email">
            {(field) => {
              const errors = [
                ...toErrorMessages(field.state.meta.errors),
                ...(serverFieldErrors.email ?? []),
              ]
              const hasError =
                errors.length > 0 &&
                (field.state.meta.isTouched ||
                  (serverFieldErrors.email?.length ?? 0) > 0)

              return (
                <Field data-invalid={hasError ? "true" : "false"}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    value={field.state.value}
                    placeholder="m@example.com"
                    aria-invalid={hasError}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      clearServerFieldError("email")
                      setSubmitError(null)
                      setSubmitSuccess(null)
                      field.handleChange(event.target.value)
                    }}
                  />
                  {hasError ? (
                    <FieldError
                      errors={errors.map((message) => ({ message }))}
                    />
                  ) : null}
                </Field>
              )
            }}
          </form.Field>

          <form.Field name="password">
            {(field) => {
              const errors = [
                ...toErrorMessages(field.state.meta.errors),
                ...(serverFieldErrors.password ?? []),
              ]
              const hasError =
                errors.length > 0 &&
                (field.state.meta.isTouched ||
                  (serverFieldErrors.password?.length ?? 0) > 0)

              return (
                <Field data-invalid={hasError ? "true" : "false"}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    aria-invalid={hasError}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      clearServerFieldError("password")
                      setSubmitError(null)
                      setSubmitSuccess(null)
                      field.handleChange(event.target.value)
                    }}
                  />
                  {hasError ? (
                    <FieldError
                      errors={errors.map((message) => ({ message }))}
                    />
                  ) : null}
                </Field>
              )
            }}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => {
              const errors = [
                ...toErrorMessages(field.state.meta.errors),
                ...(serverFieldErrors.confirmPassword ?? []),
              ]
              const hasError =
                errors.length > 0 &&
                (field.state.meta.isTouched ||
                  (serverFieldErrors.confirmPassword?.length ?? 0) > 0)

              return (
                <Field data-invalid={hasError ? "true" : "false"}>
                  <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    aria-invalid={hasError}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      clearServerFieldError("confirmPassword")
                      setSubmitError(null)
                      setSubmitSuccess(null)
                      field.handleChange(event.target.value)
                    }}
                  />
                  {hasError ? (
                    <FieldError
                      errors={errors.map((message) => ({ message }))}
                    />
                  ) : null}
                </Field>
              )
            }}
          </form.Field>

          <Field>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating account..." : "Create Account"}
                </Button>
              )}
            </form.Subscribe>
          </Field>

          <FieldSeparator>Or</FieldSeparator>
          <Field className="grid gap-4 sm:grid-cols-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push(signUpWithApplePath)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                  fill="currentColor"
                />
              </svg>
              Continue with Apple
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push(signUpWithGooglePath)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
              Continue with Google
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push(signUpWithGithubPath)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12 0C5.37 0 0 5.37 0 12a12 12 0 008.2 11.39c.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.48.99.1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.94 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.64.24 2.86.12 3.16.77.84 1.24 1.92 1.24 3.23 0 4.61-2.8 5.63-5.48 5.93.43.37.81 1.1.81 2.22 0 1.6-.02 2.89-.02 3.28 0 .32.22.7.83.58A12 12 0 0024 12c0-6.63-5.37-12-12-12z"
                  fill="currentColor"
                />
              </svg>
              Continue with GitHub
            </Button>
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

import { z } from "zod"

export const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
})

export const signupSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(80, "Name must be at most 80 characters"),
    email: z.email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
    confirmPassword: z
      .string()
      .min(8, "Confirm password must be at least 8 characters")
      .max(128, "Confirm password must be at most 128 characters"),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      })
    }
  })

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "EMAIL_ALREADY_EXISTS"
  | "INVALID_CREDENTIALS"
  | "USER_NOT_FOUND"
  | "INTERNAL_SERVER_ERROR"

export type ApiErrorResponse = {
  ok: false
  error: ApiErrorCode
  message?: string
  fieldErrors?: Record<string, string[]>
}

export const fieldErrorMapFromIssues = (
  issues: Array<{ path: Array<string | number>; message: string }>
) => {
  const fieldErrors: Record<string, string[]> = {}

  for (const issue of issues) {
    const key = issue.path.join(".")

    if (!key) {
      continue
    }

    if (!fieldErrors[key]) {
      fieldErrors[key] = []
    }

    fieldErrors[key].push(issue.message)
  }

  return fieldErrors
}

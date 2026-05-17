import { describe, expect, it } from "bun:test"

import {
  fieldErrorMapFromIssues,
  loginSchema,
  signupSchema,
} from "@/lib/validation"

type SimpleIssue = { path: Array<string | number>; message: string }

describe("loginSchema", () => {
  it("accepts valid login payload", () => {
    const result = loginSchema.safeParse({
      email: "dev@example.com",
      password: "verysecure",
    })

    expect(result.success).toBe(true)
  })

  it("rejects invalid email and short password", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "short",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const fieldErrors = fieldErrorMapFromIssues(
        result.error.issues as unknown as SimpleIssue[]
      )
      expect(fieldErrors.email?.[0]).toContain("valid email")
      expect(fieldErrors.password?.[0]).toContain("at least 8")
    }
  })
})

describe("signupSchema", () => {
  it("accepts matching passwords", () => {
    const result = signupSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "verysecure",
      confirmPassword: "verysecure",
    })

    expect(result.success).toBe(true)
  })

  it("rejects mismatched passwords", () => {
    const result = signupSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "verysecure",
      confirmPassword: "different",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const fieldErrors = fieldErrorMapFromIssues(
        result.error.issues as unknown as SimpleIssue[]
      )
      expect(fieldErrors.confirmPassword?.[0]).toBe("Passwords do not match")
    }
  })
})

describe("fieldErrorMapFromIssues", () => {
  it("groups issues by field path and ignores root-level issues", () => {
    const mapped = fieldErrorMapFromIssues([
      { path: ["email"], message: "Invalid email" },
      { path: ["email"], message: "Email already exists" },
      { path: ["profile", "name"], message: "Name is required" },
      { path: [], message: "Root issue" },
    ])

    expect(mapped).toEqual({
      email: ["Invalid email", "Email already exists"],
      "profile.name": ["Name is required"],
    })
  })
})

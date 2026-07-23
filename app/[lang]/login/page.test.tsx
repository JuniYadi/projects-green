import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { ReactNode } from "react"

let capturedLoginFormProps: {
  nextPath?: string
  errorMessage?: string
} | null = null

mock.module("@/components/auth-page-shell", () => ({
  AuthPageShell: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

mock.module("@/components/login-form", () => ({
  LoginForm: (props: { nextPath?: string; errorMessage?: string }) => {
    capturedLoginFormProps = props
    return <div data-testid="login-form" />
  },
}))

const { render } = await import("@testing-library/react")
const { default: LoginPage } = await import("./page")

describe("LoginPage", () => {
  beforeEach(() => {
    capturedLoginFormProps = null
  })

  it("defaults Indonesian login to the localized console", async () => {
    const ui = await LoginPage({
      params: Promise.resolve({ lang: "id" }),
      searchParams: Promise.resolve({}),
    })

    render(ui)

    expect(capturedLoginFormProps?.nextPath).toBe("/id/console")
  })

  it("preserves an explicit safe next path and error message", async () => {
    const ui = await LoginPage({
      params: Promise.resolve({ lang: "id" }),
      searchParams: Promise.resolve({
        next: "/id/portal",
        error: "Authentication failed",
      }),
    })

    render(ui)

    expect(capturedLoginFormProps).toEqual({
      nextPath: "/id/portal",
      errorMessage: "Authentication failed",
    })
  })
  it("rejects a protocol-relative next path", async () => {
    const ui = await LoginPage({
      params: Promise.resolve({ lang: "id" }),
      searchParams: Promise.resolve({ next: "//evil.test" }),
    })

    render(ui)

    expect(capturedLoginFormProps?.nextPath).toBe("/id/console")
  })
})

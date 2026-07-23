import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"

// ── Mock eden client (leaf infrastructure) ──────────────────────────────
const mockRequestMagicCode = mock(
  (): Promise<{ data: unknown }> => Promise.resolve({ data: null })
)
const mockVerifyMagicCode = mock(
  (): Promise<{ data: unknown }> => Promise.resolve({ data: null })
)

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      auth: {
        magic: {
          request: { post: mockRequestMagicCode },
          verify: { post: mockVerifyMagicCode },
        },
      },
    },
  },
}))

// ── Mock next/navigation locally so we control router.push ──────────────
const routerPushMock = mock(() => {})

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}))

// ── Mock window.location.assign for hard navigation after OTP success ───
const locationAssignMock = mock((_: string | URL) => {})
const originalLocationAssign = window.location.assign

// ── Dynamic imports after mocks ─────────────────────────────────────────
const { render, waitFor, fireEvent } = await import("@testing-library/react")
const { default: userEvent } = await import("@testing-library/user-event")
const { LoginForm } = await import("./login-form")

describe("LoginForm", () => {
  beforeEach(() => {
    mockRequestMagicCode.mockClear()
    mockVerifyMagicCode.mockClear()
    routerPushMock.mockClear()
    locationAssignMock.mockClear()
    window.location.assign = locationAssignMock as typeof window.location.assign
    mockRequestMagicCode.mockResolvedValue({
      data: {
        ok: true,
        message: "If this email is registered, we sent a verification code.",
      },
    })
    mockVerifyMagicCode.mockResolvedValue({ data: { ok: true } })
  })

  afterEach(() => {
    window.location.assign = originalLocationAssign
  })

  it("hides Apple and keeps Google and GitHub login options", () => {
    const view = render(<LoginForm nextPath="/console" />)

    expect(view.queryByRole("button", { name: "Login with Apple" })).toBeNull()
    expect(
      view.getByRole("button", { name: "Login with Google" })
    ).toBeDefined()
    expect(
      view.getByRole("button", { name: "Login with GitHub" })
    ).toBeDefined()
  })

  it("focuses the verification code step and resets back to SSO", async () => {
    const user = userEvent.setup()
    const view = render(<LoginForm nextPath="/console" />)

    await user.type(view.getByLabelText("Email"), "user@example.com")
    await user.click(view.getByRole("button", { name: "Send login code" }))

    await waitFor(() => {
      expect(view.getByText("Enter verification code")).toBeDefined()
    })

    expect(view.queryByRole("button", { name: "Login with Google" })).toBeNull()
    expect(view.queryByRole("button", { name: "Login with GitHub" })).toBeNull()
    expect(document.activeElement).toBe(
      view.getByLabelText("Verification code digit 1")
    )
    expect(
      view.getByText("Check user@example.com for the 6-digit code.")
    ).toBeDefined()

    await user.click(view.getByRole("button", { name: "Back to SSO or email" }))

    expect(
      view.getByRole("button", { name: "Login with Google" })
    ).toBeDefined()
    expect(
      view.getByRole("button", { name: "Login with GitHub" })
    ).toBeDefined()
    expect(view.queryByLabelText("Verification code digit 1")).toBeNull()
    expect((view.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "user@example.com"
    )
  })

  it("submits the six-digit code and routes to nextPath", async () => {
    const user = userEvent.setup()
    const view = render(<LoginForm nextPath="/console" />)

    await user.type(view.getByLabelText("Email"), "user@example.com")
    await user.click(view.getByRole("button", { name: "Send login code" }))

    await waitFor(() => {
      expect(view.getByLabelText("Verification code digit 1")).toBeDefined()
    })

    for (let index = 0; index < 6; index++) {
      await user.type(
        view.getByLabelText(`Verification code digit ${index + 1}`),
        String(index + 1)
      )
    }

    await user.click(view.getByRole("button", { name: "Verify and login" }))

    await waitFor(() => {
      expect(mockVerifyMagicCode).toHaveBeenCalledWith({
        email: "user@example.com",
        code: "123456",
      })
    })
    expect(locationAssignMock).toHaveBeenCalledWith("/console")
    expect(routerPushMock).not.toHaveBeenCalled()
  })

  it("distributes pasted digits and blocks submit with an incomplete code", async () => {
    const user = userEvent.setup()
    const view = render(<LoginForm nextPath="/console" />)

    await user.type(view.getByLabelText("Email"), "user@example.com")
    await user.click(view.getByRole("button", { name: "Send login code" }))

    await waitFor(() => {
      expect(view.getByLabelText("Verification code digit 1")).toBeDefined()
    })

    const firstDigitInput = view.getByLabelText(
      "Verification code digit 1"
    ) as HTMLInputElement

    fireEvent.paste(firstDigitInput, {
      clipboardData: { getData: () => "12ab3456" },
    })

    await waitFor(() => {
      const values = Array.from(
        { length: 6 },
        (_, index) =>
          (
            view.getByLabelText(
              `Verification code digit ${index + 1}`
            ) as HTMLInputElement
          ).value
      )
      expect(values).toEqual(["1", "2", "3", "4", "5", "6"])
    })

    const sixthDigitInput = view.getByLabelText(
      "Verification code digit 6"
    ) as HTMLInputElement
    sixthDigitInput.focus()
    await user.keyboard("{Backspace}")

    await waitFor(() => {
      expect(sixthDigitInput.value).toBe("")
    })

    mockVerifyMagicCode.mockClear()
    await user.click(view.getByRole("button", { name: "Verify and login" }))

    await waitFor(() => {
      expect(
        view.getByText("Please fix the highlighted fields and try again.")
      ).toBeDefined()
    })
    expect(mockVerifyMagicCode).not.toHaveBeenCalled()
  })
})

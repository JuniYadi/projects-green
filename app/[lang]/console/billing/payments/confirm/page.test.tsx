import { describe, expect, it, mock, afterEach, beforeEach } from "bun:test"

// ─── Mock modules before any imports ─────────────────────────────────────────

mock.module("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en" })),
  useSearchParams: mock(() => ({
    get: (key: string) => {
      const params: Record<string, string> = {
        invoiceId: "inv-1",
        amount: "100000",
        currency: "IDR",
        paymentMethodId: "bank-2",
      }
      return params[key] ?? null
    },
  })),
}))

const mockBankAccounts = [
  {
    id: "bank-1",
    bankCode: "BCA",
    bankName: "Bank Central Asia",
    accountName: "PFN",
    accountNumber: "1234567890",
    isActive: true,
    isDefault: true,
  },
  {
    id: "bank-2",
    bankCode: "BRI",
    bankName: "Bank Rakyat Indonesia",
    accountName: "PFN2",
    accountNumber: "9876543210",
    isActive: true,
    isDefault: false,
  },
]

const mockPost = mock((_body?: unknown) =>
  Promise.resolve({ data: { ok: true } })
)

const originalFetch = globalThis.fetch

// ─── Dynamic imports after mocks ─────────────────────────────────────────────

const {
  render,
  waitFor,
  cleanup: rtlCleanup,
} = await import("@testing-library/react")
const { fireEvent } = await import("@testing-library/react")
const { default: ConfirmPaymentPage } = await import("./page")

beforeEach(() => {
  globalThis.fetch = mock(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("bank-accounts")) {
        return new Response(
          JSON.stringify({ ok: true, data: mockBankAccounts }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      }
      if (url.includes("confirm")) {
        const body = init?.body ? JSON.parse(String(init.body)) : {}
        mockPost(body)
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }
  ) as unknown as typeof fetch
})

afterEach(() => {
  rtlCleanup()
  mockPost.mockClear()
  globalThis.fetch = originalFetch
})

describe("ConfirmPaymentPage", () => {
  it("preselects bank-2 from paymentMethodId search param", async () => {
    const view = render(<ConfirmPaymentPage />)

    await waitFor(() => {
      const bank2Card = view.getByText("Bank Rakyat Indonesia")
      expect(bank2Card).toBeInTheDocument()
    })

    // The bank-2 card should be selected (has ring-1 ring-primary class)
    const bank2Button = view
      .getAllByRole("button", { name: /bank/i })
      .find((btn) => btn.textContent?.includes("Bank Rakyat Indonesia"))

    expect(bank2Button).toBeDefined()
    expect(bank2Button!.className).toContain("ring-1")
    expect(bank2Button!.className).toContain("ring-primary")
  })

  it("submit sends bankAccountId: bank-2 when paymentMethodId is bank-2", async () => {
    const view = render(<ConfirmPaymentPage />)

    await waitFor(() => {
      expect(view.getByText("Bank Rakyat Indonesia")).toBeInTheDocument()
    })

    const submitButton = view.getByRole("button", {
      name: /submit confirmation/i,
    })
    expect(submitButton).toBeEnabled()

    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled()
    })

    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({ bankAccountId: "bank-2" })
    )
  })

  it("submits overpaid transfer amount and displays notice", async () => {
    const view = render(<ConfirmPaymentPage />)

    await waitFor(() => {
      expect(view.getByText("Bank Rakyat Indonesia")).toBeInTheDocument()
    })

    const transferAmountInput = view.getByLabelText(
      /actual transferred amount/i
    )
    expect(transferAmountInput).toBeInTheDocument()

    fireEvent.change(transferAmountInput, { target: { value: "305000" } })

    expect(
      view.getByText(/Overpayment will be automatically credited/i)
    ).toBeInTheDocument()

    const submitButton = view.getByRole("button", {
      name: /submit confirmation/i,
    })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({
          bankAccountId: "bank-2",
          amount: 305000,
        })
      )
    })
  })
})

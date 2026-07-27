import { describe, expect, it, mock, afterEach } from "bun:test"

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

const mockPost = mock(() => Promise.resolve({ data: { ok: true } }))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      payments: {
        topup: {
          "bank-accounts": {
            get: mock(() =>
              Promise.resolve({
                data: { ok: true, data: mockBankAccounts },
              })
            ),
          },
          confirm: {
            "inv-1": {
              post: mockPost,
            },
          },
        },
      },
    },
  },
}))

// ─── Dynamic imports after mocks ─────────────────────────────────────────────

const {
  render,
  waitFor,
  cleanup: rtlCleanup,
} = await import("@testing-library/react")
const { fireEvent } = await import("@testing-library/react")
const { default: ConfirmPaymentPage } = await import("./page")

afterEach(() => {
  rtlCleanup()
  mockPost.mockClear()
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
})

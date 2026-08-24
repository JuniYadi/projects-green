import "@/test/register"

import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const post = mock(async (_payload: unknown) => ({
  data: { ok: true, data: { id: "created-voucher" } },
}))
const getCatalog = mock(async () => ({
  currency: "IDR",
  products: [
    {
      code: "VPN",
      name: "VPN",
      description: null,
      isActive: true,
      plans: [],
    },
  ],
}))
const push = mock()

mock.module("@/lib/eden", () => ({
  eden: { api: { vouchers: { portal: { post } } } },
}))

mock.module("@/lib/billing-client", () => ({
  getCatalog,
  voucherKindLabel: (kind: string) =>
    kind === "BALANCE_CREDIT" ? "Balance Credit" : "Product Promotion",
  voucherDiscountTypeLabel: (type: string) =>
    type === "PERCENTAGE" ? "Percentage" : "Fixed Amount",
  voucherCurrencyPolicyLabel: (policy: string) => policy,
}))

mock.module("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

const { default: NewVoucherPage } = await import("./page")

describe("NewVoucherPage", () => {
  beforeEach(() => {
    post.mockClear()
    post.mockImplementation(async () => ({
      data: { ok: true, data: { id: "created-voucher" } },
    }))
    getCatalog.mockClear()
    getCatalog.mockImplementation(async () => ({
      currency: "IDR",
      products: [
        {
          code: "VPN",
          name: "VPN",
          description: null,
          isActive: true,
          plans: [],
        },
      ],
    }))
    push.mockClear()
  })

  it("renders the promotion form and allows switching between tabs", async () => {
    const user = userEvent.setup()
    const view = render(<NewVoucherPage />)

    const toggleItems = view.container.querySelectorAll(
      '[data-slot="toggle-group-item"]'
    )
    await user.click(toggleItems[1]!) // Product Promotion

    const discountValueInput = await view.findByLabelText("Discount Value")
    await user.type(discountValueInput, "15")

    const saveBtn = view.getAllByRole("button", { name: "Save Draft" })[0]!
    expect(saveBtn).toBeInTheDocument()
  })

  it("supports Prefix code generation mode", async () => {
    const user = userEvent.setup()
    const view = render(<NewVoucherPage />)

    await user.click(view.getByLabelText(/2\. Prefix \+ Random/))
    const prefixInput = await view.findByLabelText(/Prefix Code/)
    await user.type(prefixInput, "PMI")

    const amountInput = view.getByLabelText("Credit Amount")
    await user.clear(amountInput)
    await user.type(amountInput, "50000")

    const saveBtn = view.getAllByRole("button", { name: "Save Draft" })[0]!
    await user.click(saveBtn)

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    const payload = post.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload).toMatchObject({
      kind: "BALANCE_CREDIT",
      status: "DISABLED",
      prefix: "PMI",
      amount: 50000,
    })
    expect(payload.code).toBeUndefined()
  })

  it("supports Static Custom Code generation mode", async () => {
    const user = userEvent.setup()
    const view = render(<NewVoucherPage />)

    await user.click(view.getByLabelText(/3\. Static Custom Code/))
    const customCodeInput = await view.findByLabelText(/Custom Exact Code/)
    await user.type(customCodeInput, "DISCOUNT100")

    const amountInput = view.getByLabelText("Credit Amount")
    await user.clear(amountInput)
    await user.type(amountInput, "100000")

    const saveBtn = view.getAllByRole("button", { name: "Save Draft" })[0]!
    await user.click(saveBtn)

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    const payload = post.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload).toMatchObject({
      kind: "BALANCE_CREDIT",
      status: "DISABLED",
      code: "DISCOUNT100",
      amount: 100000,
    })
    expect(payload.prefix).toBeUndefined()
  })
})

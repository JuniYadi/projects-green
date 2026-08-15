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

const futureDateTimeLocal = () => {
  const date = new Date(Date.now() + 3600000)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

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

  it("posts product restrictions without fallback balance fields as a draft", async () => {
    const user = userEvent.setup()
    const view = render(<NewVoucherPage />)

    await user.click(view.getByRole("radio", { name: /Product Promotion/ }))
    await user.click(view.getByLabelText("Discount Type"))
    await user.click(
      await view.findByRole("option", { name: "Percentage (%)" })
    )
    await user.type(view.getByLabelText("Discount Value"), "15")
    await user.click(view.getByRole("button", { name: "Rules" }))

    const checkboxes = await view.findAllByRole("checkbox")
    await user.click(checkboxes[0]!)
    await user.click(checkboxes[1]!)
    await user.type(
      view.getByLabelText("Expiration date and time"),
      futureDateTimeLocal()
    )
    await user.click(view.getAllByRole("button", { name: "Save Draft" })[0]!)

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    const payload = post.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload).toMatchObject({
      kind: "PRODUCT_PROMOTION",
      status: "DISABLED",
      discountType: "PERCENTAGE",
      discountValue: 15,
      allowedPackageCodes: ["VPN"],
      allowedBillingPeriods: ["MONTHLY"],
    })
    expect(payload).not.toHaveProperty("amount")
    expect(payload).not.toHaveProperty("currency")
    expect(payload).not.toHaveProperty("discountCurrency")
    expect(payload).not.toHaveProperty("minimumOrderAmount")
    expect(payload).not.toHaveProperty("maximumDiscountAmount")
  })
})

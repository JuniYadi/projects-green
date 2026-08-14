import { beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render } from "@testing-library/react"
import type {
  CatalogListResponse,
  VoucherDetailDTO,
} from "@/lib/billing-client"

const catalog: CatalogListResponse = {
  currency: "IDR",
  products: [
    {
      code: "VPN",
      name: "VPN",
      description: "Virtual private network",
      isActive: true,
      plans: [
        {
          id: "plan-1",
          code: "VPN_PRO",
          name: "VPN Pro",
          resources: {},
          offers: [
            {
              id: "offer-1",
              billingPeriod: "MONTHLY",
              periodMonths: 1,
              periodPrice: "100000",
              currency: "IDR",
              chargeUnit: "SUBSCRIPTION",
              effectiveFrom: new Date().toISOString(),
              effectiveTo: null,
            },
          ],
        },
      ],
    },
  ],
}

const getCatalog = mock(async () => catalog)

mock.module("@/lib/billing-client", () => ({
  getCatalog,
  voucherKindLabel: (kind: string) =>
    kind === "BALANCE_CREDIT" ? "Balance Credit" : "Product Promotion",
  voucherDiscountTypeLabel: (type: string) =>
    type === "PERCENTAGE" ? "Percentage" : "Fixed Amount",
  voucherCurrencyPolicyLabel: (policy: string) => policy,
}))

const { VoucherPublishTab, validateForPublish } =
  await import("./voucher-publish-tab")
const { VoucherRulesTab } = await import("./voucher-rules-tab")
const { VoucherTypeTab } = await import("./voucher-type-tab")

const futureExpiry = new Date(Date.now() + 3600000).toISOString()

const createVoucher = (
  overrides: Partial<VoucherDetailDTO> = {}
): VoucherDetailDTO => ({
  id: "new",
  code: "PROMO-XXXX",
  prefix: null,
  status: "DISABLED",
  kind: "BALANCE_CREDIT",
  discountType: null,
  discountValue: null,
  discountCurrency: null,
  currencyPolicy: "MATCH_CURRENCY_ONLY",
  firstCheckoutOnly: false,
  allowUpgrade: false,
  stackable: false,
  minimumOrderAmount: null,
  maximumDiscountAmount: null,
  maxClaims: 1,
  claimedCount: 0,
  expiresAt: futureExpiry,
  amount: "100",
  currency: "IDR",
  targetWorkosUserId: null,
  targetOrganizationId: null,
  allowedPackageCodes: null,
  allowedPlanCodes: null,
  allowedBillingPeriods: null,
  metadataJson: null,
  createdByWorkosUserId: "",
  createdAt: futureExpiry,
  updatedAt: futureExpiry,
  claims: [],
  ...overrides,
})

describe("promotion creation tabs", () => {
  beforeEach(() => {
    getCatalog.mockClear()
    getCatalog.mockImplementation(async () => catalog)
  })

  it("uses equal responsive kind cards and hides balance controls for products", () => {
    const view = render(
      <VoucherTypeTab
        voucher={createVoucher({
          kind: "PRODUCT_PROMOTION",
          discountType: "PERCENTAGE",
          discountValue: "15",
        })}
        onUpdate={mock()}
      />
    )

    const chooser = view.container.querySelector('[data-slot="toggle-group"]')
    expect(chooser).toHaveClass("grid", "sm:grid-cols-2")
    expect(view.queryByLabelText("Credit Amount")).toBeNull()
    expect(view.getByLabelText("Discount Value")).toBeInTheDocument()
  })

  it("shows the balance amount and currency controls only for balance credit", () => {
    const view = render(
      <VoucherTypeTab voucher={createVoucher()} onUpdate={mock()} />
    )

    expect(view.getByLabelText("Credit Amount")).toBeInTheDocument()
    expect(view.getByLabelText("Currency")).toBeInTheDocument()
    expect(view.queryByLabelText("Discount Value")).toBeNull()
  })

  it("loads catalog-backed product and billing-period selectors with expiry", async () => {
    const view = render(
      <VoucherRulesTab
        voucher={createVoucher({
          kind: "PRODUCT_PROMOTION",
          discountType: "PERCENTAGE",
          discountValue: "15",
          expiresAt: "",
        })}
        onUpdate={mock()}
        isNew
      />
    )

    expect(getCatalog).toHaveBeenCalledTimes(1)
    expect(await view.findByText("VPN Pro")).toBeInTheDocument()
    expect(await view.findByText("Monthly")).toBeInTheDocument()
    expect(view.getByLabelText("Expiration date and time")).toHaveAttribute(
      "type",
      "datetime-local"
    )
  })

  it("blocks product publishing without eligibility, billing periods, or expiry", () => {
    const view = render(
      <VoucherPublishTab
        voucher={createVoucher({
          kind: "PRODUCT_PROMOTION",
          discountType: "PERCENTAGE",
          discountValue: "15",
          expiresAt: "",
        })}
        onUpdate={mock()}
        onSaveDraft={mock()}
        onPublish={mock()}
        isSaving={false}
      />
    )

    expect(
      view.getByRole("button", { name: "Fix errors to publish" })
    ).toBeDisabled()
    expect(view.getByText(/eligible product or plan/i)).toBeInTheDocument()
    expect(
      view.getByText(/expiration date must be in the future/i)
    ).toBeInTheDocument()
  })

  it("validates both kinds before publish and exposes the selected status", () => {
    const balance = validateForPublish(createVoucher())
    expect(balance.errors).toEqual([])

    const product = validateForPublish(
      createVoucher({
        kind: "PRODUCT_PROMOTION",
        discountType: "PERCENTAGE",
        discountValue: "15",
        allowedPackageCodes: ["VPN"],
        allowedBillingPeriods: ["MONTHLY"],
      })
    )
    expect(product.errors).toEqual([])

    const existingUnrestricted = validateForPublish(
      createVoucher({
        id: "existing-voucher",
        kind: "PRODUCT_PROMOTION",
        discountType: "PERCENTAGE",
        discountValue: "15",
      })
    )
    expect(existingUnrestricted.errors).toEqual([])

    const onUpdate = mock()
    const view = render(
      <VoucherPublishTab
        voucher={createVoucher()}
        onUpdate={onUpdate}
        onSaveDraft={mock()}
        onPublish={mock()}
        isSaving={false}
      />
    )

    fireEvent.click(view.getByRole("radio", { name: /publish now/i }))
    expect(onUpdate).toHaveBeenCalledWith({ status: "ACTIVE" })
  })
})

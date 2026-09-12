import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render } from "@testing-library/react"

const mockGetProduct = mock(() =>
  Promise.resolve({
    product: {
      code: "WHATSAPP",
      name: "WhatsApp",
      description: "WhatsApp Business messaging",
      isActive: true,
      plans: [
        {
          id: "plan-private",
          code: "PRIVATE",
          name: "Private Business",
          resources: {
            quota: 1000,
            dailyMessage: 1000,
          },
          billingStrategy: "FIXED_CYCLE" as const,
          stockControl: "UNLIMITED" as const,
          stockCount: null,
          allowBackorder: false,
          isActive: true,
          offers: [
            {
              id: "offer-monthly",
              billingPeriod: "MONTHLY" as const,
              periodMonths: 1 as const,
              periodPrice: "1000000",
              currency: "IDR",
              chargeUnit: "SUBSCRIPTION" as const,
              effectiveFrom: "2026-01-01T00:00:00.000Z",
              effectiveTo: null,
              regionId: "region-global",
              regionCode: "GLOBAL",
              regionName: "Global",
              regionFlag: "🌐",
            },
          ],
        },
      ],
    },
    currency: "IDR",
  })
)

mock.module("@/modules/billing/catalog/catalog.service", () => ({
  CatalogService: class {
    getProduct = mockGetProduct
  },
}))

const { default: WhatsAppOfficialPage } = await import("./page")

describe("WhatsApp official product page", () => {
  beforeEach(() => {
    cleanup()
    mockGetProduct.mockClear()
  })

  it("renders active package resources and catalog pricing", async () => {
    const view = render(await WhatsAppOfficialPage())

    expect(
      view.getByRole("heading", {
        level: 1,
        name: "WhatsApp for businesses that need to stay connected.",
      })
    ).toBeInTheDocument()
    expect(
      view.getByRole("heading", { level: 3, name: "Private Business" })
    ).toBeInTheDocument()
    expect(view.getByText("Quota")).toBeInTheDocument()
    expect(view.getByText("Daily Message")).toBeInTheDocument()
    expect(view.getByText("IDR 1.000.000,00")).toBeInTheDocument()
    expect(
      view.getByRole("link", { name: "Start with this plan" })
    ).toHaveAttribute("href", "/login/start?intent=signup")
  })
})

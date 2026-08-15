import { beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { AdminCatalogProductDetailResponse } from "@/lib/billing-client"

const mockPush = mock()
const mockGetAdminCatalogProduct = mock<
  () => Promise<AdminCatalogProductDetailResponse>
>(async () => ({
  product: {
    code: "VPN",
    name: "VPN",
    description: "VPN service",
    isActive: true,
    plans: [],
  },
  currency: "IDR",
}))
const mockPublishCatalogProduct = mock(async () => ({ ok: true, data: {} }))
const mockSearchParams = {
  get: mock<(key: string) => string | null>(() => null),
  toString: () => "",
}

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
  useParams: () => ({ lang: "en" }),
}))
mock.module("@/lib/billing-client", () => ({
  getAdminCatalogProduct: mockGetAdminCatalogProduct,
  publishCatalogProduct: mockPublishCatalogProduct,
  billingPeriodLabel: (period: string) => period,
}))

const { ProductEditor } = await import("./product-editor")

describe("ProductEditor", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    mockGetAdminCatalogProduct.mockResolvedValue({
      product: {
        code: "VPN",
        name: "VPN",
        description: "VPN service",
        isActive: true,
        plans: [],
      },
      currency: "IDR",
    })
    mockPublishCatalogProduct.mockResolvedValue({ ok: true, data: {} })
    localStorage.clear()
    mockSearchParams.get.mockReturnValue(null)
  })

  it("renders all five tabs for a new canonical product", async () => {
    const view = render(<ProductEditor productCode="APP_HOSTING" isNew />)

    await waitFor(() => expect(view.getByText("Product details")).toBeTruthy())
    expect(view.getAllByText("Basics").length).toBeGreaterThan(0)
    expect(view.getByText("Plans")).toBeTruthy()
    expect(view.getByText("Add-ons")).toBeTruthy()
    expect(view.getAllByText("Publish").length).toBeGreaterThan(0)
    expect(view.getByRole("button", { name: "Save draft" })).toBeTruthy()
  })

  it("loads an unpriced selected plan with a return path", async () => {
    mockGetAdminCatalogProduct.mockResolvedValue({
      product: {
        code: "VPN",
        name: "VPN",
        description: "VPN service",
        isActive: true,
        plans: [
          {
            id: "plan-vpn-package",
            code: "VPN_PACKAGE_ONE",
            name: "One",
            resources: {},
            isActive: true,
            offers: [],
          },
        ],
      },
      currency: "IDR",
    })
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "plan") return "plan-vpn-package"
      if (key === "returnTo") return "/en/portal/vpn/packages"
      if (key === "tab") return "plans"
      return null
    })

    const view = render(<ProductEditor productCode="VPN" isNew={false} />)

    await waitFor(() =>
      expect(view.getByText("Focused plan: One")).toBeTruthy()
    )
    expect(view.getByText("Selected from VPN package pricing")).toBeTruthy()
    expect(
      view.getByRole("link", { name: "Back to source package" })
    ).toHaveAttribute("href", "/en/portal/vpn/packages")
    expect(view.getByPlaceholderText("Required")).toBeTruthy()
  })

  it("persists a published product and clears its offline draft", async () => {
    const draftKey = "catalog-draft-APP_HOSTING"
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        basics: {
          code: "APP_HOSTING",
          name: "App Hosting",
          description: "App hosting product",
          currency: "IDR",
          enabledCurrencies: ["IDR"],
          isActive: true,
        },
        plans: [
          {
            id: "plan-1",
            code: "STANDARD",
            name: "Standard",
            resources: {},
            isActive: true,
            enabledTerms: ["MONTHLY"],
            offers: [
              {
                id: "offer-1",
                billingPeriod: "MONTHLY",
                periodPrice: "100",
                currency: "IDR",
                chargeUnit: "SUBSCRIPTION",
                effectiveFrom: "2025-01-01",
                effectiveTo: "",
                isActive: true,
              },
            ],
          },
        ],
        addons: [],
        publishState: "draft",
        preview: false,
      })
    )
    mockSearchParams.get.mockReturnValue("publish")

    const firstView = render(<ProductEditor productCode="APP_HOSTING" isNew />)
    await waitFor(() => expect(firstView.getByText("draft")).toBeTruthy())
    fireEvent.click(firstView.getByRole("button", { name: "Published" }))
    await waitFor(() => expect(firstView.getByText("published")).toBeTruthy())
    await waitFor(() =>
      expect(firstView.getByText("Unsaved changes")).toBeTruthy()
    )
    expect(
      firstView.getByRole("button", { name: "Publish" })
    ).not.toHaveAttribute("disabled")
    const publishTrigger = firstView.getByRole("button", { name: "Publish" })
    fireEvent.pointerDown(publishTrigger, { button: 0, pointerType: "mouse" })
    fireEvent.pointerUp(publishTrigger, { button: 0, pointerType: "mouse" })
    fireEvent.click(publishTrigger)
    expect(firstView.getByText("Publish product?")).toBeTruthy()
    const publishActions = firstView.getAllByRole("button", { name: "Publish" })
    const confirmPublish = publishActions.at(-1)!
    await userEvent.setup().click(confirmPublish)
    await waitFor(() => {
      expect(mockPublishCatalogProduct).toHaveBeenCalled()
    })
    expect(localStorage.getItem(draftKey)).toBeNull()
  })
  it("keeps Publish disabled when required Basics fields are blank", async () => {
    localStorage.setItem(
      "catalog-draft-APP_HOSTING",
      JSON.stringify({
        basics: {
          code: "APP_HOSTING",
          name: "",
          description: "",
          currency: "IDR",
          enabledCurrencies: ["IDR"],
          isActive: true,
        },
        plans: [
          {
            id: "plan-1",
            code: "STANDARD",
            name: "Standard",
            resources: {},
            isActive: true,
            enabledTerms: ["MONTHLY"],
            offers: [
              {
                id: "offer-1",
                billingPeriod: "MONTHLY",
                periodPrice: "100",
                currency: "IDR",
                chargeUnit: "SUBSCRIPTION",
                effectiveFrom: "2025-01-01",
                effectiveTo: "",
                isActive: true,
              },
            ],
          },
        ],
        addons: [],
        publishState: "draft",
        preview: false,
      })
    )
    mockSearchParams.get.mockReturnValue("publish")

    const view = render(<ProductEditor productCode="APP_HOSTING" isNew />)
    await waitFor(() => expect(view.getByText("draft")).toBeTruthy())
    fireEvent.click(view.getByRole("button", { name: "Published" }))
    await waitFor(() => expect(view.getByText("published")).toBeTruthy())
    await waitFor(() => expect(view.getByText("Unsaved changes")).toBeTruthy())

    const publishTrigger = view.getByRole("button", { name: "Publish" })
    expect(publishTrigger.hasAttribute("disabled")).toBe(true)
    fireEvent.click(publishTrigger)
    expect(view.queryByText("Publish product?")).toBeNull()
  })
})

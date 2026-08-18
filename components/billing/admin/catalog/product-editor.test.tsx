import { beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockPush = mock()
const mockPublishCatalogProduct = mock(async () => ({ ok: true, data: {} }))
const mockGetAdminCatalogProduct = mock()
const mockGetCatalogProduct = mock()
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
  getCatalogProduct: mockGetCatalogProduct,
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
        description: "VPN product",
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

  it("loads an unpriced VPN plan and marks the selected plan with a return link", async () => {
    mockSearchParams.get.mockImplementation(
      (key: string) =>
        ({
          planId: "plan-vpn-package",
          returnTo: "/en/portal/vpn/packages",
        })[key] ?? null
    )
    mockGetAdminCatalogProduct.mockResolvedValue({
      product: {
        code: "VPN",
        name: "VPN",
        description: "VPN product",
        isActive: true,
        plans: [
          {
            id: "plan-vpn-package",
            code: "VPN_PACKAGE_1",
            name: "Business VPN",
            resources: {},
            offers: [],
          },
        ],
      },
      currency: "IDR",
    })

    const view = render(<ProductEditor productCode="VPN" isNew={false} />)

    await waitFor(() =>
      expect(view.getByText("Selected from VPN package")).toBeTruthy()
    )
    expect(view.getByText("Back to VPN packages")).toHaveAttribute(
      "href",
      "/en/portal/vpn/packages"
    )
    expect(view.getByText(/Pricing required/)).toBeTruthy()
    expect(
      view.container.querySelector('input[aria-label="IDR MONTHLY price"]')
    ).toBeTruthy()
  })

  it("disables draft save when a plan identity is incomplete", async () => {
    localStorage.setItem(
      "catalog-draft-VPN",
      JSON.stringify({
        basics: {
          code: "VPN",
          name: "VPN",
          description: "VPN product",
          currency: "IDR",
          enabledCurrencies: ["IDR"],
          isActive: true,
        },
        plans: [
          {
            id: "plan-incomplete",
            code: "",
            name: "",
            resources: {},
            isActive: true,
            enabledTerms: ["MONTHLY"],
            offers: [],
          },
        ],
        addons: [],
        publishState: "draft",
        preview: false,
      })
    )
    mockSearchParams.get.mockReturnValue("plans")

    const view = render(<ProductEditor productCode="VPN" isNew />)

    await waitFor(() =>
      expect(view.getByText("Name is required.")).toBeTruthy()
    )
    expect(view.getByText("Code is required.")).toBeTruthy()
    expect(view.getByRole("button", { name: "Save draft" })).toBeDisabled()
    expect(mockPublishCatalogProduct).not.toHaveBeenCalled()
  })

  it("saves a custom plan identity and reloads it in the Plans tab", async () => {
    localStorage.setItem(
      "catalog-draft-VPN",
      JSON.stringify({
        basics: {
          code: "VPN",
          name: "VPN",
          description: "VPN product",
          currency: "IDR",
          enabledCurrencies: ["IDR"],
          isActive: true,
        },
        plans: [
          {
            id: "plan-private",
            code: "PRIVATE",
            name: "Private",
            resources: {},
            isActive: true,
            enabledTerms: ["MONTHLY"],
            offers: [],
          },
        ],
        addons: [],
        publishState: "draft",
        preview: false,
      })
    )
    mockSearchParams.get.mockReturnValue("plans")

    const firstView = render(<ProductEditor productCode="VPN" isNew />)

    await waitFor(() =>
      expect(firstView.getByDisplayValue("Private")).toBeTruthy()
    )
    fireEvent.click(firstView.getByRole("button", { name: "Save draft" }))

    await waitFor(() => {
      expect(mockPublishCatalogProduct).toHaveBeenCalledWith(
        "VPN",
        expect.objectContaining({
          plans: [
            expect.objectContaining({ code: "PRIVATE", name: "Private" }),
          ],
        })
      )
    })
    firstView.unmount()

    mockGetAdminCatalogProduct.mockResolvedValue({
      product: {
        code: "VPN",
        name: "VPN",
        description: "VPN product",
        isActive: true,
        plans: [
          {
            id: "plan-private",
            code: "PRIVATE",
            name: "Private",
            resources: {},
            offers: [],
          },
        ],
      },
      currency: "IDR",
    })

    const reloadedView = render(
      <ProductEditor productCode="VPN" isNew={false} />
    )

    await waitFor(() => {
      expect(reloadedView.getByText("Private")).toBeTruthy()
      expect(reloadedView.getByDisplayValue("PRIVATE")).toBeTruthy()
    })
  })
})

import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

const mockToastSuccess = mock()
const mockToastError = mock()

mock.module("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}))

const { SubscriptionManager } = await import("./subscription-manager")

const baseSubscription = {
  id: "sub_1",
  packageCode: "starter",
  planCode: "STANDARD",
  regionCode: "ID",
  billingMode: "PACKAGE",
  type: "APP_HOSTING",
  status: "ACTIVE",
  allocatedConfig: null,
  monthlyRateIdr: "150000",
  currentPeriodEnd: null,
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  })

const fetchMock = mock<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
>(async () => jsonResponse({ ok: true }))

describe("SubscriptionManager", () => {
  beforeEach(() => {
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    delete (globalThis as { fetch?: unknown }).fetch
  })

  it("renders the empty state when no subscriptions are provided", () => {
    const view = render(<SubscriptionManager subscriptions={[]} />)
    expect(view.getByText("No active subscriptions")).toBeTruthy()
  })

  it("renders app hosting plan, region, billing mode, and price", () => {
    const view = render(
      <SubscriptionManager
        subscriptions={[{ ...baseSubscription, regionCode: "ID" }]}
      />
    )

    expect(view.getByText("IDR 150.000,00/mo")).toBeTruthy()
    expect(view.getAllByText("Plan").length).toBeGreaterThan(0)
    expect(view.getByText("Billing Mode")).toBeTruthy()
    expect(view.getByText("Package: starter | Region: ID")).toBeTruthy()
  })

  it("renders CPU and Memory sliders for PAYG app hosting", () => {
    const view = render(
      <SubscriptionManager
        subscriptions={[
          {
            ...baseSubscription,
            billingMode: "PAYG",
            allocatedConfig: { cpu: 500, memory: 1024 },
          },
        ]}
      />
    )

    expect(view.getByText("CPU")).toBeTruthy()
    expect(view.getByText("Memory")).toBeTruthy()
  })

  it("renders VPN region and status controls", () => {
    const view = render(
      <SubscriptionManager
        subscriptions={[
          {
            ...baseSubscription,
            type: "VPN",
            regionCode: "ID",
            billingMode: "MONTHLY",
            monthlyRateIdr: "0",
          },
        ]}
      />
    )

    expect(view.getByText("Region")).toBeTruthy()
    expect(view.getByText("Status")).toBeTruthy()
  })

  it("renders WhatsApp quota text when quota fields are provided", () => {
    const view = render(
      <SubscriptionManager
        subscriptions={[
          {
            ...baseSubscription,
            type: "WHATSAPP",
            planCode: "LITE",
            billingMode: "MONTHLY",
            monthlyRateIdr: "0",
            quotaIn: 1000,
            quotaOut: 2000,
            dailyPerDevice: 50,
          },
        ]}
      />
    )

    expect(view.getAllByText("Plan").length).toBeGreaterThan(0)
    expect(view.getByText(/Quota: 1000 in \/ 2000 out per month/)).toBeTruthy()
    expect(view.getByText("Daily per device: 50")).toBeTruthy()
  })

  it("hides WhatsApp quota text when quota fields are missing", () => {
    const view = render(
      <SubscriptionManager
        subscriptions={[
          {
            ...baseSubscription,
            type: "WHATSAPP",
            planCode: "LITE",
            billingMode: "MONTHLY",
            monthlyRateIdr: "0",
            quotaIn: null,
            quotaOut: null,
            dailyPerDevice: null,
          },
        ]}
      />
    )

    expect(view.queryByText(/Quota: /)).toBeNull()
  })

  it("calls the PATCH endpoint and toasts success after an update", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    const view = render(
      <SubscriptionManager subscriptions={[baseSubscription]} />
    )

    // Open the Plan select dropdown and pick a new plan
    const planTrigger = view.container.querySelector(
      "[data-slot=select-trigger]"
    ) as HTMLElement | null
    expect(planTrigger).toBeTruthy()
    fireEvent.pointerDown(planTrigger!, { button: 0, pointerType: "mouse" })
    const customOption = await waitFor(() => {
      const option = view.getByText("Custom") as HTMLElement
      expect(option).toBeTruthy()
      return option
    })
    fireEvent.pointerUp(customOption, { button: 0, pointerType: "mouse" })
    fireEvent.click(customOption)

    const updateButton = await waitFor(() =>
      view.getByRole("button", { name: "Update Subscription" })
    )
    fireEvent.click(updateButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Subscription updated successfully"
    )
  })

  it("toasts the failure message when the PATCH endpoint returns an error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: false, message: "Nope" }, 400)
    )

    const view = render(
      <SubscriptionManager subscriptions={[baseSubscription]} />
    )

    const planTrigger = view.container.querySelector(
      "[data-slot=select-trigger]"
    ) as HTMLElement | null
    expect(planTrigger).toBeTruthy()
    fireEvent.pointerDown(planTrigger!, { button: 0, pointerType: "mouse" })
    const customOption = await waitFor(() => {
      const option = view.getByText("Custom") as HTMLElement
      expect(option).toBeTruthy()
      return option
    })
    fireEvent.pointerUp(customOption, { button: 0, pointerType: "mouse" })
    fireEvent.click(customOption)

    const updateButton = await waitFor(() =>
      view.getByRole("button", { name: "Update Subscription" })
    )
    fireEvent.click(updateButton)

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Nope"))
  })
})

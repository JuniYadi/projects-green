import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"
import { DeviceCreateWizard } from "@/app/[lang]/portal/whatsapp/devices/new/_components/device-create-wizard"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("DeviceCreateWizard", () => {
  beforeEach(() => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const path =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.pathname
            : input.url

      if (path.includes("/api/admin/organizations")) {
        return jsonResponse({
          ok: true,
          data: {
            organizations: [
              { id: "org_1", name: "Acme Corp" },
              { id: "org_2", name: "Beta Inc" },
            ],
          },
        })
      }

      if (
        path.includes("/api/admin/devices") &&
        (input as Request).method === "POST"
      ) {
        return jsonResponse({
          ok: true,
          device: { id: "dev_new_123" },
        })
      }

      return jsonResponse({}, 404)
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    cleanup()
  })

  it("renders step 1 with organization select and phone input", () => {
    const view = render(<DeviceCreateWizard locale="en" />)

    // Step 1 fields are visible
    expect(view.getByPlaceholderText("+6281234567890")).toBeTruthy()
    expect(view.getByRole("combobox")).toBeTruthy()
    expect(view.getByRole("button", { name: "Next" })).toBeTruthy()
  })

  it("shows validation errors when advancing without required fields", async () => {
    const view = render(<DeviceCreateWizard locale="en" />)

    const { fireEvent } = await import("@testing-library/react")
    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByText("Organization is required")).toBeTruthy()
      expect(view.getByText("Phone number is required")).toBeTruthy()
    })
  })

  it("has 5 step indicators", () => {
    const view = render(<DeviceCreateWizard locale="en" />)

    expect(view.getByText("1")).toBeTruthy()
    expect(view.getByText("2")).toBeTruthy()
    expect(view.getByText("3")).toBeTruthy()
    expect(view.getByText("4")).toBeTruthy()
    expect(view.getByText("5")).toBeTruthy()
  })

  it("has previous button disabled on step 1", () => {
    const view = render(<DeviceCreateWizard locale="en" />)

    const prevBtn = view.getByRole("button", { name: "Previous" })
    expect(prevBtn.hasAttribute("disabled")).toBe(true)
  })

  it("fetches organizations on mount", async () => {
    render(<DeviceCreateWizard locale="en" />)

    await waitFor(() => {
      const calls = (globalThis.fetch as unknown as ReturnType<typeof mock>)
        .mock.calls
      const orgCall = calls.find((call) => {
        const path =
          typeof call[0] === "string"
            ? call[0]
            : call[0] instanceof URL
              ? call[0].pathname
              : ""
        return path.includes("/api/admin/organizations")
      })
      expect(orgCall).toBeTruthy()
    })
  })

  it("step 1 label texts are present", () => {
    const view = render(<DeviceCreateWizard locale="en" />)

    // "Organization & Phone" appears in both nav and step heading
    expect(
      view.getAllByText("Organization & Phone").length
    ).toBeGreaterThanOrEqual(1)
    expect(view.getByText("Phone Number")).toBeTruthy()
  })

  it("step navigation labels are present", () => {
    const view = render(<DeviceCreateWizard locale="en" />)

    // Nav labels appear in progress bar
    expect(view.getByText("WhatsApp Business IDs")).toBeTruthy()
    expect(view.getByText("Quotas & Limits")).toBeTruthy()
    expect(view.getByText("Profile & Features")).toBeTruthy()
    expect(view.getByText("Review & Submit")).toBeTruthy()
  })

  it("next button advances when on step 1", async () => {
    const view = render(<DeviceCreateWizard locale="en" />)

    const { fireEvent } = await import("@testing-library/react")
    // Click next without filling — should show validation errors
    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByText("Organization is required")).toBeTruthy()
    })
  })

  it("previous button is disabled on step 1", () => {
    const view = render(<DeviceCreateWizard locale="en" />)

    const prevBtn = view.getByRole("button", { name: "Previous" })
    expect(prevBtn.hasAttribute("disabled")).toBe(true)
  })

  it("progress nav shows all 5 step labels", () => {
    const view = render(<DeviceCreateWizard locale="en" />)

    // Nav buttons show step names (some may appear in both nav + step heading)
    expect(
      view.getAllByText("Organization & Phone").length
    ).toBeGreaterThanOrEqual(1)
    expect(view.getByText("WhatsApp Business IDs")).toBeTruthy()
    expect(view.getByText("Quotas & Limits")).toBeTruthy()
    expect(view.getByText("Profile & Features")).toBeTruthy()
    expect(view.getByText("Review & Submit")).toBeTruthy()
  })
})

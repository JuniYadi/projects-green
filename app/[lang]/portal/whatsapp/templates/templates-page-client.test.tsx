import "@/test/register"
import { describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"

const routerPush = mock()
let currentSearchParams = new URLSearchParams()
mock.module("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  usePathname: () => "/portal/whatsapp/templates",
  useSearchParams: () => currentSearchParams,
  useParams: () => ({ lang: "en" }),
}))
const mockPullTemplates = mock(async (_deviceId: string) => ({
  ok: true,
  syncedCount: 3,
  totalMetaCount: 3,
}))

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    devices: {
      pullTemplates: mockPullTemplates,
    },
  },
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        organizations: {
          get: mock(async () => ({
            data: { ok: true, data: { organizations: [] } },
          })),
        },
      },
      whatsapp: {
        devices: {
          get: mock(async () => ({
            data: {
              ok: true,
              devices: [
                {
                  id: "dev-1",
                  phoneNumber: "+628123456789",
                  name: "Main Device",
                },
              ],
            },
          })),
        },
        templates: {
          get: mock(async () => ({
            data: {
              ok: true,
              data: [
                {
                  id: "tpl-1",
                  name: "Order Confirmation",
                  slug: "order_confirmation",
                  whatsappDeviceId: "dev-1",
                  syncStatus: "SYNCED",
                  metaStatus: "APPROVED",
                  category: "UTILITY",
                  device: {
                    id: "dev-1",
                    phoneNumber: "+628123456789",
                    status: "ACTIVE",
                  },
                },
              ],
            },
          })),
        },
      },
    },
  },
}))
const { TemplatesPageClient } = await import("./templates-page-client")

describe("TemplatesPageClient (Portal)", () => {
  it("renders filter bar and disables pull button when no device is selected", async () => {
    currentSearchParams = new URLSearchParams()
    const view = render(<TemplatesPageClient isSuperAdmin={false} />)

    const syncButton = view.getByRole("button", { name: /pull from meta/i })
    expect(syncButton).toBeDisabled()

    await waitFor(() => {
      expect(view.getByText("Order Confirmation")).toBeInTheDocument()
      expect(view.getByText("order_confirmation")).toBeInTheDocument()
      expect(view.getAllByText(/Main Device/).length).toBeGreaterThanOrEqual(1)
      expect(view.getByText("UTILITY")).toBeInTheDocument()
      expect(view.getByText("Approved")).toBeInTheDocument()
    })
    cleanup()
  })

  it("enables pull button and triggers pull when a specific device is selected", async () => {
    mockPullTemplates.mockClear()
    currentSearchParams = new URLSearchParams("whatsappDeviceId=dev-1")
    const view = render(<TemplatesPageClient isSuperAdmin={false} />)

    await waitFor(() => {
      expect(view.getByText("Order Confirmation")).toBeInTheDocument()
      expect(
        view.getByRole("button", { name: /pull from meta/i })
      ).not.toBeDisabled()
    })

    const syncButton = view.getByRole("button", { name: /pull from meta/i })
    fireEvent.click(syncButton)

    await waitFor(() => {
      expect(mockPullTemplates).toHaveBeenCalledWith("dev-1")
    })
    cleanup()
  })

  it("navigates to create template page when clicking Create Template", async () => {
    routerPush.mockClear()
    currentSearchParams = new URLSearchParams()
    const view = render(<TemplatesPageClient isSuperAdmin={false} />)

    const createBtn = view.getByRole("button", { name: /create template/i })
    fireEvent.click(createBtn)

    expect(routerPush).toHaveBeenCalledWith("/portal/whatsapp/templates/new")
    cleanup()
  })
})

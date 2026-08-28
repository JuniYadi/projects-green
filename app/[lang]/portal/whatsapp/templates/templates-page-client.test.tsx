import "@/test/register"
import { beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
const routerPush = mock(() => {})
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
                  verifiedName: "Main Device",
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

const mockUseTemplates = mock(() => ({
  templates: [
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
  loading: false,
  error: null,
  reload: mock(() => Promise.resolve()),
}))

const mockCreate = mock(() => Promise.resolve({ id: "tpl-123" }))

mock.module("@/modules/whatsapp/templates/api/templates.hooks", () => ({
  useTemplates: mockUseTemplates,
  useTemplate: (id: string) => ({
    template: id
      ? {
          id: "tpl-src",
          name: "Source Template",
          slug: "source_template",
          description: "A source template",
          category: "MARKETING",
          languages: [
            {
              id: "lang-1",
              lang: "en_US",
              headerType: "NONE",
              headerText: "",
              headerUrl: "",
              body: "Hello {{1}}",
              footer: "Footer text",
              parameters: [],
              buttons: [],
            },
          ],
        }
      : null,
    loading: false,
    error: null,
  }),
  useCreateTemplate: () => ({
    create: mockCreate,
    creating: false,
    error: null,
  }),
  useUpdateTemplate: () => ({
    update: mock(() => Promise.resolve()),
    updating: false,
    error: null,
  }),
  useDeleteTemplate: () => ({
    remove: mock(() => Promise.resolve()),
    deleting: false,
    error: null,
  }),
  useSyncTemplate: () => ({
    sync: mock(() => Promise.resolve({ ok: true })),
    syncing: false,
    error: null,
  }),
}))

const { TemplatesPageClient } = await import("./templates-page-client")

describe("TemplatesPageClient (Portal)", () => {
  beforeEach(() => {
    cleanup()
    routerPush.mockClear()
    mockPullTemplates.mockClear()
    currentSearchParams = new URLSearchParams()
  })
  it("renders filter bar and disables pull button when no device is selected", async () => {
    currentSearchParams = new URLSearchParams()
    const view = render(<TemplatesPageClient isSuperAdmin={false} />)

    const syncButton = view.getByRole("button", { name: /pull from meta/i })
    expect(syncButton).toBeDisabled()

    await waitFor(() => {
      expect(view.getAllByText("Order Confirmation").length).toBeGreaterThan(0)
      expect(view.getByText("order_confirmation")).toBeInTheDocument()
      expect(view.getAllByText(/Main Device/).length).toBeGreaterThanOrEqual(1)
      expect(view.getAllByText("UTILITY").length).toBeGreaterThan(0)
      expect(view.getByText("Approved")).toBeInTheDocument()
    })
    cleanup()
  })

  it("enables pull button and triggers pull when a specific device is selected", async () => {
    currentSearchParams = new URLSearchParams("whatsappDeviceId=dev-1")
    const view = render(<TemplatesPageClient isSuperAdmin={false} />)

    await waitFor(() => {
      expect(view.getAllByText("Order Confirmation").length).toBeGreaterThan(0)
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
    const nav = await import("next/navigation")
    const router = nav.useRouter()
    currentSearchParams = new URLSearchParams()
    const view = render(<TemplatesPageClient isSuperAdmin={false} />)

    const createBtns = view.getAllByRole("button", { name: /create template/i })
    fireEvent.click(createBtns[0])

    expect(router.push).toHaveBeenCalledWith("/portal/whatsapp/templates/new")
    cleanup()
  })
})

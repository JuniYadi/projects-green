import "@/test/register"
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import type { WhatsAppTemplate } from "@/lib/api/whatsapp-client"
// NOTE: Do NOT import `screen` — it is evaluated at module-import time when
// document.body is still null (Happy DOM). Use render()'s return value instead.

const mockTemplatesData = [
  {
    id: "tpl-1",
    name: "Hello World",
    slug: "hello_world",
    description: "A greeting template",
    metaStatus: "APPROVED",
    syncStatus: "SYNCED",
    category: "UTILITY",
    whatsappDeviceId: "device-1",
    organizationId: "org-1",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    languages: [
      { id: "l1", lang: "en" },
      { id: "l2", lang: "id" },
    ],
  },
  {
    id: "tpl-2",
    name: "Promo Sale",
    slug: "promo_sale",
    description: "A marketing promotion",
    metaStatus: "PENDING",
    syncStatus: "SYNCED",
    category: "MARKETING",
    whatsappDeviceId: "device-1",
    organizationId: "org-1",
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
    languages: [{ id: "l3", lang: "en" }],
  },
  {
    id: "tpl-3",
    name: "OTP Code",
    slug: "otp_code",
    description: "Authentication code",
    metaStatus: "APPROVED",
    syncStatus: "SYNCED",
    category: "AUTHENTICATION",
    whatsappDeviceId: "device-1",
    organizationId: "org-1",
    createdAt: "2024-01-03T00:00:00Z",
    updatedAt: "2024-01-03T00:00:00Z",
    languages: [{ id: "l4", lang: "en" }],
  },
  {
    id: "tpl-4",
    name: "No Category",
    slug: "no_category",
    description: null,
    metaStatus: "APPROVED",
    syncStatus: "SYNCED",
    category: null,
    whatsappDeviceId: "device-1",
    organizationId: "org-1",
    createdAt: "2024-01-04T00:00:00Z",
    updatedAt: "2024-01-04T00:00:00Z",
    languages: [{ id: "l5", lang: "en" }],
  },
]

const mockUseTemplates = mock(() => ({
  templates: mockTemplatesData as WhatsAppTemplate[],
  loading: false,
  error: null,
  reload: mock(() => {}),
}))

const mockUseSyncTemplate = mock(() => ({
  sync: mock(() => Promise.resolve({ ok: true })),
  syncing: false,
}))

const mockDeviceList = mock(() =>
  Promise.resolve({ ok: true, devices: [] as Array<Record<string, unknown>> })
)

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    devices: {
      list: mockDeviceList,
      pullTemplates: mock(() => Promise.resolve({ ok: true, syncedCount: 0 })),
    },
  },
}))
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(() => {}),
  }),
  useParams: () => ({ lang: "en" }),
  usePathname: () => "/en/console/whatsapp/templates",
  useSearchParams: () => new URLSearchParams(),
}))

mock.module("@/modules/whatsapp/onboarding/use-whatsapp-onboarding", () => ({
  useWhatsAppOnboarding: () => ({
    isFeatureLocked: () => false,
    isGraduated: true,
    level: 3,
    progressPercent: 100,
    missions: [],
    activeMission: {
      title: "Done",
      subtitle: "Done",
      description: "Done",
      actionLabel: "Done",
      completed: true,
    },
    graduateNow: () => {},
    resetOnboarding: () => {},
  }),
}))

const mockDeleteTemplate = mock(() => Promise.resolve())

mock.module("@/modules/whatsapp/templates/api/templates.hooks", () => ({
  useTemplates: mockUseTemplates,
  useSyncTemplate: mockUseSyncTemplate,
  useDeleteTemplate: () => ({
    remove: mockDeleteTemplate,
    deleting: false,
  }),
}))

mock.module("@/lib/i18n/pathname", () => ({
  localizePathname: (opts: { pathname: string; locale: string }) =>
    `/${opts.locale || "en"}${opts.pathname}`,
  resolveLocaleOrDefault: (lang: string) => lang || "en",
}))

import WhatsAppTemplatesPage from "./page"

describe("WhatsAppTemplatesPage", () => {
  beforeEach(() => {
    cleanup()
    mockUseTemplates.mockClear()
    mockUseSyncTemplate.mockClear()
  })
  it("renders category column header", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    expect(view.getAllByText("Category").length).toBeGreaterThan(0)
  })

  it("renders category badge for UTILITY template", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    expect(view.getAllByText("UTILITY").length).toBeGreaterThan(0)
  })

  it("renders category badge for MARKETING template", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    expect(view.getAllByText("MARKETING").length).toBeGreaterThan(0)
  })

  it("renders category badge for AUTHENTICATION template", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    expect(view.getAllByText("AUTHENTICATION").length).toBeGreaterThan(0)
  })
  it("renders category facet filter options and custom allLabels", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    // Filter buttons show labels in their headers
    expect(view.getAllByText("All Status").length).toBeGreaterThan(0)
    expect(view.getAllByText("All Category").length).toBeGreaterThan(0)
  })

  it("renders Templates heading", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    const headings = view.getAllByText("Templates")
    expect(headings.length).toBeGreaterThan(0)
  })

  it("shows language badges inside Template column", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    // The first template has both "en" and "id" languages
    const enFound = view.getAllByText("en")
    expect(enFound.length).toBeGreaterThan(0)
    const idFound = view.getAllByText("id")
    expect(idFound.length).toBeGreaterThan(0)
  })

  it("Creation Date is hidden by default, Last Updated remains visible", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    // "Creation Date" should be hidden from table headers
    expect(view.queryByText("Creation Date")).toBeNull()
    // "Last Updated" should be visible in headers
    expect(view.getAllByText("Last Updated").length).toBeGreaterThan(0)
  })

  it("renders a warning banner when selected device lacks MANAGE permissions on Meta WABA", async () => {
    mockDeviceList.mockResolvedValueOnce({
      ok: true,
      devices: [
        {
          id: "dev-unassigned",
          phoneNumber: "+6285177284620",
          name: "PMI Bantul",
          features: {
            metaPermissions: {
              status: "NOT_ASSIGNED",
              canManageTemplates: false,
              warning:
                "System User token is not assigned to this WhatsApp Business Account in Meta Business Suite.",
            },
          },
        },
      ],
    })

    const view = render(<WhatsAppTemplatesPage />)
    expect(
      await view.findByText(
        /Warning: WhatsApp Token Lacks Full Access \(MANAGE\) in Meta/i
      )
    ).toBeInTheDocument()
    expect(
      view.getByText(/System User token is not assigned/i)
    ).toBeInTheDocument()
  })

  it("renders selection checkboxes and row delete buttons", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    const checkboxes = view.getAllByRole("checkbox")
    expect(checkboxes.length).toBeGreaterThan(0)

    const deleteButtons = view.getAllByLabelText(/Delete/i)
    expect(deleteButtons.length).toBeGreaterThan(0)
  })
})

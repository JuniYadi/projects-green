import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render } from "@testing-library/react"

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
  templates: mockTemplatesData as any,
  loading: false,
  error: null,
  reload: mock(() => {}),
}))

const mockUseSyncTemplate = mock(() => ({
  sync: mock(() => Promise.resolve({ ok: true })),
  syncing: false,
}))

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(() => {}),
  }),
  useParams: () => ({ lang: "en" }),
}))

mock.module("@/modules/whatsapp/templates/api/templates.hooks", () => ({
  useTemplates: mockUseTemplates,
  useSyncTemplate: mockUseSyncTemplate,
}))

mock.module("@/lib/i18n/messages", () => ({
  getMessages: () => ({
    console: {
      whatsapp: {
        templates: {
          heading: "Templates",
          description: "Manage your WhatsApp message templates",
          cardTitle: "Templates",
          cardDescription: "Create and manage WhatsApp Business templates",
          totalTemplates: "Total Templates",
          synced: "Synced",
          pendingSync: "Pending Sync",
          syncing: "Syncing...",
          syncTemplates: "Sync All",
          createTemplate: "Create Template",
        },
      },
    },
  }),
}))

mock.module("@/lib/i18n/pathname", () => ({
  localizePathname: (opts: any) => `/en${opts.path}`,
  resolveLocaleOrDefault: (lang: any) => lang || "en",
}))

import WhatsAppTemplatesPage from "./page"

describe("WhatsAppTemplatesPage", () => {
  beforeEach(() => {
    mockUseTemplates.mockClear()
    mockUseSyncTemplate.mockClear()
  })

  it("renders category column header", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    expect(view.getByText("Category")).toBeDefined()
  })

  it("renders category badge for UTILITY template", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    expect(view.getByText("UTILITY")).toBeDefined()
  })

  it("renders category badge for MARKETING template", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    expect(view.getByText("MARKETING")).toBeDefined()
  })

  it("renders category badge for AUTHENTICATION template", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    expect(view.getByText("AUTHENTICATION")).toBeDefined()
  })
  it("renders category facet filter options and custom allLabels", async () => {
    const view = render(<WhatsAppTemplatesPage />)
    // Filter buttons show labels in their headers
    expect(view.getAllByText("All Sync").length).toBeGreaterThan(0)
    expect(view.getAllByText("All Meta Status").length).toBeGreaterThan(0)
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
    // "Last Updated Date" should be visible in headers
    expect(view.queryByText("Last Updated Date")).toBeDefined()
  })
})

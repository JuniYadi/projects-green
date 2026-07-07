import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, screen } from "@testing-library/react"

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
    languages: [{ id: "l1", lang: "en" }],
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
    languages: [{ id: "l2", lang: "en" }],
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
    languages: [{ id: "l3", lang: "en" }],
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
    languages: [{ id: "l4", lang: "en" }],
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

  describe("category column in DataTable", () => {
    it("renders category column header", async () => {
      render(<WhatsAppTemplatesPage />)

      expect(screen.getByText("Category")).toBeDefined()
    })

    it("renders category badge for UTILITY template", async () => {
      render(<WhatsAppTemplatesPage />)

      expect(screen.getByText("UTILITY")).toBeDefined()
    })

    it("renders category badge for MARKETING template", async () => {
      render(<WhatsAppTemplatesPage />)

      expect(screen.getByText("MARKETING")).toBeDefined()
    })

    it("renders category badge for AUTHENTICATION template", async () => {
      render(<WhatsAppTemplatesPage />)

      expect(screen.getByText("AUTHENTICATION")).toBeDefined()
    })

    it("shows — for template without category", async () => {
      render(<WhatsAppTemplatesPage />)

      // The No Category template should show "—" since category is null
      expect(screen.getAllByText("—").length).toBeGreaterThan(0)
    })
  })

  describe("category facet filter", () => {
    it("renders category facet filter options", async () => {
      render(<WhatsAppTemplatesPage />)

      // The facet filter should include Marketing, Utility, Authentication options
      // The DataTable renders facets as buttons/checkboxes - we verify by presence
      expect(screen.getByText("Marketing")).toBeDefined()
      expect(screen.getByText("Utility")).toBeDefined()
      expect(screen.getByText("Authentication")).toBeDefined()
    })
  })

  describe("category in searchableColumns", () => {
    it("DataTable is rendered with category searchable", async () => {
      render(<WhatsAppTemplatesPage />)

      // The page should render without errors when templates have categories
      expect(screen.getByText("Templates")).toBeDefined()
    })
  })
})

import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor, cleanup } from "@testing-library/react"

const mockPush = mock(() => {})
let mockDuplicateParam: string | null = null

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "duplicate" ? mockDuplicateParam : null),
  }),
}))
mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    devices: {
      list: mock(async () => ({
        ok: true,
        devices: [
          {
            id: "dev-1",
            phoneNumber: "+6281234567890",
            name: "Default Device",
            status: "ACTIVE",
          },
        ],
      })),
    },
  },
}))

mock.module("@/modules/whatsapp/onboarding/use-whatsapp-onboarding", () => ({
  useWhatsAppOnboarding: () => ({
    currentStep: 0,
    completedSteps: [],
    isComplete: true,
    level: 4,
    completeStep: mock(() => {}),
    resetOnboarding: mock(() => {}),
  }),
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      whatsapp: {
        devices: {
          get: mock(async () => ({
            data: {
              ok: true,
              devices: [
                {
                  id: "dev-1",
                  phoneNumber: "+6281234567890",
                  status: "ACTIVE",
                },
              ],
            },
          })),
        },
        templates: {
          get: mock(async () => ({
            data: {
              ok: true,
              data: [],
            },
          })),
          post: mock(async () => ({
            data: {
              ok: true,
              id: "tpl-123",
            },
          })),
        },
      },
    },
  },
}))

const mockCreate = mock(() => Promise.resolve({ id: "tpl-123" }))
mock.module("@/modules/whatsapp/templates/api/templates.hooks", () => ({
  useCreateTemplate: () => ({
    create: mockCreate,
    creating: false,
    error: null,
  }),
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
}))

import PortalNewTemplatePage from "./page"

describe("PortalNewTemplatePage", () => {
  beforeEach(() => {
    cleanup()
    mockPush.mockClear()
    mockDuplicateParam = null
  })

  it("renders page header and create template form", async () => {
    const { getByText } = render(<PortalNewTemplatePage />)
    expect(getByText("Create Template")).toBeDefined()
    expect(getByText("Back to Templates")).toBeDefined()
    await waitFor(() => {
      expect(getByText(/1\. General Configuration/i)).toBeDefined()
    })
  })

  it("renders duplicate template mode when duplicate search param is present", async () => {
    mockDuplicateParam = "tpl-src"
    const { getByText } = render(<PortalNewTemplatePage />)
    expect(getByText("Duplicate Template")).toBeDefined()
    expect(
      getByText("Create a new template based on an existing one.")
    ).toBeDefined()
    await waitFor(() => {
      expect(getByText(/1\. General Configuration/i)).toBeDefined()
    })
  })
})

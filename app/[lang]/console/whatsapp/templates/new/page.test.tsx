import { describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockPush = mock(() => {})
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
  useParams: () => ({
    lang: "en",
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
      },
    },
  },
}))

mock.module("@/modules/whatsapp/templates/api/templates.hooks", () => ({
  useCreateTemplate: () => ({
    create: mock(() => Promise.resolve({ id: "tpl-123" })),
    creating: false,
    error: null,
  }),
}))

import ConsoleNewTemplatePage from "./page"
describe("ConsoleNewTemplatePage", () => {
  it("renders page header and template form when active device exists", async () => {
    const { getByText } = render(<ConsoleNewTemplatePage />)
    expect(getByText(/create whatsapp template/i)).toBeDefined()
    expect(getByText(/back to templates/i)).toBeDefined()
    await waitFor(() => {
      expect(getByText(/1\. General Configuration/i)).toBeDefined()
    })
  })
})

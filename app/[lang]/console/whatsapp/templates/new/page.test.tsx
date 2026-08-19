import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

const mockPush = mock(() => {})
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
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
  it("renders page header and template form", () => {
    const { getByText } = render(<ConsoleNewTemplatePage />)
    expect(getByText(/create whatsapp template/i)).toBeDefined()
    expect(getByText(/back to templates/i)).toBeDefined()
  })
})

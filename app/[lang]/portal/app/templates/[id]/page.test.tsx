import "@/test/register"
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockPush = mock(() => {})

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en", id: "tmpl-123" })),
  useRouter: mock(() => ({ push: mockPush })),
}))

const mockTemplate = {
  id: "tmpl-123",
  name: "N8N Workflow",
  slug: "n8n",
  tagline: "Workflow tool",
  description: "Automate everything",
  category: "AUTOMATION",
  visibility: "PUBLIC",
  version: "1.0.0",
  isOfficial: true,
  isFeatured: false,
  blueprintJson: {
    schemaVersion: "1.0.0",
    image: "n8nio/n8n:latest",
    port: 5678,
    runAsNonRoot: true,
    resources: { defaultCpu: 500, defaultMemory: 512 },
    dependencies: [],
    envSchema: [],
  },
  installCount: 10,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

const mockPut = mock(async () => ({
  data: { ...mockTemplate, name: "Updated N8N" },
}))
const mockDelete = mock(async () => ({ data: { success: true } }))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        templates: {
          "tmpl-123": {
            get: mock(async () => ({ data: mockTemplate })),
            put: mockPut,
            delete: mockDelete,
            approve: { post: mock(async () => ({ data: mockTemplate })) },
            reject: { post: mock(async () => ({ data: mockTemplate })) },
            "toggle-featured": {
              post: mock(async () => ({
                data: { ...mockTemplate, isFeatured: true },
              })),
            },
          },
        },
      },
    },
  },
}))

import PortalEditAppTemplatePage from "./page"

describe("PortalEditAppTemplatePage", () => {
  beforeEach(() => {
    cleanup()
    mockPut.mockClear()
    mockDelete.mockClear()
  })

  it("loads and renders template data into form", async () => {
    const { getByText, getByTestId, getByDisplayValue } = render(
      <PortalEditAppTemplatePage />
    )
    await waitFor(() => {
      expect(getByText("Edit N8N Workflow")).toBeInTheDocument()
      expect(getByTestId("template-name-input")).toBeInTheDocument()
      expect(getByDisplayValue("n8n")).toBeInTheDocument()
    })
  })

  it("updates template on submit", async () => {
    const user = userEvent.setup()
    const { getByTestId, getByRole } = render(<PortalEditAppTemplatePage />)

    await waitFor(() => {
      expect(getByTestId("template-name-input")).toBeInTheDocument()
    })

    const nameInput = getByTestId("template-name-input")
    await user.clear(nameInput)
    await user.type(nameInput, "Updated N8N")

    const saveBtn = getByRole("button", { name: /Save Changes/i })
    await user.click(saveBtn)

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalled()
    })
  })
})

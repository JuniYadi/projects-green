import "@/test/register"
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockPush = mock(() => {})

mock.module("next/navigation", () => ({
  useParams: mock(() => ({ lang: "en" })),
  useRouter: mock(() => ({ push: mockPush })),
}))

const mockPost = mock(async (body: unknown) => ({
  data: {
    id: "tmpl-new-1",
    name: "Custom App",
    slug: "custom-app",
    ...((body as object) || {}),
  },
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        templates: {
          post: mockPost,
        },
      },
    },
  },
}))

import PortalNewAppTemplatePage from "./page"

describe("PortalNewAppTemplatePage", () => {
  beforeEach(() => {
    cleanup()
    mockPost.mockClear()
  })

  it("renders new template creation form", () => {
    const { getByTestId, getByText } = render(<PortalNewAppTemplatePage />)
    expect(getByText("Create Marketplace Template")).toBeInTheDocument()
    expect(getByTestId("template-name-input")).toBeInTheDocument()
  })

  it("submits the template form", async () => {
    const user = userEvent.setup()
    const { getByTestId, getByRole } = render(<PortalNewAppTemplatePage />)

    const nameInput = getByTestId("template-name-input")
    await user.type(nameInput, "Awesome Tool")

    const descInput = getByTestId("template-desc-input")
    await user.type(descInput, "A very awesome automation tool")

    const submitBtn = getByRole("button", { name: /Create Template/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled()
    })
  })
})

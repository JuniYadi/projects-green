import { describe, expect, it } from "bun:test"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TemplateForm } from "./template-form"

// Minimal language variant for testing
const minimalVariant = {
  id: "v1",
  lang: "en",
  headerType: "NONE",
  headerText: "",
  headerUrl: "",
  body: "Hello",
  footer: "",
}

describe("TemplateForm", () => {
  describe("category field", () => {
    it("renders category select with UTILITY as default", async () => {
      const user = userEvent.setup()
      let submittedData: Record<string, unknown> | null = null

      render(
        <TemplateForm
          submitting={false}
          onSubmit={async (data) => {
            submittedData = data
          }}
        />
      )

      const select = screen.getByRole("combobox", { name: /category/i })
      expect(select).toBeDefined()

      // Default should be UTILITY
      // The SelectValue shows the text "Utility" not the value
      // We verify by submitting without changes
      await user.click(screen.getByRole("button", { name: /save template/i }))
      expect(submittedData).not.toBeNull()
      expect((submittedData as unknown as Record<string, unknown>).category).toBe("UTILITY")
    })

    it("renders category select with MARKETING option", async () => {
      const user = userEvent.setup()
      let submittedData: Record<string, unknown> | null = null

      render(
        <TemplateForm
          submitting={false}
          onSubmit={async (data) => {
            submittedData = data
          }}
        />
      )

      const select = screen.getByRole("combobox", { name: /category/i })
      await user.click(select)

      const marketingOption = screen.getByRole("option", { name: /marketing/i })
      await user.click(marketingOption)

      await user.click(screen.getByRole("button", { name: /save template/i }))
      expect((submittedData as unknown as Record<string, unknown>).category).toBe("MARKETING")
    })

    it("renders category select with AUTHENTICATION option", async () => {
      const user = userEvent.setup()
      let submittedData: Record<string, unknown> | null = null

      render(
        <TemplateForm
          submitting={false}
          onSubmit={async (data) => {
            submittedData = data
          }}
        />
      )

      const select = screen.getByRole("combobox", { name: /category/i })
      await user.click(select)

      const authOption = screen.getByRole("option", { name: /authentication/i })
      await user.click(authOption)

      await user.click(screen.getByRole("button", { name: /save template/i }))
      expect((submittedData as unknown as Record<string, unknown>).category).toBe("AUTHENTICATION")
    })

    it("initializes category from initialData when editing", async () => {
      const user = userEvent.setup()
      let submittedData: Record<string, unknown> | null = null

      render(
        <TemplateForm
          initialData={{
            name: "Test Template",
            slug: "test_template",
            description: "A test",
            category: "MARKETING",
            languages: [minimalVariant],
          }}
          submitting={false}
          onSubmit={async (data) => {
            submittedData = data
          }}
        />
      )

      // Submit without changing category
      await user.click(screen.getByRole("button", { name: /save template/i }))
      expect((submittedData as unknown as Record<string, unknown>).category).toBe("MARKETING")
    })

    it("defaults to UTILITY when initialData.category is null", async () => {
      const user = userEvent.setup()
      let submittedData: Record<string, unknown> | null = null

      render(
        <TemplateForm
          initialData={{
            name: "Test Template",
            slug: "test_template",
            description: "A test",
            category: null,
            languages: [minimalVariant],
          }}
          submitting={false}
          onSubmit={async (data) => {
            submittedData = data
          }}
        />
      )

      await user.click(screen.getByRole("button", { name: /save template/i }))
      expect((submittedData as unknown as Record<string, unknown>).category).toBe("UTILITY")
    })

    it("submits category along with other fields", async () => {
      const user = userEvent.setup()
      let submittedData: Record<string, unknown> | null = null

      render(
        <TemplateForm
          submitting={false}
          onSubmit={async (data) => {
            submittedData = data
          }}
        />
      )

      // Fill name
      await user.type(screen.getByLabelText(/name/i), "My Template")

      // Fill slug
      await user.type(screen.getByLabelText(/slug/i), "my_template")

      // Select AUTHENTICATION
      await user.click(screen.getByRole("combobox", { name: /category/i }))
      await user.click(screen.getByRole("option", { name: /authentication/i }))

      // Submit
      await user.click(screen.getByRole("button", { name: /save template/i }))

      expect(submittedData).not.toBeNull()
      expect((submittedData as unknown as Record<string, unknown>).name).toBe("My Template")
      expect((submittedData as unknown as Record<string, unknown>).slug).toBe("my_template")
      expect((submittedData as unknown as Record<string, unknown>).category).toBe("AUTHENTICATION")
    })
  })
})

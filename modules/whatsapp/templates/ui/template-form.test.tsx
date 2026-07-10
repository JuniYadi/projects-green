import { describe, expect, it } from "bun:test"
import { render, screen } from "@testing-library/react"
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

  describe("approved template locked mode", () => {
    const structureTemplate = {
      headerType: "TEXT",
      headerText: "Hello",
      headerUrl: "",
      body: "This is the approved body",
      footer: "Approved footer",
      parameters: null,
      buttons: null,
    }

    const initialDataApproved = {
      name: "Approved Template",
      slug: "approved_template",
      description: "An approved template",
      category: "UTILITY",
      languages: [
        {
          id: "variant-1",
          lang: "en",
          headerType: "TEXT",
          headerText: "Hello",
          headerUrl: "",
          body: "This is the approved body",
          footer: "Approved footer",
        },
      ],
    }

    it("disables core field inputs when locked", async () => {
      render(
        <TemplateForm
          initialData={initialDataApproved}
          submitting={false}
          mode="edit"
          approvedTemplateLocked={true}
          lockedVariantIds={["variant-1"]}
          structureTemplate={structureTemplate}
          onSubmit={async () => {}}
        />
      )

      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement
      const slugInput = screen.getByLabelText(/slug/i) as HTMLInputElement
      expect(nameInput.disabled).toBe(true)
      expect(slugInput.disabled).toBe(true)
    })

    it("disables variant inputs for locked variant ids", async () => {
      render(
        <TemplateForm
          initialData={initialDataApproved}
          submitting={false}
          mode="edit"
          approvedTemplateLocked={true}
          lockedVariantIds={["variant-1"]}
          structureTemplate={structureTemplate}
          onSubmit={async () => {}}
        />
      )

      // Language select should be disabled for the locked variant
      const langSelect = screen.getByRole("combobox", { name: /language/i })
      expect(langSelect).toBeDisabled()
    })

    it("hides remove button for locked variants", async () => {
      render(
        <TemplateForm
          initialData={initialDataApproved}
          submitting={false}
          mode="edit"
          approvedTemplateLocked={true}
          lockedVariantIds={["variant-1"]}
          structureTemplate={structureTemplate}
          onSubmit={async () => {}}
        />
      )

      // With only one variant, remove button should not appear
      // Even if there were more, the locked one should not have X
      const removeButtons = screen.queryAllByRole("button", { name: "" })
      const xButtons = removeButtons.filter((btn) => btn.querySelector("svg"))
      // The locked single variant should not show an X button
      expect(xButtons.length).toBe(0)
    })

    it("keeps Add Variant button enabled in locked mode", async () => {
      render(
        <TemplateForm
          initialData={initialDataApproved}
          submitting={false}
          mode="edit"
          approvedTemplateLocked={true}
          lockedVariantIds={["variant-1"]}
          structureTemplate={structureTemplate}
          onSubmit={async () => {}}
        />
      )

      const addButton = screen.getByRole("button", { name: /add variant/i })
      expect(addButton).not.toBeDisabled()
    })

    it("adding a variant in locked mode creates a new variant with structure copied", async () => {
      const user = userEvent.setup()
      let submittedData: Record<string, unknown> | null = null

      render(
        <TemplateForm
          initialData={initialDataApproved}
          submitting={false}
          mode="edit"
          approvedTemplateLocked={true}
          lockedVariantIds={["variant-1"]}
          structureTemplate={structureTemplate}
          onSubmit={async (data) => {
            submittedData = data
          }}
        />
      )

      // Click Add Variant
      await user.click(screen.getByRole("button", { name: /add variant/i }))

      // Fill body for the new variant (only lang is editable)
      const bodyTextarea = screen.getAllByRole("textbox").find(
        (t) => t.id?.includes("body")
      ) as HTMLTextAreaElement
      expect(bodyTextarea).toBeDefined()

      // Submit
      await user.click(screen.getByRole("button", { name: /save template/i }))

      expect(submittedData).not.toBeNull()
      const submitted = submittedData as unknown as Record<string, unknown>
      // Should only submit the new variant, not the locked one
      expect(Array.isArray(submitted.languages)).toBe(true)
      const langs = submitted.languages as Array<{ lang: string; body: string }>
      expect(langs.length).toBe(1)
      expect(langs[0].lang).toBe("en")
      expect(langs[0].body).toBe("This is the approved body")
    })

    it("submits only new variants for locked templates", async () => {
      const user = userEvent.setup()
      let submittedData: Record<string, unknown> | null = null

      render(
        <TemplateForm
          initialData={initialDataApproved}
          submitting={false}
          mode="edit"
          approvedTemplateLocked={true}
          lockedVariantIds={["variant-1"]}
          structureTemplate={structureTemplate}
          onSubmit={async (data) => {
            submittedData = data
          }}
        />
      )

      // Add a new variant
      await user.click(screen.getByRole("button", { name: /add variant/i }))

      // Submit
      await user.click(screen.getByRole("button", { name: /save template/i }))

      expect(submittedData).not.toBeNull()
      const submitted = submittedData as unknown as Record<string, unknown>
      // Should use initialData values for core fields
      expect((submitted as Record<string, unknown>).name).toBe("Approved Template")
      expect((submitted as Record<string, unknown>).slug).toBe("approved_template")
    })
  })
})

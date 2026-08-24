import "@/test/register"
import { beforeEach, describe, expect, it } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TemplateForm } from "./template-form"

describe("TemplateForm", () => {
  beforeEach(() => {
    cleanup()
  })
  it("renders with default category UTILITY and language id", async () => {
    const user = userEvent.setup()
    let submittedData: Record<string, unknown> | null = null

    const { getByLabelText, getByRole } = render(
      <TemplateForm
        initialData={{
          name: "Welcome Message",
          slug: "welcome_message",
          category: "UTILITY",
          languages: [
            {
              id: "v1",
              lang: "id",
              headerType: "NONE",
              headerText: "",
              headerUrl: "",
              body: "Halo {{1}}, selamat datang di toko kami. Terima kasih.",
              footer: "",
            },
          ],
        }}
        submitting={false}
        onSubmit={async (data) => {
          submittedData = data
        }}
      />
    )

    expect(getByLabelText(/template name/i)).toBeDefined()
    expect(getByLabelText(/template slug/i)).toBeDefined()
    expect(getByLabelText(/body text/i)).toBeDefined()

    // Dynamic variable sample input should appear for {{1}}
    const sampleInput = document.getElementById("sample-1") as HTMLInputElement
    expect(sampleInput).not.toBeNull()
    await user.type(sampleInput, "Budi")

    // Submit form
    await user.click(getByRole("button", { name: /save template/i }))

    expect(submittedData).not.toBeNull()
    const data = submittedData as unknown as {
      name: string
      slug: string
      category: string
      languages: Array<{
        lang: string
        body: string
        parameters?: Array<{ text: string }>
      }>
    }
    expect(data.name).toBe("Welcome Message")
    expect(data.slug).toBe("welcome_message")
    expect(data.category).toBe("UTILITY")
    expect(data.languages[0].lang).toBe("id")
    expect(data.languages[0].parameters?.[0].text).toBe("Budi")
  })

  it("allows switching between Bubble and Config JSON preview tabs", async () => {
    const user = userEvent.setup()

    const { getByRole, getByText } = render(
      <TemplateForm submitting={false} onSubmit={async () => {}} />
    )

    const jsonTabBtn = getByRole("button", { name: /config json/i })
    await user.click(jsonTabBtn)

    expect(getByText(/"category": "UTILITY"/i)).toBeDefined()
  })

  it("handles adding interactive buttons", async () => {
    const user = userEvent.setup()

    const { getByRole, getByDisplayValue } = render(
      <TemplateForm submitting={false} onSubmit={async () => {}} />
    )

    const addUrlBtn = getByRole("button", { name: /url cta/i })
    await user.click(addUrlBtn)

    expect(getByDisplayValue("Visit Website")).toBeDefined()
  })
})

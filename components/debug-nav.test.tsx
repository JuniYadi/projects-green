import { describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { CreateOrganizationDialog } from "@/components/create-organization-dialog"
import { enMessages } from "@/lib/i18n/messages/en"

describe("debug dialog body-container", () => {
  it("change updates state when container=body", async () => {
    const onSubmit = mock(() => {})
    const view = render(
      <CreateOrganizationDialog
        open
        onOpenChange={() => {}}
        isCreating={false}
        error={null}
        messages={enMessages.navOrganization}
        onSubmit={onSubmit}
      />,
      { container: document.body, baseElement: document.body }
    )
    const nameInput = await view.findByLabelText("Organization name") as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: "Acme New" } })
    const submit = await view.findByRole("button", { name: "Create organization" })
    console.log("disabled:", submit.hasAttribute("disabled"))
    fireEvent.submit(submit.closest("form") as HTMLFormElement)
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    console.log("onSubmit args:", JSON.stringify(onSubmit.mock.calls[0]))
    cleanup()
  })
})

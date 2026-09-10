import "@/test/register"
import { describe, expect, it, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import * as React from "react"
import { TemplateDeleteDialog } from "./template-delete-dialog"

describe("TemplateDeleteDialog", () => {
  it("renders template name and standard deletion text", () => {
    const view = render(
      <TemplateDeleteDialog
        open={true}
        onOpenChange={mock()}
        templateName="promo_merdeka"
        isApproved={false}
        deleting={false}
        onConfirm={mock()}
      />
    )

    expect(view.getByText("promo_merdeka")).toBeTruthy()
    expect(view.queryByText(/30 Hari|30 Days/i)).toBeNull()
  })

  it("shows 30-day freeze alert and requires acknowledgment when isApproved is true", () => {
    const onConfirm = mock()
    const view = render(
      <TemplateDeleteDialog
        open={true}
        onOpenChange={mock()}
        templateName="otp_approved"
        isApproved={true}
        deleting={false}
        onConfirm={onConfirm}
      />
    )

    // Alert warning is visible
    expect(view.getAllByText(/30 Hari|30 Days/i).length).toBeGreaterThanOrEqual(
      1
    )

    // Delete button should initially be disabled because checkbox is not checked
    const deleteButton = view.getByRole("button", {
      name: /Hapus Template|Delete/i,
    })
    expect(deleteButton.hasAttribute("disabled")).toBe(true)

    // Check the acknowledgment checkbox
    const checkbox = view.getByRole("checkbox")
    fireEvent.click(checkbox)

    // Delete button should now be enabled
    expect(deleteButton.hasAttribute("disabled")).toBe(false)

    // Clicking delete calls onConfirm
    fireEvent.click(deleteButton)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("disables delete button while deleting is true", () => {
    const view = render(
      <TemplateDeleteDialog
        open={true}
        onOpenChange={mock()}
        templateName="otp_loading"
        isApproved={false}
        deleting={true}
        onConfirm={mock()}
      />
    )

    const deleteButton = view.getByRole("button", {
      name: /Menghapus|Deleting/i,
    })
    expect(deleteButton.hasAttribute("disabled")).toBe(true)
  })
})

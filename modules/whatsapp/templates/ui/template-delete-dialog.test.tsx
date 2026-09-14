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

  it("requires typing 'DELETE' to enable the delete button", () => {
    const onConfirm = mock()
    const view = render(
      <TemplateDeleteDialog
        open={true}
        onOpenChange={mock()}
        templateName="promo_merdeka"
        isApproved={false}
        deleting={false}
        onConfirm={onConfirm}
      />
    )

    const deleteButton = view.getByRole("button", {
      name: /Hapus Template|Delete/i,
    })
    expect(deleteButton.hasAttribute("disabled")).toBe(true)

    const input = view.getByPlaceholderText("DELETE")

    // Type lower case or wrong text -> still disabled
    fireEvent.change(input, { target: { value: "delete" } })
    expect(deleteButton.hasAttribute("disabled")).toBe(true)

    fireEvent.change(input, { target: { value: "DEL" } })
    expect(deleteButton.hasAttribute("disabled")).toBe(true)

    // Type exact DELETE -> enabled
    fireEvent.change(input, { target: { value: "DELETE" } })
    expect(deleteButton.hasAttribute("disabled")).toBe(false)

    fireEvent.click(deleteButton)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("shows 30-day freeze alert and requires acknowledgment + typing DELETE when isApproved is true", () => {
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

    const deleteButton = view.getByRole("button", {
      name: /Hapus Template|Delete/i,
    })
    const input = view.getByPlaceholderText("DELETE")
    const checkbox = view.getByRole("checkbox")

    expect(deleteButton.hasAttribute("disabled")).toBe(true)

    // Type DELETE only -> still disabled because checkbox not acknowledged
    fireEvent.change(input, { target: { value: "DELETE" } })
    expect(deleteButton.hasAttribute("disabled")).toBe(true)

    // Check the acknowledgment checkbox -> enabled
    fireEvent.click(checkbox)
    expect(deleteButton.hasAttribute("disabled")).toBe(false)

    // Clicking delete calls onConfirm
    fireEvent.click(deleteButton)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("renders bulk deletion UI when templateNames has multiple items", () => {
    const onConfirm = mock()
    const view = render(
      <TemplateDeleteDialog
        open={true}
        onOpenChange={mock()}
        templateNames={["template_alpha", "template_beta", "template_gamma"]}
        isApproved={false}
        deleting={false}
        onConfirm={onConfirm}
      />
    )

    expect(view.getByText(/3 Template/i)).toBeTruthy()
    expect(view.getByText("template_alpha")).toBeTruthy()
    expect(view.getByText("template_beta")).toBeTruthy()
    expect(view.getByText("template_gamma")).toBeTruthy()

    const deleteButton = view.getByRole("button", {
      name: /Hapus 3 Template|Delete 3 Templates/i,
    })
    expect(deleteButton.hasAttribute("disabled")).toBe(true)

    const input = view.getByPlaceholderText("DELETE")
    fireEvent.change(input, { target: { value: "DELETE" } })
    expect(deleteButton.hasAttribute("disabled")).toBe(false)

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

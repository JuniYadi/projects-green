/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

describe("Sheet", () => {
  it("renders open content structure and close button by default", () => {
    const view = render(
      <Sheet open>
        <SheetTrigger>Open panel</SheetTrigger>
        <SheetContent side="left">
          <SheetHeader className="custom-header">
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>Adjust your configuration.</SheetDescription>
          </SheetHeader>
          <SheetFooter className="custom-footer">Footer</SheetFooter>
        </SheetContent>
      </Sheet>
    )

    expect(view.getByText("Settings")).toBeInTheDocument()
    expect(view.getByText("Adjust your configuration.")).toBeInTheDocument()
    expect(view.getByText("Footer")).toBeInTheDocument()
    expect(view.getByText("Close")).toBeInTheDocument()

    const content = document.querySelector('[data-slot="sheet-content"]')
    expect(content?.getAttribute("data-side")).toBe("left")

    const overlay = document.querySelector('[data-slot="sheet-overlay"]')
    expect(overlay).toBeTruthy()
  })

  it("supports hiding close button and custom slots", () => {
    const view = render(
      <Sheet open>
        <SheetContent showCloseButton={false}>
          <SheetHeader>
            <SheetTitle>Hidden close</SheetTitle>
            <SheetDescription>No default close button.</SheetDescription>
          </SheetHeader>
          <SheetClose>Dismiss</SheetClose>
          <div>Body</div>
        </SheetContent>
      </Sheet>
    )

    expect(view.getByText("Dismiss")).toBeInTheDocument()
    expect(view.getByText("Body")).toBeInTheDocument()
    expect(view.queryByText("Close")).toBeNull()
  })
})

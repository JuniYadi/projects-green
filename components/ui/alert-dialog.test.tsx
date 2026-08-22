import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

describe("AlertDialog", () => {
  it("renders trigger, content, action, and cancel buttons with proper styling", () => {
    const view = render(
      <AlertDialog open>
        <AlertDialogTrigger>Open Dialog</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Test Title</AlertDialogTitle>
            <AlertDialogDescription>Test Description</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )

    expect(view.getByText("Test Title")).toBeTruthy()
    expect(view.getByText("Test Description")).toBeTruthy()
    expect(view.getByRole("button", { name: "Cancel" })).toBeTruthy()
    expect(view.getByRole("button", { name: "Delete" })).toBeTruthy()
  })
})

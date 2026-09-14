import "@/test/setup"
import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import { fireEvent, render } from "@testing-library/react"
import { AddCredentialDialog } from "./add-credential-dialog"

const mockToastSuccess = mock(() => {})
const mockToastError = mock(() => {})

mock.module("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

const originalFetch = globalThis.fetch
const mockFetch = mock((_input: string | URL | Request) =>
  Promise.resolve(jsonResponse({ ok: true }))
)

describe("AddCredentialDialog", () => {
  beforeEach(() => {
    globalThis.fetch = mockFetch as unknown as typeof fetch
    mockFetch.mockClear()
    mockToastSuccess.mockClear()
    mockToastError.mockClear()
    mockFetch.mockImplementation(() =>
      Promise.resolve(jsonResponse({ ok: true }))
    )
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("does not render dialog content when closed", () => {
    const view = render(
      <AddCredentialDialog
        open={false}
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />
    )

    expect(view.queryByText("Add Credential")).toBeNull()
    view.unmount()
  })

  it("renders empty state placeholder when open and no type selected", () => {
    const view = render(
      <AddCredentialDialog
        open={true}
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />
    )

    expect(view.getByText("Add Credential")).toBeInTheDocument()
    expect(
      view.getByText(
        "Select a credential type above to configure the required fields."
      )
    ).toBeInTheDocument()
    view.unmount()
  })

  it("calls onOpenChange(false) when Cancel button is clicked", () => {
    const onOpenChange = mock(() => {})
    const view = render(
      <AddCredentialDialog
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={() => {}}
      />
    )

    const cancelButton = view.getByRole("button", { name: "Cancel" })
    fireEvent.click(cancelButton)

    expect(onOpenChange).toHaveBeenCalledWith(false)
    view.unmount()
  })

  it("disables submit button when required fields are missing", () => {
    const view = render(
      <AddCredentialDialog
        open={true}
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />
    )

    const submitButton = view.getByRole("button", { name: "Create Credential" })
    expect(submitButton).toBeDisabled()
    view.unmount()
  })
})

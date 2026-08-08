import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

const mockEditor = mock(() => <div data-testid="addon-editor">New add-on</div>)

mock.module(
  "@/app/[lang]/portal/billing/catalog/addons/[addonCode]/page",
  () => ({
    default: mockEditor,
  })
)

const { default: NewAddonEditorPage } = await import("./new/page")

describe("canonical add-on editor route", () => {
  beforeEach(() => mockEditor.mockClear())

  it("renders the existing editor in new mode", () => {
    const view = render(<NewAddonEditorPage />)

    expect(view.getByTestId("addon-editor")).toBeTruthy()
    expect(view.getByText("New add-on")).toBeTruthy()
    expect(mockEditor).toHaveBeenCalledWith({}, undefined)
  })
})

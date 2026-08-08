import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

const mockSearchParams = { get: mock(() => null) }
const mockUseParams = mock(() => ({ id: "vpn" }))
const mockEditor = mock(
  ({ productCode, isNew }: { productCode: string; isNew: boolean }) => (
    <div
      data-testid="product-editor"
      data-code={productCode}
      data-new={String(isNew)}
    >
      Basics Plans Add-ons Product details Publish
    </div>
  )
)

mock.module("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useParams: mockUseParams,
}))
mock.module("@/components/billing/admin/catalog/product-editor", () => ({
  ProductEditor: mockEditor,
}))

const { default: NewProductEditorPage } = await import("./new/page")
const { default: ExistingProductEditorPage } = await import("./[id]/page")

describe("canonical product editor routes", () => {
  beforeEach(() => {
    mockSearchParams.get.mockReturnValue(null)
    mockUseParams.mockReturnValue({ id: "vpn" })
    mockEditor.mockClear()
  })

  it("renders the full editor for products/new", () => {
    const view = render(<NewProductEditorPage />)

    expect(view.getByTestId("product-editor")).toBeTruthy()
    expect(
      view.getByText("Basics Plans Add-ons Product details Publish")
    ).toBeTruthy()
    expect(mockEditor).toHaveBeenCalledWith(
      expect.objectContaining({ productCode: "APP_HOSTING", isNew: true }),
      undefined
    )
  })

  it("renders the full editor for products/[id]", () => {
    const view = render(<ExistingProductEditorPage />)

    expect(view.getByTestId("product-editor")).toBeTruthy()
    expect(mockEditor).toHaveBeenCalledWith(
      expect.objectContaining({ productCode: "VPN", isNew: false }),
      undefined
    )
  })
})

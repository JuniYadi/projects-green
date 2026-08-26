import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CatalogExportImport } from "@/components/billing/admin/catalog/catalog-export-import"

describe("CatalogExportImport component", () => {
  const onImportSuccess = mock(() => {})

  beforeEach(() => {
    mock.clearAllMocks()
  })

  it("renders Export and Import buttons", () => {
    render(
      <CatalogExportImport
        catalogCode="WHATSAPP"
        catalogTitle="WhatsApp"
        onImportSuccess={onImportSuccess}
      />
    )

    expect(
      screen.getByRole("button", { name: /Export Catalog JSON/i })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /Import Catalog JSON/i })
    ).toBeTruthy()
  })

  it("opens import dialog when Import button is clicked", async () => {
    const user = userEvent.setup()
    render(
      <CatalogExportImport
        catalogCode="WHATSAPP"
        catalogTitle="WhatsApp"
        onImportSuccess={onImportSuccess}
      />
    )

    await user.click(
      screen.getByRole("button", { name: /Import Catalog JSON/i })
    )

    expect(screen.getByText("Import Catalog Configuration")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /Apply Migration/i })
    ).toBeDisabled()
  })
})

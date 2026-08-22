import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import { StorageAuditView } from "./storage-audit-view"

describe("StorageAuditView", () => {
  it("renders metric cards and file audit table headers", () => {
    const { getByText, getByPlaceholderText } = render(<StorageAuditView />)

    expect(getByText("Total Storage Used")).toBeDefined()
    expect(getByText("Active Files")).toBeDefined()
    expect(getByText("Pending Uploads")).toBeDefined()
    expect(getByText("Swept / Deleted")).toBeDefined()
    expect(getByText("Storage File Audit")).toBeDefined()
    expect(getByPlaceholderText("Search file, ID, or key...")).toBeDefined()
  })
})

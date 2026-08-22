import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import PortalStoragePage from "./page"

describe("PortalStoragePage", () => {
  it("renders the portal storage audit page", () => {
    const { getByText } = render(<PortalStoragePage />)
    expect(getByText("Total Storage Used")).toBeDefined()
    expect(getByText("Storage File Audit")).toBeDefined()
  })
})

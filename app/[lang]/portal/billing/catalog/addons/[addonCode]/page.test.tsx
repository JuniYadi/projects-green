import { beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

const mockSearchParams = { get: mock(() => null) }
const mockUseParams = mock(() => ({ lang: "en", addonCode: "EXTRA_STORAGE" }))
const mockAddonQuery = mock(() => ({
  isLoading: false,
  data: {
    addon: {
      id: "addon-1",
      code: "EXTRA_STORAGE",
      name: "Extra storage",
      description: null,
      billingMode: "RECURRING",
      isActive: true,
      prices: [
        {
          id: "price-1",
          billingPeriod: "MONTHLY",
          currency: "IDR",
          amount: "100",
          effectiveFrom: "2025-01-01",
          effectiveTo: null,
          isActive: true,
        },
      ],
      planAttachments: [],
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
  },
}))

mock.module("next/navigation", () => ({
  useParams: mockUseParams,
  useSearchParams: () => mockSearchParams,
}))
mock.module("@/hooks/use-billing-data", () => ({
  useAdminAddonQuery: mockAddonQuery,
}))
mock.module("@/lib/billing-client", () => ({
  billingPeriodLabel: (period: string) => period,
}))
mock.module("sonner", () => ({
  toast: { success: mock(), error: mock() },
}))

const { default: AddonEditorPage } = await import("./page")

describe("AddonEditorPage local draft behavior", () => {
  beforeEach(() => {
    localStorage.clear()
    mockUseParams.mockReturnValue({ lang: "en", addonCode: "EXTRA_STORAGE" })
  })

  it("persists archive state and restores it from the local draft after reload", async () => {
    const firstView = render(<AddonEditorPage />)

    await waitFor(() =>
      expect(firstView.getByText("Extra storage")).toBeTruthy()
    )
    fireEvent.click(firstView.getByRole("button", { name: "Archive" }))
    const archiveActions = firstView.getAllByRole("button", { name: "Archive" })
    fireEvent.click(archiveActions.at(-1)!)

    await waitFor(() => {
      expect(
        JSON.parse(localStorage.getItem("addon-draft-EXTRA_STORAGE")!).isActive
      ).toBe(false)
    })
    firstView.unmount()

    const reloadedView = render(<AddonEditorPage />)
    await waitFor(() => expect(reloadedView.getByText("Inactive")).toBeTruthy())
  })
  it("restores a valid local draft over server data and persists edits", async () => {
    const savedDraft = {
      id: "addon-1",
      code: "EXTRA_STORAGE",
      name: "Draft storage",
      description: "Saved locally",
      billingMode: "RECURRING",
      isActive: true,
      prices: [],
    }
    localStorage.setItem(
      "addon-draft-EXTRA_STORAGE",
      JSON.stringify(savedDraft)
    )

    const view = render(<AddonEditorPage />)

    await waitFor(() =>
      expect(view.getByRole("heading", { name: "Draft storage" })).toBeTruthy()
    )
    fireEvent.change(view.getByLabelText("Name *"), {
      target: { value: "Updated storage" },
    })
    fireEvent.click(view.getByRole("button", { name: "Save draft" }))

    await waitFor(() => {
      expect(
        JSON.parse(localStorage.getItem("addon-draft-EXTRA_STORAGE")!).name
      ).toBe("Updated storage")
    })
  })

  it("ignores malformed local drafts and renders the server addon", async () => {
    localStorage.setItem("addon-draft-EXTRA_STORAGE", "not-json")

    const view = render(<AddonEditorPage />)

    await waitFor(() =>
      expect(view.getByRole("heading", { name: "Extra storage" })).toBeTruthy()
    )
  })
})

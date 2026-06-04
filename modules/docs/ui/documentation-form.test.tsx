import { describe, expect, it, beforeEach, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DocumentationForm } from "./documentation-form"

describe("DocumentationForm", () => {
  it("renders all form fields", () => {
    const view = render(<DocumentationForm />)

    expect(view.getByLabelText("Path")).toBeInTheDocument()
    expect(view.getByLabelText("Title")).toBeInTheDocument()
    expect(view.getByLabelText("Purpose")).toBeInTheDocument()
    expect(view.getByLabelText("How To (one step per line)")).toBeInTheDocument()
    expect(view.getByLabelText("Notes (optional, one item per line)")).toBeInTheDocument()
    expect(view.getByText("Save Documentation")).toBeInTheDocument()
  })

  it("renders with default path value", () => {
    const view = render(<DocumentationForm />)

    const path = view.getByLabelText("Path") as HTMLInputElement
    expect(path.value).toBe("/console")
  })

  it("renders submit button as enabled by default", () => {
    const view = render(<DocumentationForm />)
    const button = view.getByText("Save Documentation").closest("button")
    expect(button).not.toBeDisabled()
  })

  it("renders with empty title and purpose", () => {
    const view = render(<DocumentationForm />)

    expect((view.getByLabelText("Title") as HTMLInputElement).value).toBe("")
    expect((view.getByLabelText("Purpose") as HTMLTextAreaElement).value).toBe("")
  })

  it("resets fields when selected documentation changes", () => {
    const firstDoc = {
      path: "/console",
      title: "Console Overview",
      purpose: "Understand the console.",
      howTo: ["Open console", "Review cards"],
      notes: ["Internal users only"],
    }
    const secondDoc = {
      path: "/portal/billing",
      title: "Billing",
      purpose: "Manage billing.",
      howTo: ["Open billing", "Review usage"],
      notes: ["Requires active workspace"],
    }

    const view = render(<DocumentationForm initialData={firstDoc} />)

    expect(view.getByLabelText("Path")).toHaveValue("/console")
    expect(view.getByLabelText("Title")).toHaveValue("Console Overview")
    expect(view.getByLabelText("Purpose")).toHaveValue(
      "Understand the console."
    )
    expect(view.getByLabelText("How To (one step per line)")).toHaveValue(
      "Open console\nReview cards"
    )
    expect(
      view.getByLabelText("Notes (optional, one item per line)")
    ).toHaveValue("Internal users only")

    view.rerender(<DocumentationForm initialData={secondDoc} />)

    expect(view.getByLabelText("Path")).toHaveValue("/portal/billing")
    expect(view.getByLabelText("Title")).toHaveValue("Billing")
    expect(view.getByLabelText("Purpose")).toHaveValue("Manage billing.")
    expect(view.getByLabelText("How To (one step per line)")).toHaveValue(
      "Open billing\nReview usage"
    )
    expect(
      view.getByLabelText("Notes (optional, one item per line)")
    ).toHaveValue("Requires active workspace")
  })

  describe("form submission", () => {
    const fetchMock = mock()

    beforeEach(() => {
      fetchMock.mockClear()
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, path: "/console/test" }),
      })
      global.fetch = fetchMock as unknown as typeof global.fetch
    })

    it("shows error when submitting with empty required fields", async () => {
      const user = userEvent.setup()
      const view = render(<DocumentationForm />)
      await user.click(view.getByText("Save Documentation"))
      expect(
        view.getByText("Path, title, and purpose are required.")
      ).toBeInTheDocument()
    })

    it("shows error when title and purpose are filled but no how-to steps", async () => {
      const user = userEvent.setup()
      const view = render(<DocumentationForm />)
      await user.type(view.getByLabelText("Title"), "Test Title")
      await user.type(view.getByLabelText("Purpose"), "Test Purpose")
      await user.click(view.getByText("Save Documentation"))
      expect(
        view.getByText("Provide at least one how-to step.")
      ).toBeInTheDocument()
    })

    it("shows success message on successful submission", async () => {
      const user = userEvent.setup()
      const view = render(<DocumentationForm />)
      await user.type(view.getByLabelText("Title"), "Test Title")
      await user.type(view.getByLabelText("Purpose"), "Test Purpose")
      await user.type(
        view.getByLabelText("How To (one step per line)"),
        "Step 1\nStep 2"
      )
      await user.click(view.getByText("Save Documentation"))

      await waitFor(() => {
        expect(view.getByText(/Documentation saved/)).toBeInTheDocument()
      })
    })

    it("shows error on server error response", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ ok: false, message: "Server error occurred" }),
      })
      const user = userEvent.setup()
      const view = render(<DocumentationForm />)
      await user.type(view.getByLabelText("Title"), "Title")
      await user.type(view.getByLabelText("Purpose"), "Purpose")
      await user.type(
        view.getByLabelText("How To (one step per line)"),
        "Step 1"
      )
      await user.click(view.getByText("Save Documentation"))

      await waitFor(() => {
        expect(view.getByText("Server error occurred")).toBeInTheDocument()
      })
    })

    it("shows network error when fetch rejects", async () => {
      fetchMock.mockRejectedValue(new Error("Network failure"))
      const user = userEvent.setup()
      const view = render(<DocumentationForm />)
      await user.type(view.getByLabelText("Title"), "Title")
      await user.type(view.getByLabelText("Purpose"), "Purpose")
      await user.type(
        view.getByLabelText("How To (one step per line)"),
        "Step 1"
      )
      await user.click(view.getByText("Save Documentation"))

      await waitFor(() => {
        expect(
          view.getByText("Network error while saving documentation.")
        ).toBeInTheDocument()
      })
    })

    it("shows loading state on button while submitting", async () => {
      // Use a deferred promise to keep isSubmitting=true
      let deferredResolve!: (value: unknown) => void
      const deferredPromise = new Promise((resolve) => {
        deferredResolve = resolve
      })
      fetchMock.mockReturnValue(deferredPromise)

      const user = userEvent.setup()
      const view = render(<DocumentationForm />)
      await user.type(view.getByLabelText("Title"), "Title")
      await user.type(view.getByLabelText("Purpose"), "Purpose")
      await user.type(
        view.getByLabelText("How To (one step per line)"),
        "Step 1"
      )
      await user.click(view.getByText("Save Documentation"))

      await waitFor(() => {
        expect(view.getByText("Saving...")).toBeInTheDocument()
      })

      const button = view.getByText("Saving...").closest("button")
      expect(button).toBeDisabled()

      // Resolve the deferred fetch to avoid hanging promises
      deferredResolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, path: "/console/test" }),
      })

      await waitFor(() => {
        expect(view.getByText(/Documentation saved/)).toBeInTheDocument()
      })
    })
  })
})

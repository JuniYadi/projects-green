import { beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor, type RenderResult } from "@testing-library/react"

let currentQuery = ""
const replaceCalls: string[] = []

const updateQueryFromUrl = (url: string) => {
  const parts = url.split("?")
  currentQuery = parts[1] ?? ""
}

mock.module("next/navigation", () => {
  return {
    usePathname: () => "/console/app/deploy",
    useSearchParams: () => new URLSearchParams(currentQuery),
    useRouter: () => ({
      replace: (url: string) => {
        replaceCalls.push(url)
        updateQueryFromUrl(url)
      },
    }),
  }
})

const renderWizard = async (query = "") => {
  currentQuery = query
  replaceCalls.splice(0)
  window.sessionStorage.clear()

  const wizardModule = await import("@/modules/deploy/ui/deploy-wizard")

  return render(<wizardModule.DeployWizard />)
}

const selectSourceRepository = (view: RenderResult) => {
  fireEvent.change(view.getByLabelText("Owner selector"), {
    target: { value: "owner-pfn" },
  })

  fireEvent.change(view.getByLabelText("Repository selector"), {
    target: { value: "repo-console-next" },
  })
}

describe("DeployWizard", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    currentQuery = ""
    replaceCalls.splice(0)
  })

  it("falls back to source step for invalid query", async () => {
    const view = await renderWizard("step=invalid")

    await waitFor(() => {
      expect(view.getByText("Source Code")).toBeTruthy()
    })
  })

  it("runs happy path from source to running status", async () => {
    const view = await renderWizard()

    selectSourceRepository(view)

    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByText("Manual override")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByText("Attached resources")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Deploy" }))

    await waitFor(
      () => {
        expect(view.getByText("Deployment live")).toBeTruthy()
      },
      { timeout: 8000 }
    )

    expect(view.getByRole("link", { name: "Visit App" })).toBeTruthy()
    expect(replaceCalls.some((value) => value.includes("step=monitor"))).toBe(
      true
    )
  })

  it("shows failure path with retry and edit settings actions", async () => {
    const view = await renderWizard()

    fireEvent.change(view.getByLabelText("Owner selector"), {
      target: { value: "owner-acme" },
    })

    fireEvent.change(view.getByLabelText("Repository selector"), {
      target: { value: "repo-failing-build" },
    })

    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByText("Manual override")).toBeTruthy()
    })

    fireEvent.click(view.getByLabelText("Use Dockerfile instead"))

    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByText("Attached resources")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Deploy" }))

    await waitFor(
      () => {
        expect(view.getByText("Deployment failed")).toBeTruthy()
      },
      { timeout: 8000 }
    )

    expect(view.getByRole("button", { name: "Retry" })).toBeTruthy()
    fireEvent.click(view.getByRole("button", { name: "Edit Settings" }))

    await waitFor(() => {
      expect(view.getByText("Attached resources")).toBeTruthy()
    })
  })

  it("preserves environment values when navigating back and forward", async () => {
    const view = await renderWizard()

    selectSourceRepository(view)
    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByText("Manual override")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByText("Attached resources")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Add variable" }))

    fireEvent.change(view.getByLabelText(/Environment key/), {
      target: { value: "API_KEY" },
    })
    fireEvent.change(view.getByLabelText(/Environment value/), {
      target: { value: "secret" },
    })

    await waitFor(() => {
      expect(view.getByDisplayValue("API_KEY")).toBeTruthy()
      expect(view.getByDisplayValue("secret")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Back" }))

    await waitFor(() => {
      expect(view.getByText("Manual override")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByRole("button", { name: "Remove" })).toBeTruthy()
    })
  })

  it("shows duplicate env var key warning", async () => {
    const view = await renderWizard()

    selectSourceRepository(view)
    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByText("Manual override")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByText("Attached resources")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Add variable" }))
    fireEvent.click(view.getByRole("button", { name: "Add variable" }))

    const keyInputs = view.getAllByLabelText(/Environment key/)

    fireEvent.change(keyInputs[0], { target: { value: "API_KEY" } })
    fireEvent.change(keyInputs[1], { target: { value: "api_key" } })

    expect(
      view.getByText("Environment variable keys must be unique.")
    ).toBeTruthy()

    const removeButtons = view.getAllByRole("button", { name: "Remove" })
    fireEvent.click(removeButtons[1])

    await waitFor(() => {
      expect(
        view.queryByText("Environment variable keys must be unique.")
      ).toBeNull()
    })
  })
})

import { beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor, type RenderResult } from "@testing-library/react"

let currentQuery = ""
const replaceCalls: string[] = []

const updateQueryFromUrl = (url: string) => {
  const parts = url.split("?")
  currentQuery = parts[1] ?? ""
}

const githubRepositories = [
  {
    repositoryId: "repo-console-next",
    fullName: "pfn-labs/console-next-app",
    name: "console-next-app",
    owner: "owner-pfn",
    installationId: 1,
    defaultBranch: "main",
    private: true,
  },
  {
    repositoryId: "repo-api-monolith",
    fullName: "pfn-labs/platform-api",
    name: "platform-api",
    owner: "owner-pfn",
    installationId: 1,
    defaultBranch: "master",
    private: true,
  },
  {
    repositoryId: "repo-storefront",
    fullName: "acme-inc/storefront",
    name: "storefront",
    owner: "owner-acme",
    installationId: 2,
    defaultBranch: "main",
    private: false,
  },
  {
    repositoryId: "repo-failing-build",
    fullName: "acme-inc/legacy-worker",
    name: "legacy-worker",
    owner: "owner-acme",
    installationId: 2,
    defaultBranch: "main",
    private: true,
  },
]

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

const selectSourceRepository = async (view: RenderResult) => {
  await waitFor(() => {
    expect(view.getByRole("option", { name: "owner-pfn" })).toBeTruthy()
  })

  fireEvent.change(view.getByLabelText("Owner selector"), {
    target: { value: "owner-pfn" },
  })

  await waitFor(() => {
    expect(
      view.getByRole("option", { name: "console-next-app" })
    ).toBeTruthy()
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
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      const url = new URL(requestUrl, "http://localhost")

      if (url.pathname !== "/api/integrations/github/repositories") {
        return Promise.resolve(new Response("Not found", { status: 404 }))
      }

      const ownerId = url.searchParams.get("ownerId")
      const query = url.searchParams.get("query")?.toLowerCase().trim() ?? ""

      const items = githubRepositories.filter((repository) => {
        const ownerMatch = ownerId ? repository.owner === ownerId : true
        if (!ownerMatch) {
          return false
        }

        if (!query) {
          return true
        }

        return (
          repository.name.toLowerCase().includes(query) ||
          repository.owner.toLowerCase().includes(query)
        )
      })

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, items }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    }) as typeof fetch
  })

  it("falls back to source step for invalid query", async () => {
    const view = await renderWizard("step=invalid")

    await waitFor(() => {
      expect(view.getByText("Source Code")).toBeTruthy()
    })
  })

  it("updates source step state while selecting owner, repository, and root directory", async () => {
    const view = await renderWizard()

    await waitFor(() => {
      expect(view.getByText("Pick an owner first.")).toBeTruthy()
    })

    fireEvent.change(view.getByLabelText("Owner selector"), {
      target: { value: "owner-pfn" },
    })

    await waitFor(() => {
      expect(view.getByText("Owner selected: owner-pfn")).toBeTruthy()
    })
    expect(view.getByText("Select a repository to continue.")).toBeTruthy()

    fireEvent.change(view.getByLabelText("Repository selector"), {
      target: { value: "repo-console-next" },
    })

    await waitFor(() => {
      expect(view.getByText("Repository selected: console-next-app")).toBeTruthy()
    })
    expect(view.getByText("Branch selected: main")).toBeTruthy()
    expect(view.getByRole("button", { name: "Next" })).toBeEnabled()

    fireEvent.change(view.getByLabelText("Root directory"), {
      target: { value: "/apps/web" },
    })

    await waitFor(() => {
      expect(
        view.getByText("Deploy from /apps/web. Ensure build files exist in this path.")
      ).toBeTruthy()
    })
  })

  it("runs happy path from source to running status", async () => {
    const view = await renderWizard()

    await selectSourceRepository(view)

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
  }, 15_000)

  it("shows failure path with retry and edit settings actions", async () => {
    const view = await renderWizard()

    await waitFor(() => {
      expect(view.getByRole("option", { name: "owner-acme" })).toBeTruthy()
    })

    fireEvent.change(view.getByLabelText("Owner selector"), {
      target: { value: "owner-acme" },
    })

    await waitFor(() => {
      expect(view.getByRole("option", { name: "legacy-worker" })).toBeTruthy()
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
  }, 15_000)

  it("preserves environment values when navigating back and forward", async () => {
    const view = await renderWizard()

    await selectSourceRepository(view)
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

    await selectSourceRepository(view)
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

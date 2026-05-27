import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  fireEvent,
  render,
  waitFor,
  type RenderResult,
} from "@testing-library/react"
import {
  DEPLOY_WIZARD_STORAGE_KEY,
  DEPLOY_WIZARD_STORAGE_VERSION,
} from "@/modules/deploy/deploy.constants"
import type { DeployWizardState } from "@/modules/deploy/deploy.types"

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
    redirect: (url: string) => {
      throw new Error(`REDIRECT:${url}`)
    },
    notFound: () => {
      throw new Error("NOT_FOUND")
    },
  }
})

const createPersistedState = (state: DeployWizardState) => {
  return JSON.stringify({
    version: DEPLOY_WIZARD_STORAGE_VERSION,
    state,
  })
}

const renderWizard = async (
  query = "github=connected",
  persistedState: DeployWizardState | null = null
) => {
  currentQuery = query
  replaceCalls.splice(0)
  window.sessionStorage.clear()
  if (persistedState) {
    window.sessionStorage.setItem(
      DEPLOY_WIZARD_STORAGE_KEY,
      createPersistedState(persistedState)
    )
  }

  const wizardModule = await import("@/modules/deploy/ui/deploy-wizard")
  const storeModule = await import("@/modules/deploy/deploy.store")

  return render(
    <storeModule.DeployWizardProvider>
      <wizardModule.DeployWizard />
    </storeModule.DeployWizardProvider>
  )
}

const selectSourceRepository = async (view: RenderResult) => {
  await waitFor(() => {
    expect(view.getByRole("button", { name: /owner-pfn/i })).toBeTruthy()
  })

  fireEvent.click(view.getByRole("button", { name: /owner-pfn/i }))

  await waitFor(() => {
    expect(view.getByRole("button", { name: /console-next-app/i })).toBeTruthy()
  })

  fireEvent.click(view.getByRole("button", { name: /console-next-app/i }))
}

describe("DeployWizard", () => {
  afterAll(() => {
    mock.restore()
  })

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
    }) as unknown as typeof fetch
  })

  it("falls back to source step for invalid query", async () => {
    const view = await renderWizard("step=invalid")

    await waitFor(() => {
      expect(view.getByText("Choose a pre-configured template to deploy instantly, or connect your GitHub account.")).toBeTruthy()
    })
  })

  it("updates source step state while selecting owner, repository, and root directory", async () => {
    const view = await renderWizard()

    await waitFor(() => {
      expect(view.queryByText(/Select Repository/i)).toBeNull()
    })

    fireEvent.click(view.getByRole("button", { name: /owner-pfn/i }))

    await waitFor(() => {
      expect(view.getByText(/Select Repository/i)).toBeTruthy()
    })

    await waitFor(() => {
      expect(
        view.getByRole("button", { name: /console-next-app/i })
      ).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: /console-next-app/i }))

    await waitFor(() => {
      expect(view.getByRole("button", { name: /^main$/ })).toBeTruthy()
    })
    expect(view.getByRole("button", { name: "Next Step" })).toBeEnabled()

    fireEvent.change(view.getByLabelText("Root directory"), {
      target: { value: "/apps/web" },
    })

    await waitFor(() => {
      expect(view.getByDisplayValue("/apps/web")).toBeTruthy()
    })
  })

  it("runs happy path from source to running status", async () => {
    const view = await renderWizard()

    await selectSourceRepository(view)

    fireEvent.click(view.getByRole("button", { name: "Next Step" }))

    // High confidence skips the Build step and goes directly to Environment!
    await waitFor(() => {
      expect(view.getByText("Environment Settings")).toBeTruthy()
    })
    expect(view.getByText("Build Configuration")).toBeTruthy()
    expect(view.getByText("Next.js")).toBeTruthy()

    fireEvent.click(view.getByRole("button", { name: "Deploy Application" }))

    await waitFor(() => {
      expect(view.getByText("Status timeline")).toBeTruthy()
      expect(view.getByText("Build and runtime logs")).toBeTruthy()
      expect(view.getByText("Result state")).toBeTruthy()
    })

    await waitFor(
      () => {
        expect(view.getByText("Deployment live")).toBeTruthy()
      },
      { timeout: 8000 }
    )

    expect(view.getByText("Monitor step complete.")).toBeTruthy()
    expect(view.getByText(/Attempt 1 finished successfully\./)).toBeTruthy()
    expect(view.getByText("Stream: Deployment finished.")).toBeTruthy()

    fireEvent.click(view.getByRole("button", { name: "Show logs" }))
    await waitFor(() => {
      expect(
        view.getByText("[runtime] Attempt 1: deployment passed health checks.")
      ).toBeTruthy()
    })

    expect(view.getByRole("link", { name: "Visit App" })).toBeTruthy()
    expect(replaceCalls.some((value) => value.includes("step=monitor"))).toBe(
      true
    )
  }, 15_000)

  it("shows failure path with retry and edit settings actions", async () => {
    const view = await renderWizard()

    await waitFor(() => {
      expect(view.getByRole("button", { name: /owner-acme/i })).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: /owner-acme/i }))

    await waitFor(() => {
      expect(view.getByRole("button", { name: /legacy-worker/i })).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: /legacy-worker/i }))

    fireEvent.click(view.getByRole("button", { name: "Next Step" }))

    // Fails auto-detection, so goes to Build step!
    await waitFor(() => {
      expect(view.getByText("Manual override")).toBeTruthy()
    })
    expect(
      view.getByText(
        "Detection failed. Add manual build settings or enable Dockerfile."
      )
    ).toBeTruthy()
    expect(view.getByRole("button", { name: "Next" })).toBeDisabled()
    expect(view.getByText("Build settings need attention")).toBeTruthy()
    expect(view.getByText("Select a language.")).toBeTruthy()
    expect(view.getByText("Select a framework.")).toBeTruthy()
    expect(view.getByText("Enter a build command.")).toBeTruthy()
    expect(view.getByLabelText("Build command")).toBeEnabled()

    fireEvent.click(view.getByLabelText("Use Dockerfile instead"))
    await waitFor(() => {
      expect(view.getByLabelText("Build command")).toBeDisabled()
      expect(
        view.getByText("Ready: deployment will use your Dockerfile.")
      ).toBeTruthy()
      expect(view.getByRole("button", { name: "Next" })).toBeEnabled()
    })

    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByText(/Attached Resources/i)).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Deploy Application" }))

    await waitFor(
      () => {
        expect(view.getByText("Deployment failed")).toBeTruthy()
      },
      { timeout: 8000 }
    )

    expect(view.getByText("Monitor step complete.")).toBeTruthy()
    expect(view.getByText("Stream: Deployment finished.")).toBeTruthy()
    expect(
      view.getByText(
        "[runtime] Attempt 1: rollout failed during health checks."
      )
    ).toBeTruthy()

    expect(view.getByRole("button", { name: "Retry" })).toBeTruthy()
    fireEvent.click(view.getByRole("button", { name: "Edit Settings" }))

    await waitFor(() => {
      expect(view.getByText(/Attached Resources/i)).toBeTruthy()
    })
  }, 15_000)

  it("retries failed monitor run and completes on second attempt", async () => {
    const view = await renderWizard()

    await waitFor(() => {
      expect(view.getByRole("button", { name: /owner-acme/i })).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: /owner-acme/i }))

    await waitFor(() => {
      expect(view.getByRole("button", { name: /legacy-worker/i })).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: /legacy-worker/i }))

    fireEvent.click(view.getByRole("button", { name: "Next Step" }))

    await waitFor(() => {
      expect(view.getByText("Manual override")).toBeTruthy()
    })

    fireEvent.click(view.getByLabelText("Use Dockerfile instead"))
    await waitFor(() => {
      expect(view.getByRole("button", { name: "Next" })).toBeEnabled()
    })

    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByText(/Attached Resources/i)).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Deploy Application" }))

    await waitFor(
      () => {
        expect(view.getByText("Deployment failed")).toBeTruthy()
      },
      { timeout: 8000 }
    )

    fireEvent.click(view.getByRole("button", { name: "Retry" }))

    await waitFor(() => {
      expect(view.getByText("Deployment in progress")).toBeTruthy()
      expect(view.getByText("Monitor step in progress.")).toBeTruthy()
    })

    await waitFor(
      () => {
        expect(view.getByText("Deployment live")).toBeTruthy()
      },
      { timeout: 8000 }
    )

    expect(view.getByText(/Attempt 2 finished successfully\./)).toBeTruthy()
    expect(view.getByText("Monitor step complete.")).toBeTruthy()
  }, 15_000)

  it("preserves environment settings when navigating back and forward", async () => {
    const view = await renderWizard()

    await selectSourceRepository(view)
    fireEvent.click(view.getByRole("button", { name: "Next Step" }))

    // High confidence goes to Environment first
    await waitFor(() => {
      expect(view.getByText("Environment Settings")).toBeTruthy()
    })

    // Click back goes to Build step (allowing editing auto-detected settings)
    fireEvent.click(view.getByRole("button", { name: "Back" }))

    await waitFor(() => {
      expect(view.getByText("Manual override")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(view.getByText(/Attached Resources/i)).toBeTruthy()
    })

    fireEvent.click(view.getByRole("radio", { name: /Pro/i }))

    await waitFor(() => {
      const proRadio = view.getByRole("radio", { name: /Pro/i }) as HTMLInputElement
      expect(proRadio.checked).toBe(true)
    })

    fireEvent.click(view.getByRole("button", { name: "Back" }))

    await waitFor(() => {
      expect(view.getByText("Manual override")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      const proRadio = view.getByRole("radio", { name: /Pro/i }) as HTMLInputElement
      expect(proRadio.checked).toBe(true)
    })
  })

  it("validates custom domain mode before deploy", async () => {
    const view = await renderWizard()

    await selectSourceRepository(view)
    fireEvent.click(view.getByRole("button", { name: "Next Step" }))

    await waitFor(() => {
      expect(view.getByText("Environment Settings")).toBeTruthy()
    })

    fireEvent.click(view.getByRole("radio", { name: /Custom domain/i }))

    await waitFor(() => {
      expect(view.getByRole("button", { name: "Deploy Application" })).toBeDisabled()
      expect(
        view.getAllByText(
          "Custom domain is required when generated subdomain is off."
        ).length
      ).toBeGreaterThan(0)
    })

    fireEvent.click(view.getByRole("radio", { name: /Managed subdomain/i }))

    await waitFor(() => {
      expect(view.getByRole("button", { name: "Deploy Application" })).toBeEnabled()
    })
  })

  it("shows duplicate env var key warning", async () => {
    const view = await renderWizard("step=environment&github=connected", {
      step: "environment",
      source: {
        sourceType: "github",
        ownerId: "owner-pfn",
        repositoryId: "repo-console-next",
        branchName: "main",
        rootDirectory: "/",
      },
      detectionResult: {
        language: "Node.js",
        framework: "Next.js",
        dockerfileDetected: false,
        buildCommand: "bun run build",
        confidence: 91,
        status: "success",
      },
      build: {
        language: "Node.js",
        framework: "Next.js",
        buildCommand: "bun run build",
        useDockerfile: false,
      },
      environment: {
        useGeneratedSubdomain: true,
        customDomain: "",
        envVars: [
          { id: "env-1", key: "API_KEY", value: "secret-1" },
          { id: "env-2", key: "api_key", value: "secret-2" },
        ],
        resourcePlanId: "starter",
        cpu: 100,
        memory: 256,
      },
      monitor: {
        status: "idle",
        logScope: "all",
        attempt: 0,
        tick: 0,
        isActive: false,
        shouldFail: false,
        failureReason: null,
      },
    })

    await waitFor(() => {
      expect(view.getByText(/Attached Resources/i)).toBeTruthy()
    })

    expect(
      view.getAllByText("Environment variable keys must be unique.").length
    ).toBeGreaterThan(0)
  })
})

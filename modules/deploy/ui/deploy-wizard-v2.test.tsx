import { beforeEach, describe, expect, it, mock } from "bun:test"
import { fireEvent, render, waitFor } from "@testing-library/react"

mock.module("@/modules/deploy/ui/step-environment-v2", () => ({
  StepEnvironmentV2: () => null,
}))
mock.module("@/modules/deploy/ui/step-monitor-v2", () => ({
  StepMonitorV2: () => null,
}))

const account = {
  id: "credential-acme",
  githubInstallationId: 42,
  accountLogin: "acme",
  accountType: "Organization",
  targetType: "Organization",
  installedAt: "2026-01-01T00:00:00.000Z",
}

const repositories = {
  ok: true,
  items: [
    {
      repositoryId: "repo-acme",
      name: "storefront",
      owner: "acme",
      defaultBranch: "main",
      private: true,
      installationId: "42",
    },
  ],
}

const detectionResponse = {
  ok: true,
  primaryFramework: {
    id: "nextjs",
    name: "Next.js",
    ecosystem: "node",
    confidence: 0.95,
    reasons: ["package.json"],
  },
  requiredDependencies: [],
  alternatives: [],
  confidence: 0.95,
  decision: {
    status: "success",
    message: "ok",
    isLaunchable: true,
  },
  evidence: [{ type: "file", value: "package.json", detail: "detected" }],
  warnings: [],
  source: { repoUrl: "https://github.com/acme/storefront" },
  frameworkVersion: "14",
  defaultPort: 3000,
}

let accountResponse: { ok: boolean; accounts: (typeof account)[] }
let requests: string[]

beforeEach(() => {
  window.sessionStorage.clear()
  requests = []
  accountResponse = { ok: true, accounts: [account] }
  globalThis.fetch = mock((input: RequestInfo | URL) => {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    requests.push(requestUrl)
    const url = new URL(requestUrl, "http://localhost")

    if (url.pathname === "/api/integrations/github/accounts") {
      return Promise.resolve(
        new Response(JSON.stringify(accountResponse), { status: 200 })
      )
    }

    if (url.pathname === "/api/integrations/github/repositories") {
      return Promise.resolve(
        new Response(JSON.stringify(repositories), { status: 200 })
      )
    }

    if (url.pathname === "/api/framework-detection/github") {
      return Promise.resolve(
        new Response(JSON.stringify(detectionResponse), { status: 200 })
      )
    }

    throw new Error(`Unexpected request: ${requestUrl}`)
  }) as unknown as typeof fetch
})

describe("DeployWizardV2 GitHub accounts", () => {
  it("selects AppCredential account and scopes repository request to it", async () => {
    const { DeployWizardProvider } =
      await import("@/modules/deploy/deploy.store")
    const { DeployWizardV2 } =
      await import("@/modules/deploy/ui/deploy-wizard-v2")

    const view = render(
      <DeployWizardProvider>
        <DeployWizardV2 />
      </DeployWizardProvider>
    )

    await waitFor(() => {
      expect(view.getByText("storefront")).toBeInTheDocument()
    })
    expect(
      view.getByRole("navigation", { name: "Deploy wizard steps" })
    ).toBeTruthy()
    expect(
      view.getByRole("button", { name: /Source Choose code location/ })
    ).toBeTruthy()
    expect(
      view.getByRole("button", { name: /Connect Pick repository/ })
    ).toBeTruthy()
    expect(view.getByRole("button", { name: /Detect AI scans/ })).toBeTruthy()
    expect(
      view.getByRole("button", { name: /Review Confirm build/ })
    ).toBeTruthy()
    expect(
      view.getByRole("button", { name: /Deploy Watch it go live/ })
    ).toBeTruthy()

    expect((view.getByRole("combobox") as HTMLSelectElement).value).toBe("acme")
    const repositoryRequest = requests.find((request) =>
      request.includes("/api/integrations/github/repositories")
    )
    expect(repositoryRequest).toBeTruthy()
    expect(
      new URL(repositoryRequest ?? "", "http://localhost").searchParams.get(
        "ownerId"
      )
    ).toBe("acme")
  })

  it("shows Connect GitHub when accounts response is empty", async () => {
    accountResponse = { ok: true, accounts: [] }
    const { DeployWizardProvider } =
      await import("@/modules/deploy/deploy.store")
    const { DeployWizardV2 } =
      await import("@/modules/deploy/ui/deploy-wizard-v2")

    const view = render(
      <DeployWizardProvider>
        <DeployWizardV2 />
      </DeployWizardProvider>
    )

    await waitFor(() => {
      expect(
        view.getByRole("button", { name: "Connect GitHub" })
      ).toBeInTheDocument()
    })
  })

  it("detects framework after selecting a repository", async () => {
    const { DeployWizardProvider } =
      await import("@/modules/deploy/deploy.store")
    const { DeployWizardV2 } =
      await import("@/modules/deploy/ui/deploy-wizard-v2")

    const view = render(
      <DeployWizardProvider>
        <DeployWizardV2 />
      </DeployWizardProvider>
    )
    await Promise.resolve()

    const repositoryButton = await view.findByRole("button", {
      name: /storefront/,
    })
    fireEvent.click(repositoryButton)

    await waitFor(() => {
      expect(
        requests.some((request) =>
          request.includes("/api/framework-detection/github")
        )
      ).toBe(true)
    })

    fireEvent.click(view.getByRole("button", { name: /Detect AI scans/ }))
    expect(view.getByText("Detect build settings")).toBeInTheDocument()
  })

  it("detects framework when detect is entered with a selected repository", async () => {
    const { DeployWizardProvider } =
      await import("@/modules/deploy/deploy.store")
    const { DeployWizardV2 } =
      await import("@/modules/deploy/ui/deploy-wizard-v2")

    const view = render(
      <DeployWizardProvider>
        <DeployWizardV2 />
      </DeployWizardProvider>
    )

    const repositoryButton = await view.findByRole("button", {
      name: /storefront/,
    })
    fireEvent.click(repositoryButton)

    await waitFor(() => {
      expect(
        requests.some((request) =>
          request.includes("/api/framework-detection/github")
        )
      ).toBe(true)
    })

    fireEvent.click(view.getByRole("button", { name: /Detect AI scans/ }))

    expect(view.getByText("Detect build settings")).toBeInTheDocument()
  })
})

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
let recentSourcesResponse = { ok: true, data: [] as unknown[] }
let requests: string[]
let requestBodies: Array<{ url: string; body?: string }>

beforeEach(() => {
  window.sessionStorage.clear()
  accountResponse = { ok: true, accounts: [account] }
  requests = []
  requestBodies = []
  recentSourcesResponse = { ok: true, data: [] }
  globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    requests.push(requestUrl)
    requestBodies.push({
      url: requestUrl,
      body: typeof init?.body === "string" ? init.body : undefined,
    })
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

    if (url.pathname === "/api/framework-detection") {
      return Promise.resolve(
        new Response(JSON.stringify(detectionResponse), { status: 200 })
      )
    }

    if (url.pathname === "/api/deploy/recent-sources") {
      return Promise.resolve(
        new Response(JSON.stringify(recentSourcesResponse), { status: 200 })
      )
    }
    if (url.pathname === "/api/deploy/submit") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            data: { deploymentId: "public-test", status: "queued" },
          }),
          { status: 200 }
        )
      )
    }

    throw new Error(`Unexpected request: ${requestUrl}`)
  }) as unknown as typeof fetch
})

describe("DeployWizardV2 customer phases", () => {
  it("maps five internal steps to three non-clickable phases", async () => {
    const { DEPLOY_PHASES, DEPLOY_STEP_ORDER, getDeployPhase } =
      await import("@/modules/deploy/deploy.constants")

    expect(DEPLOY_PHASES.map((phase) => phase.label)).toEqual([
      "Source Intake",
      "Deploy Plan",
      "Live",
    ])
    expect(DEPLOY_STEP_ORDER).toEqual([
      "source",
      "connect",
      "detect",
      "review",
      "deploy",
    ])
    expect(getDeployPhase("source")).toBe("source")
    expect(getDeployPhase("connect")).toBe("source")
    expect(getDeployPhase("detect")).toBe("plan")
    expect(getDeployPhase("review")).toBe("plan")
    expect(getDeployPhase("deploy")).toBe("live")
  })
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
      view.getByRole("navigation", { name: "Deploy wizard phases" })
    ).toBeTruthy()
    expect(view.getAllByText("Source Intake").length).toBeGreaterThan(0)
    expect(view.getByText("Deploy Plan")).toBeInTheDocument()
    expect(view.getByText("Live")).toBeInTheDocument()
    expect(
      view.queryByRole("button", { name: /Source Intake/ })
    ).not.toBeInTheDocument()
    expect(
      view.queryByRole("button", { name: /Deploy Plan/ })
    ).not.toBeInTheDocument()
    expect(
      view.queryByRole("button", { name: /^Live$/ })
    ).not.toBeInTheDocument()
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

  it("loads honest recent sources without blocking source selection", async () => {
    recentSourcesResponse = {
      ok: true,
      data: [
        {
          sourceType: "public",
          label: "docs",
          publicSourceUrl: "https://gitlab.com/acme/docs",
          publicSourceRef: "main",
          rootDirectory: "/",
        },
      ],
    }
    const { DeployWizardProvider } =
      await import("@/modules/deploy/deploy.store")
    const { DeployWizardV2 } =
      await import("@/modules/deploy/ui/deploy-wizard-v2")

    const view = render(
      <DeployWizardProvider>
        <DeployWizardV2 />
      </DeployWizardProvider>
    )

    await waitFor(() => expect(view.getByText("Recent")).toBeInTheDocument())
    expect(view.getByText("docs")).toBeInTheDocument()
    expect(
      requests.some((request) =>
        request.includes("/api/deploy/recent-sources?limit=3")
      )
    ).toBe(true)
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

    const repositoryButton = await view.findByRole("option", {
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

    fireEvent.click(view.getByRole("button", { name: "Next" }))
    fireEvent.click(view.getByRole("button", { name: "Continue to detection" }))
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

    const repositoryButton = await view.findByRole("option", {
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

    fireEvent.click(view.getByRole("button", { name: "Next" }))
    fireEvent.click(view.getByRole("button", { name: "Continue to detection" }))
    expect(view.getByText("Detect build settings")).toBeInTheDocument()
  })
  it("uses public detector for public source without guessing a framework", async () => {
    const {
      DeployWizardProvider,
      createInitialDeployWizardState,
      serializeDeployWizardState,
    } = await import("@/modules/deploy/deploy.store")
    const { DEPLOY_WIZARD_STORAGE_KEY } =
      await import("@/modules/deploy/deploy.constants")
    const state = createInitialDeployWizardState()
    state.step = "detect"
    state.source = {
      ...state.source,
      sourceType: "public",
      publicSourceUrl: "https://gitlab.com/group/project",
      publicSourceRef: "release",
      appName: "project",
    }
    window.sessionStorage.setItem(
      DEPLOY_WIZARD_STORAGE_KEY,
      serializeDeployWizardState(state)
    )

    const { DeployWizardV2 } =
      await import("@/modules/deploy/ui/deploy-wizard-v2")
    const view = render(
      <DeployWizardProvider>
        <DeployWizardV2 />
      </DeployWizardProvider>
    )

    await waitFor(() => {
      expect(view.getByText("Detect build settings")).toBeInTheDocument()
      expect(requests).toContain("/api/framework-detection")
    })
    expect(requests).not.toContain("/api/framework-detection/github")
    const publicRequest = requestBodies.find((request) =>
      request.url.includes("/api/framework-detection")
    )
    expect(publicRequest?.body).toBe(
      JSON.stringify({
        repoUrl: "https://gitlab.com/group/project",
        ref: "release",
        subdir: "/",
      })
    )
    expect(requests).not.toContain("/api/framework-detection/github")
  })

  it("one transient failure then success makes exactly two requests and renders result", async () => {
    const { DeployWizardProvider } =
      await import("@/modules/deploy/deploy.store")
    const { DeployWizardV2 } =
      await import("@/modules/deploy/ui/deploy-wizard-v2")

    let requestCount = 0
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
        requestCount++
        if (requestCount === 1) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: false,
                error: "DETECTION_TRANSIENT_PROVIDER_ERROR",
                message: "Detection provider temporarily unavailable.",
              }),
              { status: 503 }
            )
          )
        }
        return Promise.resolve(
          new Response(JSON.stringify(detectionResponse), { status: 200 })
        )
      }

      throw new Error(`Unexpected request: ${requestUrl}`)
    }) as unknown as typeof fetch

    const view = render(
      <DeployWizardProvider>
        <DeployWizardV2 />
      </DeployWizardProvider>
    )

    const repositoryButton = await view.findByRole("option", {
      name: /storefront/,
    })
    fireEvent.click(repositoryButton)

    await waitFor(
      () => {
        const detectionRequests = requests.filter((r) =>
          r.includes("/api/framework-detection/github")
        )
        expect(detectionRequests.length).toBe(2)
      },
      { timeout: 5000 }
    )
    fireEvent.click(view.getByRole("button", { name: "Next" }))
    fireEvent.click(view.getByRole("button", { name: "Continue to detection" }))
    expect(view.getByText("Detect build settings")).toBeInTheDocument()
  })
  it("permanent failure makes exactly one request and renders manual fallback", async () => {
    const { DeployWizardProvider } =
      await import("@/modules/deploy/deploy.store")
    const { DeployWizardV2 } =
      await import("@/modules/deploy/ui/deploy-wizard-v2")

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
          new Response(
            JSON.stringify({
              ok: false,
              error: "DETECTION_CONFIG_ERROR",
              message:
                "Detection is not configured. Configure build settings manually.",
            }),
            { status: 422 }
          )
        )
      }

      throw new Error(`Unexpected request: ${requestUrl}`)
    }) as unknown as typeof fetch

    const view = render(
      <DeployWizardProvider>
        <DeployWizardV2 />
      </DeployWizardProvider>
    )
    const repositoryButton = await view.findByRole("option", {
      name: /storefront/,
    })
    fireEvent.click(repositoryButton)

    await waitFor(
      () => {
        const detectionRequests = requests.filter((r) =>
          r.includes("/api/framework-detection/github")
        )
        expect(detectionRequests.length).toBe(1)
      },
      { timeout: 5000 }
    )
    fireEvent.click(view.getByRole("button", { name: "Next" }))
    fireEvent.click(view.getByRole("button", { name: "Continue to detection" }))

    expect(
      view.getAllByText(
        "Detection is not configured. Configure build settings manually."
      )[0]
    ).toBeInTheDocument()
    expect(view.getByLabelText("Language selector")).toBeInTheDocument()
    expect(
      view.queryByRole("button", { name: "Retry detection" })
    ).not.toBeInTheDocument()
  })

  it("abort does not retry detection", async () => {
    const { DeployWizardProvider } =
      await import("@/modules/deploy/deploy.store")
    const { DeployWizardV2 } =
      await import("@/modules/deploy/ui/deploy-wizard-v2")

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
        const controller = new AbortController()
        controller.abort()
        return Promise.reject(new DOMException("Aborted", "AbortError"))
      }

      throw new Error(`Unexpected request: ${requestUrl}`)
    }) as unknown as typeof fetch

    const view = render(
      <DeployWizardProvider>
        <DeployWizardV2 />
      </DeployWizardProvider>
    )

    const repositoryButton = await view.findByRole("option", {
      name: /storefront/,
    })
    fireEvent.click(repositoryButton)

    await waitFor(() => {
      const detectionRequests = requests.filter((r) =>
        r.includes("/api/framework-detection/github")
      )
      expect(detectionRequests.length).toBe(1)
    })
  })
})

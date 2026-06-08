import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

let currentQuery = ""
const replaceCalls: string[] = []

const updateQueryFromUrl = (url: string) => {
  const parts = url.split("?")
  currentQuery = parts[1] ?? ""
}

mock.module("next/navigation", () => {
  return {
    usePathname: () => "/console/app/manage",
    useSearchParams: () => new URLSearchParams(currentQuery),
    useRouter: () => ({
      replace: (url: string) => {
        replaceCalls.push(url)
        updateQueryFromUrl(url)
      },
    }),
  }
})

const sampleApp = {
  id: "stack-1",
  name: "console-next-app",
  slug: "console-next-app",
  status: "running",
  framework: "Next.js",
  branchName: "main",
  subdomain: "console-next-app.pfn.app",
  customDomain: null,
  resourcePlanId: "payg",
  billingMode: "PAYG",
  billingState: "ACTIVE",
  lastDeployedAt: "2026-06-05T10:00:00.000Z",
  latestDeploymentId: "deploy-1",
}

const sampleDeployment = {
  id: "deploy-1",
  status: "running",
  attempt: 1,
  manifestPushed: true,
  argocdSynced: true,
  failureReason: null,
  startedAt: null,
  completedAt: null,
}

let appsResponse: { ok: boolean; data: unknown[] } = { ok: true, data: [] }

const installFetch = () => {
  globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
    const requestInit = init
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const url = new URL(requestUrl, "http://localhost")

    if (url.pathname === "/api/deploy/apps") {
      return Promise.resolve(
        new Response(JSON.stringify(appsResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    }

    if (url.pathname.startsWith("/api/deploy/apps/")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            data: { stack: sampleApp, latestDeployment: sampleDeployment },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    }

    if (url.pathname.startsWith("/api/deploy/events/")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ ok: true, data: [], events: [] }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    }

    if (url.pathname.startsWith("/api/deploy/logs/")) {
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    }

    if (
      url.pathname === "/api/framework-detection/github" &&
      requestInit?.method === "POST"
    ) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            primaryFramework: {
              id: "nextjs",
              name: "Next.js",
              ecosystem: "node",
              confidence: 95,
              reasons: ["Detected package.json dependencies"],
            },
            requiredDependencies: [],
            alternatives: [],
            confidence: 95,
            decision: {
              status: "success",
              message: "Detected with high confidence",
              isLaunchable: true,
            },
            evidence: [],
            warnings: [],
            source: { repoUrl: "pfn-labs/unknown" },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      )
    }

    return Promise.resolve(new Response("Not found", { status: 404 }))
  }) as unknown as typeof fetch
}

let cachedPageModule:
  | typeof import("@/app/[lang]/console/app/manage/page")
  | null = null

const renderPage = async (query = "") => {
  currentQuery = query
  replaceCalls.splice(0)
  cachedPageModule = null

  cachedPageModule = await import("@/app/[lang]/console/app/manage/page")
  return render(<cachedPageModule.default />)
}

describe("ManagePage", () => {
  beforeEach(() => {
    currentQuery = ""
    replaceCalls.splice(0)
    appsResponse = { ok: true, data: [] }
    installFetch()
  })

  it("renders the manage page shell", async () => {
    const view = await renderPage()
    expect(view.getByText("Manage Application")).toBeInTheDocument()
    expect(view.queryByText("Deploy Application")).not.toBeInTheDocument()
  })

  it("shows an honest empty state when there are no apps", async () => {
    const view = await renderPage()
    await waitFor(() => {
      expect(view.getByText("No applications yet")).toBeInTheDocument()
    })
  })

  it("renders real app status from the backend", async () => {
    appsResponse = { ok: true, data: [sampleApp] }
    const view = await renderPage()

    await waitFor(() => {
      expect(view.getAllByText("console-next-app").length).toBeGreaterThan(0)
    })

    expect(view.getByText("Deployment status")).toBeInTheDocument()
    expect(view.getByText("Visit app")).toBeInTheDocument()
  })

  it("surfaces an error state with retry when the apps request fails", async () => {
    appsResponse = { ok: false, data: [] }
    const view = await renderPage()

    await waitFor(() => {
      expect(view.getByRole("button", { name: "Retry" })).toBeInTheDocument()
    })
  })

  it("does not render the legacy resilience simulator", async () => {
    appsResponse = { ok: true, data: [sampleApp] }
    const view = await renderPage()

    await waitFor(() => {
      expect(view.getByText("Deployment status")).toBeInTheDocument()
    })

    expect(view.queryByText("Resilience Simulator")).not.toBeInTheDocument()
    expect(view.queryByText("Operations FAQ")).not.toBeInTheDocument()
  })

  it("syncs the selected app to the URL", async () => {
    appsResponse = { ok: true, data: [sampleApp] }
    await renderPage()

    await waitFor(() => {
      expect(replaceCalls.some((url) => url.includes("app=console-next-app"))).toBe(
        true
      )
    })
  })
})

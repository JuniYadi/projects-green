import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { AppMonitor } from "./app-monitor"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
}))

const mockStack: StackSummaryDTO = {
  id: "stack-1",
  name: "Hermes Comet",
  slug: "hermes-vibrant-comet",
  status: "running",
  framework: "Node.js",
  branchName: "main",
  sourceType: "TEMPLATE",
  templateId: "hermes",
  resourcePlanId: "starter",
  billingMode: "PAYG",
  billingState: "ACTIVE",
  subdomain: "hermes-vibrant-comet.pfnapp.dev",
  customDomain: null,
  lastDeployedAt: new Date().toISOString(),
  latestDeploymentId: "deploy-1",
  currentStepLabel: "Application live",
  currentStepIndex: 4,
  currentStepStartedAt: new Date().toISOString(),
}

describe("AppMonitor component", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders workspace action buttons (Settings & Env, Logs, Metrics)", () => {
    const { getByRole } = render(
      <AppMonitor
        stack={mockStack}
        deployment={null}
        logScope="all"
        onLogScopeChange={() => {}}
        locale="en"
      />
    )

    const settingsLink = getByRole("link", { name: /settings & env/i })
    expect(settingsLink.getAttribute("href")).toBe(
      "/en/console/app/settings?app=hermes-vibrant-comet&tab=env"
    )

    const logsLink = getByRole("link", { name: /^logs/i })
    expect(logsLink.getAttribute("href")).toBe(
      "/en/console/app/logs?app=hermes-vibrant-comet"
    )

    const metricsLink = getByRole("link", { name: /metrics/i })
    expect(metricsLink.getAttribute("href")).toBe(
      "/en/console/app/metrics?app=hermes-vibrant-comet"
    )
  })

  it("renders Open App button when subdomain is present", () => {
    const { getAllByRole } = render(
      <AppMonitor
        stack={mockStack}
        deployment={null}
        logScope="all"
        onLogScopeChange={() => {}}
        locale="en"
      />
    )

    const openAppLinks = getAllByRole("link", { name: /open app/i })
    expect(openAppLinks.length).toBeGreaterThan(0)
    expect(openAppLinks[0]?.getAttribute("href")).toBe(
      "https://hermes-vibrant-comet.pfnapp.dev"
    )
  })

  it("renders 2-column split-pane layout when deployment is present", () => {
    const { getByTestId } = render(
      <AppMonitor
        stack={mockStack}
        deployment={{
          id: "deploy-1",
          status: "building",
          attempt: 1,
          manifestPushed: false,
          argocdSynced: false,
          failureReason: null,
          startedAt: new Date().toISOString(),
          completedAt: null,
        }}
        logScope="all"
        onLogScopeChange={() => {}}
        locale="en"
      />
    )

    const workspace = getByTestId("deployment-split-workspace")
    expect(workspace).toBeInTheDocument()
  })

  it("renders no-deployments state when no deployId exists", () => {
    const stackNoDeploy = { ...mockStack, latestDeploymentId: null }
    const { getByText } = render(
      <AppMonitor
        stack={stackNoDeploy}
        deployment={null}
        logScope="all"
        onLogScopeChange={() => {}}
        locale="en"
      />
    )

    expect(getByText(/No deployments yet for this app/i)).toBeInTheDocument()
  })
})

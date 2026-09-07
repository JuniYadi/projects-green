import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
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
    expect(openAppLinks[0].getAttribute("href")).toBe(
      "https://hermes-vibrant-comet.pfnapp.dev"
    )
  })
})

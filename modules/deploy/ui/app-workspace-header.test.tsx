import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"
import { AppWorkspaceHeader } from "./app-workspace-header"
import type { StackSummaryDTO } from "../deploy-monitor.dto"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "id" }),
  useRouter: () => ({ push: () => {} }),
}))

const sampleTemplateApp: StackSummaryDTO = {
  id: "app-1",
  name: "9router App",
  slug: "app-9router",
  status: "running",
  framework: null,
  sourceType: "TEMPLATE",
  templateName: "9router",
  dockerVersion: "0.5.75",
  branchName: "main",
  subdomain: "app-9router.sg.pfnapp.dev",
  customDomain: "9router.custom.id",
  resourcePlanId: "medium",
  billingMode: "PAYG",
  billingState: "ACTIVE",
  lastDeployedAt: new Date().toISOString(),
  latestDeploymentId: "dep-1",
  currentStepLabel: "Application live",
  currentStepIndex: 12,
  currentStepStartedAt: new Date().toISOString(),
  cluster: {
    id: "cl-sg",
    name: "Singapore Production",
    code: "sgp",
    regionName: "Singapore",
    countryCode: "SG",
  },
}

const sampleGitApp: StackSummaryDTO = {
  ...sampleTemplateApp,
  id: "app-2",
  name: "Laravel Backend",
  slug: "laravel-backend",
  framework: "Laravel",
  sourceType: "GITHUB",
  templateName: null,
  dockerVersion: null,
  branchName: "production-v1",
  cluster: {
    id: "cl-jkt",
    name: "Jakarta Production",
    code: "jkt",
    regionName: "Indonesia",
    countryCode: "ID",
  },
}

describe("AppWorkspaceHeader", () => {
  it("renders source docker version, plan, and cluster with region flag for template apps", () => {
    const view = render(
      <AppWorkspaceHeader
        selectedApp={sampleTemplateApp}
        activeTab="overview"
      />
    )

    // Name & Template label
    expect(view.getByText("9router App")).toBeDefined()
    expect(view.getByText("9router (Template)")).toBeDefined()

    // Source version (not branch)
    expect(view.getByText("source")).toBeDefined()
    expect(view.getByText("v0.5.75")).toBeDefined()

    // Plan
    expect(view.getByText("medium")).toBeDefined()

    // Cluster with region
    expect(view.getByText("cluster")).toBeDefined()
    expect(view.getByText("Singapore")).toBeDefined()
    expect(view.getByText("(sgp)")).toBeDefined()
  })

  it("renders source git branch, plan, and cluster for git apps", () => {
    const view = render(
      <AppWorkspaceHeader selectedApp={sampleGitApp} activeTab="overview" />
    )

    // Framework
    expect(view.getByText("Laravel")).toBeDefined()

    // Source branch
    expect(view.getByText("source")).toBeDefined()
    expect(view.getByText("production-v1")).toBeDefined()

    // Cluster
    expect(view.getByText("Indonesia")).toBeDefined()
    expect(view.getByText("(jkt)")).toBeDefined()
  })
})

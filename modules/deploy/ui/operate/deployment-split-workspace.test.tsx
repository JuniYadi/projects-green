import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { DeploymentSplitWorkspace } from "./deployment-split-workspace"
import type {
  DeploymentStatusDTO,
  StackSummaryDTO,
} from "@/modules/deploy/deploy-monitor.dto"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
}))

const mockStack: StackSummaryDTO = {
  id: "stack-1",
  name: "Production App",
  slug: "prod-app",
  status: "building",
  framework: "Node.js",
  branchName: "main",
  sourceType: "GIT",
  templateId: null,
  resourcePlanId: "pro",
  billingMode: "PAYG",
  billingState: "ACTIVE",
  subdomain: "prod-app.pfnapp.dev",
  customDomain: null,
  lastDeployedAt: new Date().toISOString(),
  latestDeploymentId: "deploy-1",
  currentStepLabel: "Building application",
  currentStepIndex: 1,
  currentStepStartedAt: new Date().toISOString(),
}

const mockDeployment: DeploymentStatusDTO = {
  id: "deploy-1",
  status: "building",
  attempt: 2,
  manifestPushed: false,
  argocdSynced: false,
  failureReason: null,
  startedAt: new Date(Date.now() - 65000).toISOString(),
  completedAt: null,
}

describe("DeploymentSplitWorkspace", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the 2-column split-pane layout", () => {
    const view = render(
      <DeploymentSplitWorkspace
        stack={mockStack}
        deployment={mockDeployment}
        deployId="deploy-1"
        status="building"
        logScope="all"
        onLogScopeChange={() => {}}
        locale="en"
      />
    )

    const workspace = view.getByTestId("deployment-split-workspace")
    expect(workspace).toBeInTheDocument()
    expect(workspace.className).toContain("grid-cols-1")
    expect(workspace.className).toContain("lg:grid-cols-12")

    // Left column: metadata badges & timeline
    expect(view.getByText("Attempt #2")).toBeInTheDocument()
    expect(view.getByText("Building")).toBeInTheDocument()
    expect(view.getByText("main")).toBeInTheDocument()
    expect(view.getByText("Git Webhook")).toBeInTheDocument()
    expect(view.getByText("Status timeline")).toBeInTheDocument()

    // Right column: terminal with source tabs
    expect(view.getByText("Live Jenkins Log")).toBeInTheDocument()
    expect(view.getByText("Release & GitOps Log")).toBeInTheDocument()
    expect(view.getByText("Application Log (Live)")).toBeInTheDocument()
  })

  it("renders retry deploy button on failure", () => {
    const onRetryMock = mock(() => {})
    const failedDeployment: DeploymentStatusDTO = {
      ...mockDeployment,
      status: "failed",
      failureReason: "Compilation failed",
    }

    const view = render(
      <DeploymentSplitWorkspace
        stack={mockStack}
        deployment={failedDeployment}
        deployId="deploy-1"
        status="failed"
        logScope="all"
        onLogScopeChange={() => {}}
        onRetry={onRetryMock}
        locale="en"
      />
    )

    const retryBtns = view.getAllByRole("button", { name: /retry deploy/i })
    expect(retryBtns.length).toBeGreaterThan(0)
  })
})

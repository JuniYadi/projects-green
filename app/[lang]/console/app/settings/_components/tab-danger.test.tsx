import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react"
import React from "react"

const mockToastSuccess = mock()
const mockToastError = mock()

mock.module("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

const mockCancelPost = mock()

const appsProxy = new Proxy(
  {},
  {
    get: () => ({
      cancel: {
        post: mockCancelPost,
      },
    }),
  }
)

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      deploy: {
        apps: appsProxy,
      },
    },
  },
}))

import { TabDanger } from "./tab-danger"
import type { StackSummaryDTO } from "@/modules/deploy/deploy-monitor.dto"

const sampleStack: StackSummaryDTO = {
  id: "stack-1",
  name: "My Awesome App",
  slug: "my-awesome-app",
  status: "running",
  framework: "Next.js",
  branchName: "main",
  subdomain: "my-app.pfn.app",
  customDomain: null,
  resourcePlanId: "starter",
  billingMode: "PAYG",
  billingState: "ACTIVE",
  lastDeployedAt: "2026-06-05T10:00:00.000Z",
  latestDeploymentId: "deploy-1",
  currentStepLabel: "Verified",
  currentStepIndex: 10,
  currentStepStartedAt: null,
  renewalAt: "2026-10-07T15:50:27.570Z",
}

describe("TabDanger Component", () => {
  beforeEach(() => {
    mockToastSuccess.mockClear()
    mockToastError.mockClear()
    mockCancelPost.mockClear()
    mockCancelPost.mockResolvedValue({
      data: {
        ok: true,
        message: "Service cancellation scheduled",
        activeUntil: "2026-10-07T15:50:27.570Z",
      },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it(
    "renders 'Cancel Subscription' and 'Service Cancellation' while " +
      "omitting 'Delete Application'",
    () => {
      const view = render(<TabDanger stack={sampleStack} />)

      expect(view.getAllByText("Service Cancellation").length).toBeGreaterThan(
        0
      )
      expect(
        view.getByRole("button", { name: "Cancel Subscription" })
      ).toBeInTheDocument()
      expect(view.queryByText("Delete Application")).toBeNull()
    }
  )

  it("explains that the service remains active until the renewal date", () => {
    const view = render(<TabDanger stack={sampleStack} />)

    expect(view.getByText("Oct 7, 2026")).toBeInTheDocument()
    expect(
      view.getByText(
        /Your service will remain active with full resources and traffic/i
      )
    ).toBeInTheDocument()
  })

  it("opens confirmation dialog and triggers cancel on confirm", async () => {
    const view = render(<TabDanger stack={sampleStack} />)

    const triggerButton = view.getByRole("button", {
      name: "Cancel Subscription",
    })
    fireEvent.click(triggerButton)

    const base = within(view.baseElement)

    expect(
      base.getByText(`Cancel Subscription for ${sampleStack.name}`)
    ).toBeInTheDocument()
    expect(
      base.getByText(
        /This will schedule cancellation of your application subscription/i
      )
    ).toBeInTheDocument()

    const confirmButton = base.getByRole("button", {
      name: "Confirm Cancellation",
    })
    expect(confirmButton).toBeDisabled()

    const input = base.getByPlaceholderText(sampleStack.name)
    fireEvent.change(input, { target: { value: sampleStack.name } })
    expect(confirmButton).not.toBeDisabled()
    fireEvent.click(confirmButton)
    await waitFor(() => {
      expect(mockCancelPost).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Service cancellation scheduled. Workloads remain active until " +
          "Oct 7, 2026."
      )
    })

    await waitFor(() => {
      expect(
        view.getByText(
          "Cancellation scheduled for Oct 7, 2026. Active until renewal date."
        )
      ).toBeInTheDocument()
    })
  })

  it("renders pending status when stack is already marked cancelled", () => {
    const cancelledStack: StackSummaryDTO = {
      ...sampleStack,
      cancellationScheduled: true,
    }

    const view = render(<TabDanger stack={cancelledStack} />)

    expect(
      view.getByText(
        "Cancellation scheduled for Oct 7, 2026. Active until renewal date."
      )
    ).toBeInTheDocument()
    expect(
      view.queryByRole("button", { name: "Cancel Subscription" })
    ).toBeNull()
    expect(view.queryByText("Delete Application")).toBeNull()
  })
})

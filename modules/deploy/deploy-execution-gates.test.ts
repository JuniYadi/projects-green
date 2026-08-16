import { describe, expect, it, mock } from "bun:test"
import { assertDeployExecutionGates } from "./deploy-execution-gates"

const input = {
  organizationId: "org-1",
  stackId: "stack-1",
  billingMode: "PACKAGE" as const,
  resourcePlanId: "pro",
  hourlyCost: 0.08,
  paygBufferHours: 24,
}

const cluster = {
  id: "cluster-1",
  code: "cluster-1",
  name: "Cluster 1",
  region: "Singapore",
}

describe("assertDeployExecutionGates", () => {
  it("throws INSUFFICIENT_PAYG_BUFFER when the org balance can't cover the buffer", async () => {
    const billing = {
      assertCanStartPayg: mock(async () => {
        throw new Error("INSUFFICIENT_PAYG_BUFFER")
      }),
    }

    await expect(
      assertDeployExecutionGates(
        { ...input, billingMode: "PAYG", resourcePlanId: "payg" },
        { billing, resolveCluster: mock(async () => cluster) }
      )
    ).rejects.toThrow("INSUFFICIENT_PAYG_BUFFER")
  })

  it("does not run the PAYG balance check for PACKAGE billing", async () => {
    const billing = {
      assertCanStartPayg: mock(async () => undefined as never),
    }
    const resolveCluster = mock(async () => cluster)

    await assertDeployExecutionGates(input, { billing, resolveCluster })

    expect(billing.assertCanStartPayg).not.toHaveBeenCalled()
  })

  it("throws when no default cluster can be resolved", async () => {
    const resolveCluster = mock(async () => {
      throw new Error("No active default App Hosting cluster")
    })

    await expect(
      assertDeployExecutionGates(input, { resolveCluster })
    ).rejects.toThrow("No active default App Hosting cluster")
  })
})

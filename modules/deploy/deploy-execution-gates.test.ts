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
      assertCanDeploySubscription: mock(async () => ({
        subscriptionId: "sub-1",
        maxSlots: 1,
        usedSlots: 0,
      })),
    }

    await expect(
      assertDeployExecutionGates(
        { ...input, billingMode: "PAYG", resourcePlanId: "payg" },
        { billing, resolveCluster: mock(async () => cluster) }
      )
    ).rejects.toThrow("INSUFFICIENT_PAYG_BUFFER")
  })

  it("passes PAYG gate when org balance covers the buffer", async () => {
    const billing = {
      assertCanStartPayg: mock(
        async () =>
          ({
            hourlyCost: 0.08,
            requiredBalance: 1.92,
            bufferHours: 24,
          }) as never
      ),
      assertCanDeploySubscription: mock(async () => ({
        subscriptionId: "sub-1",
        maxSlots: 1,
        usedSlots: 0,
      })),
    }
    const resolveCluster = mock(async () => cluster)

    await assertDeployExecutionGates(
      { ...input, billingMode: "PAYG", resourcePlanId: "payg" },
      { billing, resolveCluster }
    )

    expect(billing.assertCanStartPayg).toHaveBeenCalled()
    expect(billing.assertCanDeploySubscription).not.toHaveBeenCalled()
    expect(resolveCluster).toHaveBeenCalledWith(input.stackId)
  })

  it("does not run the PAYG balance check for PACKAGE billing and checks subscription quota", async () => {
    const billing = {
      assertCanStartPayg: mock(async () => undefined as never),
      assertCanDeploySubscription: mock(async () => ({
        subscriptionId: "sub-1",
        maxSlots: 2,
        usedSlots: 1,
      })),
    }
    const resolveCluster = mock(async () => cluster)

    await assertDeployExecutionGates(input, { billing, resolveCluster })

    expect(billing.assertCanStartPayg).not.toHaveBeenCalled()
    expect(billing.assertCanDeploySubscription).toHaveBeenCalledWith({
      organizationId: input.organizationId,
      stackId: input.stackId,
    })
  })

  it("throws NO_ACTIVE_SUBSCRIPTION when PACKAGE billing has no active subscription", async () => {
    const billing = {
      assertCanStartPayg: mock(async () => undefined as never),
      assertCanDeploySubscription: mock(async () => {
        throw new Error("NO_ACTIVE_SUBSCRIPTION")
      }),
    }

    await expect(
      assertDeployExecutionGates(input, {
        billing,
        resolveCluster: mock(async () => cluster),
      })
    ).rejects.toThrow("NO_ACTIVE_SUBSCRIPTION")
  })

  it("throws STACK_QUOTA_EXCEEDED when PACKAGE subscription quota is exhausted", async () => {
    const billing = {
      assertCanStartPayg: mock(async () => undefined as never),
      assertCanDeploySubscription: mock(async () => {
        throw new Error("STACK_QUOTA_EXCEEDED")
      }),
    }

    await expect(
      assertDeployExecutionGates(input, {
        billing,
        resolveCluster: mock(async () => cluster),
      })
    ).rejects.toThrow("STACK_QUOTA_EXCEEDED")
  })

  it("throws when no default cluster can be resolved", async () => {
    const billing = {
      assertCanStartPayg: mock(async () => undefined as never),
      assertCanDeploySubscription: mock(async () => ({
        subscriptionId: "sub-1",
        maxSlots: 1,
        usedSlots: 0,
      })),
    }
    const resolveCluster = mock(async () => {
      throw new Error("No active default App Hosting cluster")
    })

    await expect(
      assertDeployExecutionGates(input, { billing, resolveCluster })
    ).rejects.toThrow("No active default App Hosting cluster")
  })
})

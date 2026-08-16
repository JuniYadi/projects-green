import type { PrismaClient, ServiceType } from "@prisma/client"
import { ladderActionFor, type LadderAction } from "./renewal-ladder"

export type RenewalServiceCallbacks = {
  onSuspend(subscriptionId: string): Promise<void>
  onTerminate(subscriptionId: string): Promise<void>
}

export type RenewalCoordinatorResult = {
  suspended: number
  terminated: number
  failed: number
}

/**
 * Drives every ServiceSubscription through the PRD renewal ladder.
 * Owns commercial state only: the status column and the ladder timing.
 * Provisioning side effects (revoking certs, suspending devices) stay in
 * the per-product callbacks so this file never imports a product module.
 */
export class RenewalCoordinatorService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly callbacks: Partial<
      Record<ServiceType, RenewalServiceCallbacks>
    >
  ) {}

  async runLadderTransitions(
    now: Date = new Date()
  ): Promise<RenewalCoordinatorResult> {
    const result: RenewalCoordinatorResult = {
      suspended: 0,
      terminated: 0,
      failed: 0,
    }

    const subscriptions = await this.prisma.serviceSubscription.findMany({
      where: {
        status: { in: ["ACTIVE", "SUSPENDED"] },
        currentPeriodEnd: { lt: now },
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
        currentPeriodEnd: true,
        package: { select: { code: true } },
      },
    })

    for (const subscription of subscriptions) {
      const action = ladderActionFor(subscription.currentPeriodEnd, now)
      if (action === "NONE") continue

      const handlers = this.callbacks[subscription.package.code]
      if (!handlers) continue

      if (!this.needsTransition(subscription.status, action)) continue

      try {
        await this.applyTransition(subscription.id, action, handlers)
        if (action === "SUSPEND") result.suspended++
        else result.terminated++
      } catch (error) {
        result.failed++
        console.error(
          `[RenewalCoordinator] ${action} failed for ${subscription.id}:`,
          error
        )
      }
    }

    console.info(
      `[RenewalCoordinator] ${result.suspended} suspended, ` +
        `${result.terminated} terminated, ${result.failed} failed`
    )

    return result
  }

  private needsTransition(status: string, action: LadderAction): boolean {
    if (action === "SUSPEND") return status === "ACTIVE"
    return status !== "CANCELLED"
  }

  private async applyTransition(
    subscriptionId: string,
    action: LadderAction,
    handlers: RenewalServiceCallbacks
  ): Promise<void> {
    if (action === "SUSPEND") {
      await handlers.onSuspend(subscriptionId)
      await this.prisma.serviceSubscription.update({
        where: { id: subscriptionId },
        data: { status: "SUSPENDED" },
      })
      return
    }

    await handlers.onTerminate(subscriptionId)
    await this.prisma.serviceSubscription.update({
      where: { id: subscriptionId },
      data: { status: "CANCELLED" },
    })
  }
}

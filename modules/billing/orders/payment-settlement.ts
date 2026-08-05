import type { PrismaClient } from "@prisma/client"
import { prisma as defaultPrisma } from "@/lib/prisma"
type ProductOrderDelegate = {
  findMany: (args: unknown) => Promise<Array<{ id: string; status: string }>>
  update?: (args: unknown) => Promise<unknown>
  updateMany?: (args: unknown) => Promise<{ count: number }>
}

export async function settleProductOrdersForInvoice(
  invoiceId: string,
  prismaClient: PrismaClient = defaultPrisma
): Promise<void> {
  const client = prismaClient as PrismaClient & {
    billingOrder?: ProductOrderDelegate
  }
  const delegate = client.billingOrder
  if (!delegate) return

  const orders = await delegate.findMany({
    where: { billingInvoiceId: invoiceId },
    select: { id: true, status: true },
  })
  if (orders.length === 0) return

  // The fulfillment registry imports product adapters that import this spine;
  // defer loading to avoid a cycle during payment route bootstrap.
  const { BillingOrderService } = await import("./order.service")
  const service = new BillingOrderService(prismaClient)
  for (const order of orders) {
    if (
      order.status !== "PENDING" &&
      order.status !== "CHARGED" &&
      order.status !== "FAILED"
    ) {
      continue
    }

    if (order.status === "PENDING" && delegate.updateMany) {
      const claimed = await delegate.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "CHARGED", chargedAt: new Date() },
      })
      if (claimed.count !== 1) continue
    } else if (order.status === "PENDING") {
      await delegate.update?.({
        where: { id: order.id },
        data: { status: "CHARGED", chargedAt: new Date() },
      })
    }

    await service.fulfillOrder(order.id)
  }
}

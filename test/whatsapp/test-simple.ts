import { describe, expect, it, mock } from "bun:test"

const mockFn = mock(() => null)
mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappConversation: { findFirst: mockFn, create: mockFn, update: mockFn },
    whatsappMessage: { create: mockFn },
    whatsappDevice: {
      findUnique: mock(() => ({ id: "d1", organizationId: "o1" })),
    },
  },
}))

const { processInboundMessage } =
  await import("@/modules/whatsapp/webhooks/webhooks.service")

describe("simple", () => {
  it("exists", () => {
    expect(typeof processInboundMessage).toBe("function")
  })
})

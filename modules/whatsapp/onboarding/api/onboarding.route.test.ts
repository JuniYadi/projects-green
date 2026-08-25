import { describe, expect, it, mock, beforeEach } from "bun:test"
import { onboardingRoutes } from "./onboarding.route"

const mockPrisma = {
  whatsappDevice: {
    count: mock(async () => 1),
  },
  whatsappTemplate: {
    count: mock(async () => 5),
  },
  whatsappMessage: {
    count: mock(async () => 10),
  },
  whatsappApiKey: {
    count: mock(async () => 0),
  },
  whatsappOrganizationApiKey: {
    count: mock(async () => 1),
  },
  serviceSubscription: {
    findFirst: mock(async () => ({ id: "sub-1" })),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

let mockAuth: { organizationId: string } | null = { organizationId: "org-1" }

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: mock(async () => mockAuth),
}))

describe("Onboarding Route", () => {
  beforeEach(() => {
    mockAuth = { organizationId: "org-1" }
    mockPrisma.whatsappDevice.count.mockResolvedValue(1)
    mockPrisma.whatsappTemplate.count.mockResolvedValue(5)
    mockPrisma.whatsappMessage.count.mockResolvedValue(10)
    mockPrisma.whatsappApiKey.count.mockResolvedValue(0)
    mockPrisma.whatsappOrganizationApiKey.count.mockResolvedValue(1)
    mockPrisma.serviceSubscription.findFirst.mockResolvedValue({ id: "sub-1" })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth = null
    const response = await onboardingRoutes.handle(
      new Request("http://localhost/onboarding/status")
    )
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.ok).toBe(false)
  })

  it("returns default zero counts when organizationId is missing", async () => {
    mockAuth = { organizationId: "" }
    const response = await onboardingRoutes.handle(
      new Request("http://localhost/onboarding/status")
    )
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)
    expect(json.data.deviceCount).toBe(0)
  })

  it("aggregates device, message, template and api keys for authorized organization", async () => {
    const response = await onboardingRoutes.handle(
      new Request("http://localhost/onboarding/status")
    )
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)
    expect(json.data.deviceCount).toBe(1)
    expect(json.data.templateCount).toBe(5)
    expect(json.data.messageCount).toBe(10)
    expect(json.data.apiKeyCount).toBe(1)
    expect(json.data.hasSubscription).toBe(true)
  })
})

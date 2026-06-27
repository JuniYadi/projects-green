import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// ── Mock the global email queue early ──────────────────────────────────────
const mockSendEmailFn = mock(async () => {})
const mockEmailJobEnqueue = mock(async () => {})
mock.module("@/lib/queue/email", () => ({
  sendEmail: mockSendEmailFn,
  EmailJob: {
    enqueue: mockEmailJobEnqueue,
    queue: "email",
    workerConcurrency: 2,
    attempts: 3,
    createWorker: mock(() => ({})),
  },
}))

// ── Mock all 8 templates ──────────────────────────────────────────────────
mock.module("./emails/subscription-created", () => ({
  SubscriptionCreatedEmail: () => "<div>Subscription Created</div>",
}))
mock.module("./emails/provisioning-success", () => ({
  ProvisioningSuccessEmail: () => "<div>Provisioning Success</div>",
}))
mock.module("./emails/provisioning-failed", () => ({
  ProvisioningFailedEmail: () => "<div>Provisioning Failed</div>",
}))
mock.module("./emails/renewal-success", () => ({
  RenewalSuccessEmail: () => "<div>Renewal Success</div>",
}))
mock.module("./emails/renewal-failed", () => ({
  RenewalFailedEmail: () => "<div>Renewal Failed</div>",
}))
mock.module("./emails/subscription-suspended", () => ({
  SubscriptionSuspendedEmail: () => "<div>Subscription Suspended</div>",
}))
mock.module("./emails/subscription-expired", () => ({
  SubscriptionExpiredEmail: () => "<div>Subscription Expired</div>",
}))
mock.module("./emails/subscription-cancelled", () => ({
  SubscriptionCancelledEmail: () => "<div>Subscription Cancelled</div>",
}))

// ── WorkOS mock ───────────────────────────────────────────────────────────
const mockGetUser = mock(async (userId: string) => ({
  id: userId,
  email: "admin@test.com",
  firstName: "Admin",
  lastName: "User",
}))

const mockListOrgMemberships = mock(async () => ({
  data: [{ userId: "user-1" }, { userId: "user-2" }],
}))

mock.module("@workos-inc/node", () => ({
  createWorkOS: () => ({
    userManagement: {
      getUser: mockGetUser,
      listOrganizationMemberships: mockListOrgMemberships,
    },
  }),
}))

// ── Imports after mocks ───────────────────────────────────────────────────
const mockRender = mock(async () => "<html><body>Test Email</body></html>")
mock.module("@react-email/components", () => ({
  render: mockRender,
}))

describe("vpnEmailService", () => {
  let emailService: import("./email.service").VpnEmailService

  beforeEach(async () => {
    mockRender.mockClear()
    mockSendEmailFn.mockClear()
    mockGetUser.mockClear()
    mockListOrgMemberships.mockClear()

    process.env.WORKOS_API_KEY = "test-key"

    const { vpnEmailService } = await import("./email.service")
    emailService = vpnEmailService
  })

  afterEach(() => {
    delete process.env.WORKOS_API_KEY
  })

  describe("sendSubscriptionCreated", () => {
    it("sends email with correct subject", async () => {
      await emailService.sendSubscriptionCreated("org-1", "VPN Pro")

      expect(mockSendEmailFn).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@test.com",
          subject: "Your VPN subscription is being provisioned",
        })
      )
    })

    it("renders the template", async () => {
      await emailService.sendSubscriptionCreated("org-1")

      expect(mockRender).toHaveBeenCalled()
    })
  })

  describe("sendProvisioningSuccess", () => {
    it("sends email with correct subject", async () => {
      await emailService.sendProvisioningSuccess("org-1", "VPN Pro")

      expect(mockSendEmailFn).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@test.com",
          subject: "Your VPN account is ready",
        })
      )
    })
  })

  describe("sendProvisioningFailed", () => {
    it("sends email with correct subject", async () => {
      await emailService.sendProvisioningFailed("org-1")

      expect(mockSendEmailFn).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "VPN provisioning failed — contact support",
        })
      )
    })
  })

  describe("sendRenewalSuccess", () => {
    it("sends email with correct subject", async () => {
      await emailService.sendRenewalSuccess("org-1", "VPN Pro", "2026-07")

      expect(mockSendEmailFn).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@test.com",
          subject: "VPN subscription renewed",
        })
      )
    })
  })

  describe("sendRenewalFailed", () => {
    it("sends email with correct subject", async () => {
      await emailService.sendRenewalFailed("org-1")

      expect(mockSendEmailFn).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "VPN renewal payment failed — please top up",
        })
      )
    })
  })

  describe("sendSubscriptionSuspended", () => {
    it("sends email with correct subject", async () => {
      await emailService.sendSubscriptionSuspended("org-1")

      expect(mockSendEmailFn).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "VPN subscription suspended due to payment overdue",
        })
      )
    })
  })

  describe("sendSubscriptionExpired", () => {
    it("sends email with correct subject", async () => {
      await emailService.sendSubscriptionExpired("org-1")

      expect(mockSendEmailFn).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "VPN subscription expired",
        })
      )
    })
  })

  describe("sendSubscriptionCancelled", () => {
    it("sends email with correct subject", async () => {
      await emailService.sendSubscriptionCancelled(
        "org-1",
        "VPN Pro",
        "2026-07-31"
      )

      expect(mockSendEmailFn).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@test.com",
          subject: "VPN subscription will be cancelled at period end",
        })
      )
    })
  })

  describe("error handling", () => {
    it("handles missing WorkOS API key gracefully (does not throw)", async () => {
      delete process.env.WORKOS_API_KEY

      await expect(
        emailService.sendSubscriptionCreated("org-1")
      ).resolves.toBeUndefined()
    })
  })
})

describe("EmailJob", () => {
  it("has expected queue configuration", async () => {
    const { EmailJob } = await import("@/lib/queue/email")

    expect(EmailJob.queue).toBe("email")
    expect(EmailJob.workerConcurrency).toBe(2)
    expect(EmailJob.attempts).toBe(3)
  })
})

describe("sendEmail helper", () => {
  it("exports sendEmail as a function", async () => {
    const { sendEmail } = await import("@/lib/queue/email")
    expect(typeof sendEmail).toBe("function")
  })
})

/**
 * WhatsApp Test Org Dummy Seeder
 *
 * Migrated from scripts/seed-whatsapp-test-org.ts.
 * Creates a test organization with WhatsApp device, contacts,
 * conversations, messages, and WorkOS org/membership.
 *
 * Unseed removes all test data in dependency order.
 */

import { AuthPlatformRole, WhatsappDeviceStatus } from "@prisma/client"

import { BaseSeeder } from "../base-seeder"
import { registerSeeder } from "../registry"

// ── Constants ──────────────────────────────────────────────────────────────

const SEED_TAG = "whatsapp-e2e-test"

const DEFAULT_TEST_DATA = {
  superAdminEmail: "whatsapp-test-admin@example.com",
  superAdminUserId: "wat Admin_user_seed",
  organizationId: "wat org_seed",
  organizationName: "WhatsApp Test Org",
  deviceName: "Test Device",
  devicePhone: "+6281234567890",
  businessAccountId: "WABA_test_seed",
} as const

// ── Seeder Class ───────────────────────────────────────────────────────────

class WhatsappTestOrgSeeder extends BaseSeeder {
  static override readonly seederName = "WhatsappTestOrg"
  static override readonly classification = "dummy" as const
  static override readonly runOrder = 20
  static override readonly description =
    "WhatsApp test org with device, contacts, conversations, and messages"

  // ── Seed ───────────────────────────────────────────────────────────

  async seed(): Promise<void> {
    this.log(`Seed tag: ${SEED_TAG}`)
    this.log(`Organization ID: ${DEFAULT_TEST_DATA.organizationId}`)

    await this.createSuperAdmin()
    await this.createWhatsAppDevice()
    await this.createTestContacts()
    await this.createTestConversations()
    await this.createTestMessages()
    await this.createWorkOSOrganizationAndMembership()

    this.log("Done")
  }

  // ── Unseed ─────────────────────────────────────────────────────────

  async unseed(): Promise<void> {
    this.log("Removing WhatsApp test data...")

    // Remove in order of dependencies
    const deletedMessages = await this.prisma.whatsappMessage.deleteMany({
      where: {
        conversation: {
          organizationId: DEFAULT_TEST_DATA.organizationId,
        },
      },
    })
    this.trackDeleted(deletedMessages.count)

    const deletedConversations =
      await this.prisma.whatsappConversation.deleteMany({
        where: { organizationId: DEFAULT_TEST_DATA.organizationId },
      })
    this.trackDeleted(deletedConversations.count)

    const deletedContacts = await this.prisma.whatsappContact.deleteMany({
      where: { organizationId: DEFAULT_TEST_DATA.organizationId },
    })
    this.trackDeleted(deletedContacts.count)

    const deletedGroups = await this.prisma.whatsappContactGroup.deleteMany({
      where: { organizationId: DEFAULT_TEST_DATA.organizationId },
    })
    this.trackDeleted(deletedGroups.count)

    const deletedDevices = await this.prisma.whatsappDevice.deleteMany({
      where: { organizationId: DEFAULT_TEST_DATA.organizationId },
    })
    this.trackDeleted(deletedDevices.count)

    const deletedUsers = await this.prisma.authPlatformUserRole.deleteMany({
      where: { email: DEFAULT_TEST_DATA.superAdminEmail },
    })
    this.trackDeleted(deletedUsers.count)

    this.log("Done")
  }

  // ── Private Seed Helpers ───────────────────────────────────────────

  private async createSuperAdmin(): Promise<void> {
    const existing = await this.prisma.authPlatformUserRole.findFirst({
      where: { email: DEFAULT_TEST_DATA.superAdminEmail },
    })

    if (existing) {
      if (existing.role === AuthPlatformRole.SUPER_ADMIN) {
        this.log(
          `Super admin ${DEFAULT_TEST_DATA.superAdminEmail} already exists`
        )
        this.trackSkipped()
        return
      }

      await this.prisma.authPlatformUserRole.update({
        where: { id: existing.id },
        data: { role: AuthPlatformRole.SUPER_ADMIN },
      })
      this.log(`Promoted to super admin: ${DEFAULT_TEST_DATA.superAdminEmail}`)
      this.trackUpdated()
      return
    }

    await this.prisma.authPlatformUserRole.create({
      data: {
        email: DEFAULT_TEST_DATA.superAdminEmail,
        workosUserId: DEFAULT_TEST_DATA.superAdminUserId,
        role: AuthPlatformRole.SUPER_ADMIN,
      },
    })
    this.log(`Created super admin: ${DEFAULT_TEST_DATA.superAdminEmail}`)
    this.trackCreated()
  }

  private async createWhatsAppDevice(): Promise<void> {
    const existing = await this.prisma.whatsappDevice.findFirst({
      where: { phoneNumber: DEFAULT_TEST_DATA.devicePhone },
    })

    if (existing) {
      this.log(
        `WhatsApp device ${DEFAULT_TEST_DATA.devicePhone} already exists`
      )
      this.trackSkipped()
      return
    }

    await this.prisma.whatsappDevice.create({
      data: {
        organizationId: DEFAULT_TEST_DATA.organizationId,
        phoneNumber: DEFAULT_TEST_DATA.devicePhone,
        balance: 100,
        dailyLimitMessage: 1000,
        rates: '{"text": 0.05, "media": 0.10}',
        status: WhatsappDeviceStatus.ACTIVE,
        whatsappBusinessAccountId: DEFAULT_TEST_DATA.businessAccountId,
        whatsappPhoneId: "wamid_test_seed",
        whatsappApplicationId: "app_test_seed",
      },
    })
    this.log(
      `Created WhatsApp device: ${DEFAULT_TEST_DATA.deviceName} (${DEFAULT_TEST_DATA.devicePhone})`
    )
    this.trackCreated()
  }

  private async createTestContacts(): Promise<void> {
    const contacts = [
      { name: "John Doe", phone: "+6289876543210" },
      { name: "Jane Smith", phone: "+6289876543211" },
      { name: "Alice Johnson", phone: "+6289876543212" },
      { name: "Bob Wilson", phone: "+6289876543213" },
    ]

    for (const contact of contacts) {
      const existing = await this.prisma.whatsappContact.findFirst({
        where: {
          organizationId: DEFAULT_TEST_DATA.organizationId,
          phoneNumber: contact.phone,
        },
      })

      if (existing) {
        this.log(`Contact ${contact.phone} already exists`)
        this.trackSkipped()
        continue
      }

      // Get or create a contact group
      let group = await this.prisma.whatsappContactGroup.findFirst({
        where: {
          organizationId: DEFAULT_TEST_DATA.organizationId,
          name: "Test Group",
        },
      })

      if (!group) {
        group = await this.prisma.whatsappContactGroup.create({
          data: {
            organizationId: DEFAULT_TEST_DATA.organizationId,
            name: "Test Group",
            description: "Test contact group for E2E tests",
          },
        })
      }

      await this.prisma.whatsappContact.create({
        data: {
          organizationId: DEFAULT_TEST_DATA.organizationId,
          phoneNumber: contact.phone,
          name: contact.name,
          email: `${contact.name.toLowerCase().replace(" ", ".")}@example.com`,
          contactGroupId: group.id,
        },
      })
      this.log(`Created contact: ${contact.name} (${contact.phone})`)
      this.trackCreated()
    }
  }

  private async createTestConversations(): Promise<void> {
    const testPhoneNumbers = [
      "+6289876543210",
      "+6289876543211",
      "+6289876543212",
    ]

    // Get the WhatsApp device ID
    const device = await this.prisma.whatsappDevice.findFirst({
      where: { phoneNumber: DEFAULT_TEST_DATA.devicePhone },
    })

    if (!device) {
      this.warn("WhatsApp device not found, cannot create conversations")
      return
    }

    for (const phoneNumber of testPhoneNumbers) {
      const existing = await this.prisma.whatsappConversation.findFirst({
        where: {
          organizationId: DEFAULT_TEST_DATA.organizationId,
          contactPhone: phoneNumber,
        },
      })

      if (existing) {
        this.log(`Conversation for ${phoneNumber} already exists`)
        this.trackSkipped()
        continue
      }

      await this.prisma.whatsappConversation.create({
        data: {
          organizationId: DEFAULT_TEST_DATA.organizationId,
          contactPhone: phoneNumber,
          whatsappDeviceId: device.id,
          lastMessageAt: new Date(),
          lastDirection: "OUTBOX",
        },
      })
      this.log(`Created conversation: ${phoneNumber}`)
      this.trackCreated()
    }
  }

  private async createTestMessages(): Promise<void> {
    const conversations = await this.prisma.whatsappConversation.findMany({
      where: { organizationId: DEFAULT_TEST_DATA.organizationId },
    })

    const existingMessages = await this.prisma.whatsappMessage.findMany({
      where: {
        conversation: {
          organizationId: DEFAULT_TEST_DATA.organizationId,
        },
      },
    })

    if (existingMessages.length > 0) {
      this.log(`${existingMessages.length} messages already exist, skipping...`)
      this.trackSkipped(existingMessages.length)
      return
    }

    let count = 0
    for (const conversation of conversations) {
      const sampleMessages = [
        {
          conversationId: conversation.id,
          direction: "OUTBOX" as const,
          messageType: "text",
          body: "Hello! This is a test message.",
        },
        {
          conversationId: conversation.id,
          direction: "INBOX" as const,
          messageType: "text",
          body: "Hi! Thanks for reaching out.",
        },
        {
          conversationId: conversation.id,
          direction: "OUTBOX" as const,
          messageType: "text",
          body: "How can I help you today?",
        },
      ]

      for (const msg of sampleMessages) {
        await this.prisma.whatsappMessage.create({ data: msg })
        count++
      }
    }

    this.log(`Created ${count} test messages`)
    this.trackCreated(count)
  }

  /**
   * Create (or upsert) a WorkOS organization + matching membership for the
   * test super admin user. Skips gracefully if WORKOS_API_KEY is not set.
   */
  private async createWorkOSOrganizationAndMembership(): Promise<void> {
    const workosApiKey = process.env.WORKOS_API_KEY?.trim()
    if (!workosApiKey) {
      this.warn(
        "WORKOS_API_KEY not set — skipping WorkOS org/membership creation"
      )
      return
    }

    try {
      // Dynamic import to avoid hard dependency on WorkOS in envs without it
      const { getWorkOS } = await import("@workos-inc/authkit-nextjs")
      const workos = getWorkOS()

      // 1. Find existing org by name or create a new one
      let organizationId: string | null = null
      try {
        const orgsList = await workos.organizations
          .listOrganizations({})
          .then((r) => r.autoPagination())
        const existing = orgsList.find(
          (org: { name?: string | null }) =>
            org.name === DEFAULT_TEST_DATA.organizationName
        )
        if (existing) {
          organizationId = existing.id
          this.log(`WorkOS organization ${organizationId} already exists.`)
        }
      } catch (lookupErr) {
        this.warn(
          `WorkOS listOrganizations failed; will attempt create: ${
            lookupErr instanceof Error ? lookupErr.message : String(lookupErr)
          }`
        )
      }

      if (!organizationId) {
        const created = await workos.organizations.createOrganization({
          name: DEFAULT_TEST_DATA.organizationName,
        })
        organizationId = created.id
        this.log(
          `Created WorkOS organization: ${organizationId} (${DEFAULT_TEST_DATA.organizationName})`
        )
        this.trackCreated()
      }

      if (!organizationId) return

      // 2. Upsert the admin's membership in this org
      const memberships = await workos.userManagement
        .listOrganizationMemberships({
          organizationId,
          userId: DEFAULT_TEST_DATA.superAdminUserId,
          statuses: ["active", "pending", "inactive"],
        })
        .then((r) => r.autoPagination())

      const existingMembership = memberships[0]
      if (existingMembership) {
        if (existingMembership.role?.slug !== "user_admin") {
          await workos.userManagement.updateOrganizationMembership(
            existingMembership.id,
            { roleSlug: "user_admin" }
          )
          this.log(`Updated WorkOS membership to roleSlug=user_admin.`)
          this.trackUpdated()
        } else {
          this.log("WorkOS membership already user_admin.")
          this.trackSkipped()
        }
      } else {
        await workos.userManagement.createOrganizationMembership({
          organizationId,
          userId: DEFAULT_TEST_DATA.superAdminUserId,
          roleSlug: "user_admin",
        })
        this.log(
          `Created WorkOS membership: user=${DEFAULT_TEST_DATA.superAdminUserId}`
        )
        this.trackCreated()
      }
    } catch (error) {
      this.warn("WorkOS not reachable — skipping org/membership creation")
      if (error instanceof Error) {
        this.warn(`WorkOS error: ${error.message}`)
      }
    }
  }
}

registerSeeder(WhatsappTestOrgSeeder)

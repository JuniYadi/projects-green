import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, AuthPlatformRole, WhatsappDeviceStatus } from "@prisma/client"
import { getWorkOS } from "@workos-inc/authkit-nextjs"

const DATABASE_URL = process.env.DATABASE_URL?.trim()
if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL environment variable")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: DATABASE_URL,
  }),
})

/**
 * Seed script for WhatsApp test organization and test data.
 * Usage:
 *   bun run scripts/seed-whatsapp-test-org.ts
 *
 * Creates:
 * - Test super admin user (for API key creation)
 * - Test WhatsApp device
 * - Test contacts
 * - Test conversations
 *
 * This data is used for local dev and CI environments.
 */

interface SeedOptions {
  remove?: boolean
}

const SEED_TAG = "whatsapp-e2e-test"

// Default test data
const DEFAULT_TEST_DATA = {
  superAdminEmail: "whatsapp-test-admin@example.com",
  superAdminUserId: "wat Admin_user_seed",
  organizationId: "wat org_seed",
  organizationName: "WhatsApp Test Org",
  deviceName: "Test Device",
  devicePhone: "+6281234567890",
  businessAccountId: "WABA_test_seed",
}

const usage = () => {
  console.log(`
Usage:
  bun run scripts/seed-whatsapp-test-org.ts [--remove]

Examples:
  # Create test data
  bun run scripts/seed-whatsapp-test-org.ts

  # Remove test data
  bun run scripts/seed-whatsapp-test-org.ts --remove

Environment:
  DATABASE_URL must be set
`)
}

// ─── Core seed functions ──────────────────────────────────────────────────────

const createSuperAdmin = async () => {
  const existing = await prisma.authPlatformUserRole.findFirst({
    where: { email: DEFAULT_TEST_DATA.superAdminEmail },
  })

  if (existing) {
    if (existing.role === AuthPlatformRole.SUPER_ADMIN) {
      console.log(`Super admin ${DEFAULT_TEST_DATA.superAdminEmail} already exists`)
      return existing
    }

    const updated = await prisma.authPlatformUserRole.update({
      where: { id: existing.id },
      data: { role: AuthPlatformRole.SUPER_ADMIN },
    })
    console.log(`Promoted to super admin: ${DEFAULT_TEST_DATA.superAdminEmail}`)
    return updated
  }

  const created = await prisma.authPlatformUserRole.create({
    data: {
      email: DEFAULT_TEST_DATA.superAdminEmail,
      workosUserId: DEFAULT_TEST_DATA.superAdminUserId,
      role: AuthPlatformRole.SUPER_ADMIN,
    },
  })

  console.log(`Created super admin: ${DEFAULT_TEST_DATA.superAdminEmail}`)
  return created
}

const createWhatsAppDevice = async () => {
  const existing = await prisma.whatsappDevice.findFirst({
    where: { phoneNumber: DEFAULT_TEST_DATA.devicePhone },
  })

  if (existing) {
    console.log(`WhatsApp device ${DEFAULT_TEST_DATA.devicePhone} already exists`)
    return existing
  }

  const created = await prisma.whatsappDevice.create({
    data: {
      organizationId: DEFAULT_TEST_DATA.organizationId,
      phoneNumber: DEFAULT_TEST_DATA.devicePhone,
      balance: 100,
      quotaBase: 1000,
      quotaBaseIn: 500,
      quotaBaseOut: 500,
      dailyLimitMessage: 1000,
      rates: '{"text": 0.05, "media": 0.10}',
      status: WhatsappDeviceStatus.ACTIVE,
      whatsappBusinessAccountId: DEFAULT_TEST_DATA.businessAccountId,
      whatsappPhoneId: "wamid_test_seed",
      whatsappApplicationId: "app_test_seed",
    },
  })

  console.log(`Created WhatsApp device: ${DEFAULT_TEST_DATA.deviceName} (${DEFAULT_TEST_DATA.devicePhone})`)
  return created
}

const createTestContacts = async () => {
  const contacts = [
    { name: "John Doe", phone: "+6289876543210" },
    { name: "Jane Smith", phone: "+6289876543211" },
    { name: "Alice Johnson", phone: "+6289876543212" },
    { name: "Bob Wilson", phone: "+6289876543213" },
  ]

  const created: Array<{ id: string; phoneNumber: string }> = []

  for (const contact of contacts) {
    const existing = await prisma.whatsappContact.findFirst({
      where: {
        organizationId: DEFAULT_TEST_DATA.organizationId,
        phoneNumber: contact.phone,
      },
    })

    if (existing) {
      console.log(`Contact ${contact.phone} already exists`)
      created.push(existing)
      continue
    }

    // Get or create a contact group
    let group = await prisma.whatsappContactGroup.findFirst({
      where: {
        organizationId: DEFAULT_TEST_DATA.organizationId,
        name: "Test Group",
      },
    })

    if (!group) {
      group = await prisma.whatsappContactGroup.create({
        data: {
          organizationId: DEFAULT_TEST_DATA.organizationId,
          name: "Test Group",
          description: "Test contact group for E2E tests",
        },
      })
    }

    const newContact = await prisma.whatsappContact.create({
      data: {
        organizationId: DEFAULT_TEST_DATA.organizationId,
        phoneNumber: contact.phone,
        name: contact.name,
        email: `${contact.name.toLowerCase().replace(" ", ".")}@example.com`,
        contactGroupId: group.id,
      },
    })

    console.log(`Created contact: ${contact.name} (${contact.phone})`)
    created.push(newContact)
  }

  return created
}

const createTestConversations = async () => {
  const testPhoneNumbers = [
    "+6289876543210",
    "+6289876543211",
    "+6289876543212",
  ]

  const created = []

  for (const phoneNumber of testPhoneNumbers) {
    const existing = await prisma.whatsappConversation.findFirst({
      where: {
        organizationId: DEFAULT_TEST_DATA.organizationId,
        contactPhone: phoneNumber,
      },
    })

    if (existing) {
      console.log(`Conversation for ${phoneNumber} already exists`)
      created.push(existing)
      continue
    }

    const conversation = await prisma.whatsappConversation.create({
      data: {
        organizationId: DEFAULT_TEST_DATA.organizationId,
        contactPhone: phoneNumber,
        whatsappDeviceId: DEFAULT_TEST_DATA.organizationId,
        lastMessageAt: new Date(),
        lastDirection: "OUTBOX",
      },
    })

    console.log(`Created conversation: ${phoneNumber}`)
    created.push(conversation)
  }

  return created
}

const createTestMessages = async () => {
  // Create some sample messages for the conversations
  const conversations = await prisma.whatsappConversation.findMany({
    where: { organizationId: DEFAULT_TEST_DATA.organizationId },
  })

  const existingMessages = await prisma.whatsappMessage.findMany({
    where: {
      conversation: {
        organizationId: DEFAULT_TEST_DATA.organizationId,
      },
    },
  })

  if (existingMessages.length > 0) {
    console.log(`${existingMessages.length} messages already exist, skipping...`)
    return existingMessages
  }

  const messages = []

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
      const created = await prisma.whatsappMessage.create({
        data: msg,
      })
      messages.push(created)
    }
  }

  console.log(`Created ${messages.length} test messages`)
  return messages
}

const removeTestData = async () => {
  console.log("Removing WhatsApp test data...")

  // Remove in order of dependencies
  await prisma.whatsappMessage.deleteMany({
    where: {
      conversation: {
        organizationId: DEFAULT_TEST_DATA.organizationId,
      },
    },
  })

  await prisma.whatsappConversation.deleteMany({
    where: { organizationId: DEFAULT_TEST_DATA.organizationId },
  })

  await prisma.whatsappContact.deleteMany({
    where: { organizationId: DEFAULT_TEST_DATA.organizationId },
  })

  await prisma.whatsappContactGroup.deleteMany({
    where: { organizationId: DEFAULT_TEST_DATA.organizationId },
  })

  await prisma.whatsappDevice.deleteMany({
    where: { organizationId: DEFAULT_TEST_DATA.organizationId },
  })

  await prisma.authPlatformUserRole.deleteMany({
    where: { email: DEFAULT_TEST_DATA.superAdminEmail },
  })

  console.log("WhatsApp test data removed")
}

/**
 * Create (or upsert) a WorkOS organization + matching membership for the
 * test super admin user. This is what lets the WhatsApp dashboard
 * (`/en/console/whatsapp/dashboard`) pass `requireTenantAdmin` for the
 * seeded test user after the WorkOS-org migration.
 *
 * Note: WorkOS does not allow client-supplied organization ids — the SDK
 * `createOrganization` only accepts `name` / `externalId` / etc., and the
 * returned id is a server-generated `org_xxx`. The DB rows in this seed
 * use the sentinel id `wat org_seed` for compatibility with the existing
 * WhatsApp device / contact / conversation payloads, but that string is
 * NOT a valid WorkOS id. The super_admin test user is a member of the
 * real WorkOS org we create here, with roleSlug=`user_admin`, which is
 * enough to satisfy the auth plugin's "first active org wins" rule.
 * The `requireTenantAdmin` guard still succeeds because the seed user
 * is also a `super_admin` (via `AuthPlatformUserRole`), which short-circuits
 * the tenant role check.
 *
 * If WorkOS is unreachable in the current environment (e.g. CI without
 * `WORKOS_API_KEY`), the script logs a clear warning and exits 0 — the
 * rest of the seed (DB rows) still proceeds.
 */
const createWorkOSOrganizationAndMembership = async () => {
  const workosApiKey = process.env.WORKOS_API_KEY?.trim()
  if (!workosApiKey) {
    console.warn(
      "[seed] WORKOS_API_KEY not set — skipping WorkOS org/membership creation; test user will not pass WorkOS auth."
    )
    return
  }

  try {
    const workos = getWorkOS()

    // 1. Find an existing org by name (idempotent re-runs) or create a new
    //    one. WorkOS doesn't have a generic upsert for organizations, so
    //    we look it up by listing organizations and matching the name; if
    //    none is found we create a fresh one. (We can't use the DB-only
    //    sentinel id `wat org_seed` here because WorkOS requires ids
    //    matching `^org_[A-Za-z0-9]+$` and generates them server-side.)
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
        console.log(
          `WorkOS organization ${organizationId} (${DEFAULT_TEST_DATA.organizationName}) already exists.`
        )
      }
    } catch (lookupErr) {
      console.warn(
        `[seed] WorkOS listOrganizations failed; will attempt create: ${
          lookupErr instanceof Error ? lookupErr.message : String(lookupErr)
        }`
      )
    }

    if (!organizationId) {
      const created = await workos.organizations.createOrganization({
        name: DEFAULT_TEST_DATA.organizationName,
      })
      organizationId = created.id
      console.log(
        `Created WorkOS organization: ${organizationId} (${DEFAULT_TEST_DATA.organizationName})`
      )
    }

    // 2. Upsert the admin's membership in this org with roleSlug
    //    "user_admin". We look up by userId+orgId and patch the role if it
    //    already exists.
    if (!organizationId) return

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
        console.log(
          `Updated WorkOS membership ${existingMembership.id} to roleSlug=user_admin.`
        )
      } else {
        console.log(
          `WorkOS membership for ${DEFAULT_TEST_DATA.superAdminUserId} already user_admin.`
        )
      }
    } else {
      await workos.userManagement.createOrganizationMembership({
        organizationId,
        userId: DEFAULT_TEST_DATA.superAdminUserId,
        roleSlug: "user_admin",
      })
      console.log(
        `Created WorkOS membership: user=${DEFAULT_TEST_DATA.superAdminUserId} org=${organizationId} roleSlug=user_admin.`
      )
    }
  } catch (error) {
    console.warn(
      "[seed] WorkOS not reachable — skipping org/membership creation; test user will not pass WorkOS auth."
    )
    if (error instanceof Error) {
      console.warn(`[seed] WorkOS error: ${error.message}`)
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────────────────

const main = async () => {
  const args = process.argv.slice(2)
  const options: SeedOptions = {
    remove: args.includes("--remove"),
  }

  if (args.includes("--help") || args.includes("-h")) {
    usage()
    process.exit(0)
  }

  try {
    if (options.remove) {
      await removeTestData()
    } else {
      console.log("Seeding WhatsApp test data...\n")
      console.log(`Test data prefix: ${SEED_TAG}`)
      console.log(`Organization ID: ${DEFAULT_TEST_DATA.organizationId}\n`)

      await createSuperAdmin()
      await createWhatsAppDevice()
      await createTestContacts()
      await createTestConversations()
      await createTestMessages()
      await createWorkOSOrganizationAndMembership()

      console.log("\nWhatsApp test data seeded successfully!")
    }
  } catch (error) {
    console.error("Seed failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, PlatformRole, WhatsappDeviceStatus } from "@prisma/client"

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
  const existing = await prisma.platformUserRole.findFirst({
    where: { email: DEFAULT_TEST_DATA.superAdminEmail },
  })

  if (existing) {
    if (existing.role === PlatformRole.SUPER_ADMIN) {
      console.log(`Super admin ${DEFAULT_TEST_DATA.superAdminEmail} already exists`)
      return existing
    }

    const updated = await prisma.platformUserRole.update({
      where: { id: existing.id },
      data: { role: PlatformRole.SUPER_ADMIN },
    })
    console.log(`Promoted to super admin: ${DEFAULT_TEST_DATA.superAdminEmail}`)
    return updated
  }

  const created = await prisma.platformUserRole.create({
    data: {
      email: DEFAULT_TEST_DATA.superAdminEmail,
      workosUserId: DEFAULT_TEST_DATA.superAdminUserId,
      role: PlatformRole.SUPER_ADMIN,
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

  await prisma.platformUserRole.deleteMany({
    where: { email: DEFAULT_TEST_DATA.superAdminEmail },
  })

  console.log("WhatsApp test data removed")
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

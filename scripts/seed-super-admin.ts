import { PrismaClient, PlatformRole } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { createHash } from "crypto"

const DATABASE_URL = process.env.DATABASE_URL?.trim()

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable")
  process.exit(1)
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: DATABASE_URL,
  }),
})

interface SeedOptions {
  email?: string
  workosUserId?: string
  remove?: boolean
}

const usage = () => {
  console.log(`
Usage:
  bun run scripts/seed-super-admin.ts --email admin@example.com
  bun run scripts/seed-super-admin.ts --workos-user-id user_xxx
  bun run scripts/seed-super-admin.ts --email admin@example.com --remove  # Remove super admin

Examples:
  # Add super admin by email
  bun run scripts/seed-super-admin.ts --email admin@example.com

  # Add super admin by WorkOS user ID
  bun run scripts/seed-super-admin.ts --workos-user-id user_01xxx

  # Remove super admin by email
  bun run scripts/seed-super-admin.ts --email admin@example.com --remove

  # List all super admins
  bun run scripts/seed-super-admin.ts --list
`)
}

const listSuperAdmins = async () => {
  const superAdmins = await prisma.platformUserRole.findMany({
    where: { role: PlatformRole.SUPER_ADMIN },
    orderBy: { createdAt: "asc" },
  })

  if (superAdmins.length === 0) {
    console.log("No super admins found.")
    return
  }

  console.log(`Found ${superAdmins.length} super admin(s):`)
  for (const admin of superAdmins) {
    console.log(`  - ${admin.email || admin.workosUserId} (created: ${admin.createdAt.toISOString()})`)
  }
}

const createWorkosUserId = (email: string) => {
  return `bootstrap:${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16)}`
}

const addSuperAdmin = async (options: SeedOptions) => {
  const identifier = options.email || options.workosUserId
  if (!identifier) {
    console.error("Error: Must provide --email or --workos-user-id")
    usage()
    process.exit(1)
  }

  const existing = await prisma.platformUserRole.findFirst({
    where: {
      OR: [
        ...(options.email ? [{ email: options.email }] : []),
        ...(options.workosUserId ? [{ workosUserId: options.workosUserId }] : []),
      ],
    },
  })

  if (existing) {
    if (existing.role === PlatformRole.SUPER_ADMIN) {
      console.log(`User ${identifier} is already a super admin.`)
      return
    }

    const updated = await prisma.platformUserRole.update({
      where: { id: existing.id },
      data: { role: PlatformRole.SUPER_ADMIN },
    })
    console.log(`Promoted ${identifier} to super admin.`)
    return updated
  }

  const workosUserId = options.workosUserId || (options.email ? createWorkosUserId(options.email) : undefined)
  if (!workosUserId) {
    console.error("Error: Could not generate workosUserId")
    process.exit(1)
  }

  const created = await prisma.platformUserRole.create({
    data: {
      email: options.email,
      workosUserId,
      role: PlatformRole.SUPER_ADMIN,
    },
  })

  console.log(`Created super admin: ${identifier}`)
  return created
}

const removeSuperAdmin = async (options: SeedOptions) => {
  const identifier = options.email || options.workosUserId
  if (!identifier) {
    console.error("Error: Must provide --email or --workos-user-id")
    usage()
    process.exit(1)
  }

  const existing = await prisma.platformUserRole.findFirst({
    where: {
      OR: [
        ...(options.email ? [{ email: options.email }] : []),
        ...(options.workosUserId ? [{ workosUserId: options.workosUserId }] : []),
      ],
    },
  })

  if (!existing) {
    console.log(`User ${identifier} not found.`)
    return
  }

  if (existing.role !== PlatformRole.SUPER_ADMIN) {
    console.log(`User ${identifier} is not a super admin.`)
    return
  }

  await prisma.platformUserRole.delete({
    where: { id: existing.id },
  })

  console.log(`Removed super admin: ${identifier}`)
}

// CLI mode
const args = process.argv.slice(2)

const parseArgs = (): SeedOptions => {
  const options: SeedOptions = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      options.email = args[i + 1]
      i++
    } else if (args[i] === "--workos-user-id" && args[i + 1]) {
      options.workosUserId = args[i + 1]
      i++
    } else if (args[i] === "--remove") {
      options.remove = true
    } else if (args[i] === "--help" || args[i] === "-h") {
      usage()
      process.exit(0)
    }
  }

  return options
}

const main = async () => {
  if (args.includes("--list")) {
    await listSuperAdmins()
    return
  }

  const options = parseArgs()

  if (args.length === 0 || (!options.email && !options.workosUserId)) {
    usage()
    process.exit(0)
  }

  if (options.remove) {
    await removeSuperAdmin(options)
  } else {
    await addSuperAdmin(options)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error("Seed failed:", error)
    prisma.$disconnect()
    process.exit(1)
  })
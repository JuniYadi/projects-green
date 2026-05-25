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

const INITIAL_EMAIL_ENV_VAR = "INITIAL_SUPER_ADMIN_EMAIL"

interface BootstrapOptions {
  email?: string
  workosUserId?: string
  dryRun?: boolean
}

const bootstrapSuperAdmin = async (options: BootstrapOptions = {}) => {
  const emails = options.email?.split(",").map((e) => e.trim()).filter(Boolean) ||
    process.env[INITIAL_EMAIL_ENV_VAR]?.split(",").map((e) => e.trim()).filter(Boolean) ||
    []

  if (emails.length === 0) {
    console.log("No initial super admin emails configured. Set INITIAL_SUPER_ADMIN_EMAIL env var.")
    return
  }

  const existingSuperAdmins = await prisma.platformUserRole.findMany({
    where: { role: PlatformRole.SUPER_ADMIN },
  })

  if (existingSuperAdmins.length > 0) {
    console.log(`Found ${existingSuperAdmins.length} existing super admin(s). Skipping bootstrap.`)
    return
  }

  console.log("No super admins found. Bootstrapping from env var...")

  const createWorkosUserId = (email: string) => {
  return `bootstrap:${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16)}`
}

const entries: Array<{ email?: string; workosUserId: string }> = emails.map((email) => ({
  email,
  workosUserId: createWorkosUserId(email),
}))

  if (options.dryRun) {
    console.log("[DRY RUN] Would create super admins:")
    entries.forEach((entry) => console.log(`  - ${entry.email}`))
    return
  }

  for (const entry of entries) {
    const platformUserRole = await prisma.platformUserRole.upsert({
      where: {
        ...(entry.email ? { email: entry.email } : { workosUserId: entry.workosUserId! }),
      },
      update: {},
      create: {
        email: entry.email ?? undefined,
        workosUserId: entry.workosUserId ?? undefined,
        role: PlatformRole.SUPER_ADMIN,
      },
    })

    console.log(`Created super admin: ${platformUserRole.email || platformUserRole.workosUserId}`)
  }
}

// CLI mode
const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")

const parseArgs = (): BootstrapOptions => {
  const options: BootstrapOptions = { dryRun: isDryRun }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      options.email = args[i + 1]
      i++
    } else if (args[i] === "--workos-user-id" && args[i + 1]) {
      options.workosUserId = args[i + 1]
      i++
    }
  }

  return options
}

bootstrapSuperAdmin(parseArgs())
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error("Bootstrap failed:", error)
    prisma.$disconnect()
    process.exit(1)
  })
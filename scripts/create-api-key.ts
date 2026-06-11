#!/usr/bin/env bun
/**
 * Issue an API key and print its raw value to stdout.
 *
 * Usage:
 *   bun run scripts/create-api-key.ts --name "My Key" --environment SANDBOX --organizationId org_xxx
 *
 * The raw key is printed ONCE to stdout and never stored. The hash is
 * written to the AuthApiKey table in the database.
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { generateRawApiKey } from "@/lib/whatsapp/crypto"

const args = process.argv.slice(2)

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 ? args[idx + 1] : undefined
}

const name = getArg("name")
const environment = getArg("environment") ?? "SANDBOX"
const organizationId = getArg("organizationId")
const scopesRaw = getArg("scopes")
const scopes = scopesRaw ? scopesRaw.split(",") : ["platform:admin"]

if (!name || !organizationId) {
  console.error(
    "Usage: bun run scripts/create-api-key.ts --name <name> --organizationId <orgId> [--environment SANDBOX|LIVE] [--scopes platform:admin]"
  )
  process.exit(1)
}

if (environment !== "SANDBOX" && environment !== "LIVE") {
  console.error("--environment must be SANDBOX or LIVE")
  process.exit(1)
}

const DATABASE_URL = process.env.DATABASE_URL?.trim()
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable")
  process.exit(1)
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
})

async function main() {
  const prefix = environment === "SANDBOX" ? "test_" : "live_"
  const { raw, hash } = await generateRawApiKey(prefix)

  await prisma.authApiKey.create({
    data: {
      name: name!,
      keyHash: hash,
      environment: environment as "SANDBOX" | "LIVE",
      organizationId: organizationId!,
      scopes,
      active: true,
    },
  })

  console.log(raw)
}

try {
  await main()
} catch (err) {
  console.error("Failed to create API key:", err)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}

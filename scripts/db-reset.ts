#!/usr/bin/env bun
/**
 * Database reset workflow.
 * WARNING: destroys all table data in the database.
 *
 * Usage:
 *   bun run db:reset      # reset database and restore SQL seed dumps
 *   bun run db:reset --yes # non-interactive reset and restore
 */

import { execSync } from "node:child_process"
import { parseArgs } from "node:util"

const { values } = parseArgs({
  options: {
    yes: { type: "boolean", short: "y", default: false },
    help: { type: "boolean", short: "h" },
  },
})

if (values.help) {
  console.log(`db:reset — Database reset workflow

Usage:
  bun run db:reset      # reset database and restore SQL seed dumps
  bun run db:reset --yes # non-interactive reset and restore

WARNING: destroys ALL table data in the database.
`)
  process.exit(0)
}

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error("ERROR: DATABASE_URL is not set")
  process.exit(1)
}

console.log(`\n=== db:reset ===`)
console.log(
  `WARNING: This will drop the database, re-apply migrations, and run seeds.\n`
)

const cmd = values.yes
  ? "bun --bun prisma migrate reset --force"
  : "bun --bun prisma migrate reset"

try {
  execSync(cmd, { stdio: "inherit", env: { ...process.env } })
  execSync("bun run restore:seeds", {
    stdio: "inherit",
    env: { ...process.env },
  })
} catch {
  console.error("\nFAILED: db:reset")
  process.exit(1)
}

console.log("\n=== done ===")

#!/usr/bin/env bun
/**
 * Drop the database.
 * WARNING: destroys all data. Use `bun run db:reset` for the full workflow.
 *
 * Usage:
 *   bun run db:drop
 */

import { execSync } from "node:child_process"

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error("ERROR: DATABASE_URL is not set")
  process.exit(1)
}

let dbName: string
try {
  const url = new URL(dbUrl)
  dbName = url.pathname.replace(/^\//, "") || ""
  if (!dbName) throw new Error("no database name in URL")
} catch {
  console.error("ERROR: could not parse database name from DATABASE_URL")
  process.exit(1)
}

console.log(`Dropping database: ${dbName}`)
try {
  execSync(`dropdb "${dbName}"`, { stdio: "inherit" })
  console.log("Done.")
} catch {
  console.error("Failed.")
  process.exit(1)
}

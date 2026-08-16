#!/usr/bin/env bun
/**
 * Dump seed data from the current database to prisma/seeds/<Table>.sql
 *
 * Usage:
 *   bun run dump:seeds                       # dump all tables from manifest
 *   bun run dump:seeds --tables=User,Org     # dump specific tables only
 *
 * Requires psql and pg_dump in PATH (PostgreSQL client tools).
 * Reads DATABASE_URL from environment.
 *
 * Idempotency: uses --on-conflict-do-nothing so re-running restore is safe.
 * Table names are resolved via information_schema — no manual mapping needed.
 */

import { execSync } from "node:child_process"
import { mkdirSync, readFileSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { SEED_TABLES } from "@/prisma/seeds/manifest"

const { values } = parseArgs({
  options: {
    tables: { type: "string", short: "t" },
    output: { type: "string", short: "o" },
    concurrency: { type: "string", short: "c" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
})

if (values.help) {
  console.log(`dump:seeds — Dump live DB tables to prisma/seeds/<Table>.sql

Usage:
  bun run dump:seeds [--tables=User,Org] [--output=./prisma/seeds] [--concurrency=8]

Options:
  --tables=<csv>        Override tables (default: all from manifest)
  --output=<dir>        Output directory (default: ./prisma/seeds)
  --concurrency=<n>     Parallel pg_dump invocations (default: 8)
  --help, -h            Show this help
`)
  process.exit(0)
}

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error("ERROR: DATABASE_URL is not set")
  process.exit(1)
}

// pg_dump doesn't support ?schema= param in URIs — extract and pass via --set
let schema = "public"
let pgUrl = dbUrl

try {
  const url = new URL(dbUrl)
  if (url.searchParams.has("schema")) {
    schema = url.searchParams.get("schema") ?? "public"
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
      console.error(
        `ERROR: invalid schema name in DATABASE_URL: "${schema}". ` +
          `Only [a-zA-Z_][a-zA-Z0-9_] characters allowed.`
      )
      process.exit(1)
    }
    url.searchParams.delete("schema")
    pgUrl = url.toString().replace(/\?$/, "")
  }
} catch {
  pgUrl = dbUrl
}

// Find the best pg_dump binary
function findPgDump(): string {
  for (const bin of ["pg_dump18", "pg_dump17", "pg_dump16", "pg_dump"]) {
    try {
      execSync(`${bin} --version`, { stdio: "ignore" })
      return bin
    } catch {
      // not found, try next
    }
  }
  return "pg_dump"
}

// Query actual table names from information_schema
function getDbTableNames(): Set<string> {
  const sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE'`
  const out = execSync(`psql "${pgUrl}" -t -c "${sql}"`, { encoding: "utf8" })
  return new Set(
    out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
  )
}

const pgDump = findPgDump()
const outDir = values.output ?? "./prisma/seeds"
const concurrency = Math.max(
  1,
  parseInt((values.concurrency as string) ?? "8", 10)
)

const tablesArg = values.tables as string | undefined
const tablesToDump: readonly string[] = tablesArg
  ? tablesArg.split(",").map((t) => t.trim())
  : SEED_TABLES

if (tablesArg) {
  const manifestSet = new Set<string>(SEED_TABLES)
  for (const t of tablesToDump) {
    if (!manifestSet.has(t)) {
      console.error(
        `ERROR: "${t}" is not in prisma/seeds/manifest.ts — add it first`
      )
      process.exit(1)
    }
  }
}

mkdirSync(outDir, { recursive: true })
console.log(`Using ${pgDump}  concurrency=${concurrency}  schema=${schema}\n`)

// Resolve actual DB table names via information_schema (handles @map() + schema drift)
const dbTables = getDbTableNames()
console.log(`Found ${dbTables.size} tables in DB\n`)

interface DumpResult {
  table: string
  dbTableName: string
  status: "ok" | "skipped" | "error"
  rowCount: number
  message: string
}

function dumpTable(table: string): DumpResult {
  // Lowercase model name is the default; also try TABLE_NAME_MAP keys
  const dbTableName = dbTables.has(table)
    ? table
    : dbTables.has(table.toLowerCase())
      ? table.toLowerCase()
      : table.toLowerCase()

  if (!dbTables.has(dbTableName)) {
    return {
      table,
      dbTableName,
      status: "skipped",
      rowCount: 0,
      message: "not found in DB",
    }
  }

  const filePath = join(outDir, `${table}.sql`)
  const extraFlags =
    schema !== "public" ? `--set "search_path=${schema},public"` : ""

  try {
    // Use --file to write directly instead of stdout capture (avoids execSync buffer limit)
    execSync(
      `${pgDump} "${pgUrl}" --data-only --inserts --column-inserts --on-conflict-do-nothing --no-comments ${extraFlags} -t '"${dbTableName}"' --file="${filePath}"`,
      { stdio: ["pipe", "pipe", "pipe"] }
    )

    const sql = readFileSync(filePath, "utf8")
    const rowMatches = sql.match(/^INSERT INTO /gm)
    const rowCount = rowMatches ? rowMatches.length : 0
    if (rowCount === 0) {
      unlinkSync(filePath)
      return {
        table,
        dbTableName,
        status: "skipped",
        rowCount: 0,
        message: "empty — skipped",
      }
    }
    return { table, dbTableName, status: "ok", rowCount, message: "" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      table,
      dbTableName,
      status: "error",
      rowCount: 0,
      message: msg.split("\n")[0],
    }
  }
}

// Run dumps in batches of `concurrency`
const results: DumpResult[] = []
for (let i = 0; i < tablesToDump.length; i += concurrency) {
  const batch = tablesToDump.slice(i, i + concurrency)
  const batchResults = batch.map(dumpTable)
  results.push(...batchResults)

  for (const r of batchResults) {
    if (r.status === "ok") {
      process.stdout.write(
        `  ${r.table} (${r.dbTableName}) ✓ ${r.rowCount} row(s)\n`
      )
    } else if (r.status === "skipped") {
      process.stdout.write(`  ${r.table} ⊘ ${r.message}\n`)
    } else {
      process.stdout.write(`  ${r.table} ✗ ${r.message}\n`)
    }
  }
}

console.log()
const errors = results.filter((r) => r.status === "error")
const skipped = results.filter((r) => r.status === "skipped")
const ok = results.filter((r) => r.status === "ok")

console.log(
  `Done: ${ok.length} dumped  ${skipped.length} skipped  ${errors.length} errors`
)

if (errors.length > 0) {
  console.error("\nErrors:")
  for (const e of errors) console.error(`  ${e.table}: ${e.message}`)
  process.exit(1)
}

#!/usr/bin/env bun
/**
 * Centralized seed runner.
 *
 * Discovers seeders from lib/seeders/system/ and lib/seeders/dummy/,
 * filters by classification, sorts by runOrder, and executes them.
 *
 * Usage:
 *   bun run seed:all                    — Run all seeders (system + dummy)
 *   bun run seed:system                 — Run only system seeders
 *   bun run seed:dummy                  — Run only dummy seeders
 *
 *   bun run scripts/seed-runner.ts --list                — List available seeders
 *   bun run scripts/seed-runner.ts --seed=Currencies     — Run a specific seeder
 *   bun run scripts/seed-runner.ts --unseed=Name         — Remove seeded data
 *
 * Individual seeders may accept additional flags (e.g., --dry-run) which
 * they parse from process.argv directly.
 */

import { logger } from "@/lib/logger"
import {
  discoverSeeders,
  getSeeders,
  listSeeders,
  type SeederClass,
} from "@/lib/seeders/registry"
import type { SeedClassification } from "@/lib/seeders/base-seeder"
import { prisma } from "@/lib/prisma"

// ── CLI Arg Parsing ───────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2)

const flags = new Set(
  rawArgs.filter((a) => a.startsWith("-") && !a.includes("="))
)

const params = new Map(
  rawArgs
    .filter((a) => a.startsWith("-") && a.includes("="))
    .map((a) => {
      const idx = a.indexOf("=")
      return [a.slice(0, idx), a.slice(idx + 1)] as const
    })
)

// ── Types ──────────────────────────────────────────────────────────────────

interface RunStats {
  name: string
  classification: SeedClassification
  created: number
  updated: number
  deleted: number
  skipped: number
  errors: string[]
  durationMs: number
}

// ── List Command ──────────────────────────────────────────────────────────

async function runList(): Promise<void> {
  await discoverSeeders()
  const configs = listSeeders()

  if (configs.length === 0) {
    logger.info(
      {
        event: "seed.runner.list.empty",
        count: 0,
      },
      "No seeders registered"
    )
    console.log("\n  No seeders registered.\n")
    return
  }

  logger.info(
    {
      event: "seed.runner.list",
      count: configs.length,
      seeders: configs.map((c) => ({
        name: c.name,
        classification: c.classification,
        runOrder: c.runOrder,
        tag: c.seedTag ?? null,
        description: c.description,
      })),
    },
    `Available Seeders (${configs.length})`
  )

  console.log("\n📋 Available Seeders\n")
  console.log(
    "  " +
      "Name".padEnd(32) +
      "Type".padEnd(10) +
      "Order".padEnd(7) +
      "Tag".padEnd(22) +
      "Description"
  )
  console.log("  " + "─".repeat(95))

  for (const c of configs) {
    const icon = c.classification === "system" ? "⚙️" : "🧪"
    const typeCol = `${icon} ${c.classification}`
    const tag = c.seedTag ?? "—"
    console.log(
      "  " +
        c.name.padEnd(32) +
        typeCol.padEnd(10) +
        String(c.runOrder).padEnd(7) +
        tag.padEnd(22) +
        c.description
    )
  }
  console.log()
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ── Seed / Unseed ─────────────────────────────────────────────────────────

async function runSeeders(
  mode: "seed" | "unseed",
  classification?: SeedClassification
): Promise<void> {
  await discoverSeeders()

  const specific = params.get("--seed") ?? params.get("--unseed")
  const allSeeders = getSeeders(classification)

  const targets = specific
    ? allSeeders.filter((s) => s.seederName === specific)
    : allSeeders

  if (specific && targets.length === 0) {
    logger.error(
      {
        event: "seed.runner.not_found",
        seeder: specific,
      },
      `Seeder "${specific}" not found`
    )
    process.exit(1)
  }

  if (targets.length === 0) {
    logger.info(
      {
        event: "seed.runner.no_targets",
        classification: classification ?? "all",
      },
      "No seeders found for the given criteria"
    )
    return
  }

  const label =
    classification === "system"
      ? "system"
      : classification === "dummy"
        ? "dummy"
        : "all"

  const verb = mode === "unseed" ? "Unseed" : "Seed"
  logger.info(
    {
      event: "seed.runner.batch.started",
      mode,
      classification: label,
      count: targets.length,
      targets: targets.map((t) => t.seederName),
    },
    `${verb} [${label}] — ${targets.length} seeder(s)`
  )

  const stats: RunStats[] = []
  let hasErrors = false

  for (const SeederClass of targets) {
    const entry = await runOne(SeederClass, mode)
    stats.push(entry)
    if (entry.errors.length > 0) hasErrors = true
  }

  printSummary(stats)

  if (hasErrors) {
    process.exitCode = 1
  }
}

/**
 * Run a single seeder. Returns stats regardless of success/failure.
 */
async function runOne(
  SeederClass: SeederClass,
  mode: "seed" | "unseed"
): Promise<RunStats> {
  const { seederName, classification } = SeederClass

  // Check required env vars
  const missing = SeederClass.validateEnv()
  if (missing.length > 0) {
    logger.info(
      {
        event: "seed.runner.seeder.skipped",
        seeder: seederName,
        classification,
        missingEnv: missing,
      },
      `${seederName} — skipped (missing: ${missing.join(", ")})`
    )
    return {
      name: seederName,
      classification,
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 1,
      errors: [],
      durationMs: 0,
    }
  }

  const instance = SeederClass.create(params)
  const start = Date.now()
  const caughtErrors: string[] = []

  try {
    if (mode === "unseed") {
      await instance.unseed()
    } else {
      await instance.seed()
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    caughtErrors.push(msg)
  }

  const result = instance.getResult()
  const durationMs = Date.now() - start
  const allErrors = [...result.errors, ...caughtErrors]

  if (allErrors.length > 0) {
    logger.error(
      {
        event: "seed.runner.seeder.failed",
        seeder: seederName,
        classification,
        mode,
        durationMs,
        errors: allErrors,
      },
      `Seeder ${seederName} failed with ${allErrors.length} error(s)`
    )
  } else {
    logger.info(
      {
        event: "seed.runner.seeder.completed",
        seeder: seederName,
        classification,
        mode,
        durationMs,
        created: result.created,
        updated: result.updated,
        deleted: result.deleted,
        skipped: result.skipped,
      },
      `Seeder ${seederName} completed in ${durationMs}ms`
    )
  }

  return {
    ...result,
    errors: allErrors,
    durationMs,
  }
}

// ── Summary Output ────────────────────────────────────────────────────────

function printSummary(stats: RunStats[]): void {
  if (stats.length === 0) return

  const totals = { created: 0, updated: 0, deleted: 0, skipped: 0, errors: 0 }

  for (const s of stats) {
    totals.created += s.created
    totals.updated += s.updated
    totals.deleted += s.deleted
    totals.skipped += s.skipped
    totals.errors += s.errors.length
  }

  logger.info(
    {
      event: "seed.runner.summary",
      totals,
      stats: stats.map((s) => ({
        name: s.name,
        classification: s.classification,
        created: s.created,
        updated: s.updated,
        deleted: s.deleted,
        skipped: s.skipped,
        errors: s.errors,
        durationMs: s.durationMs,
      })),
    },
    `Seed runner summary: created=${totals.created} updated=${totals.updated} deleted=${totals.deleted} skipped=${totals.skipped} errors=${totals.errors}`
  )

  console.log("\n📊 Summary\n")
  console.log(
    "  " +
      "Seeder".padEnd(32) +
      "Created".padEnd(9) +
      "Updated".padEnd(9) +
      "Deleted".padEnd(9) +
      "Skipped".padEnd(9) +
      "Errors".padEnd(8) +
      "Time"
  )
  console.log("  " + "─".repeat(90))

  for (const s of stats) {
    const icon = s.errors.length > 0 ? "❌" : "✅"
    console.log(
      "  " +
        `${icon} ${s.name}`.padEnd(32) +
        String(s.created).padEnd(9) +
        String(s.updated).padEnd(9) +
        String(s.deleted).padEnd(9) +
        String(s.skipped).padEnd(9) +
        String(s.errors.length).padEnd(8) +
        fmtDuration(s.durationMs)
    )

    for (const err of s.errors) {
      console.log(`         ⚠️  ${err}`)
    }
  }

  console.log("  " + "─".repeat(90))
  console.log(
    "  " +
      "TOTAL".padEnd(32) +
      String(totals.created).padEnd(9) +
      String(totals.updated).padEnd(9) +
      String(totals.deleted).padEnd(9) +
      String(totals.skipped).padEnd(9) +
      String(totals.errors).padEnd(8)
  )
  console.log()
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // List command
  if (flags.has("--list") || flags.has("-l")) {
    await runList()
    return
  }

  // Determine classification filter
  let classification: SeedClassification | undefined
  if (flags.has("--system")) classification = "system"
  else if (flags.has("--dummy")) classification = "dummy"
  // --all or --seed/--unseed without filter → run all

  // Validate we have something to do
  if (
    !flags.has("--system") &&
    !flags.has("--dummy") &&
    !flags.has("--all") &&
    !params.has("--seed") &&
    !params.has("--unseed")
  ) {
    logger.error(
      {
        event: "seed.runner.invalid_usage",
      },
      "Usage: seed-runner [--system|--dummy|--all|--list|--seed=Name|--unseed=Name]"
    )
    process.exit(1)
  }

  // Determine mode
  const mode: "seed" | "unseed" = params.has("--unseed") ? "unseed" : "seed"

  await runSeeders(mode, classification)
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}

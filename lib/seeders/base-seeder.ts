/**
 * Base Seeder
 *
 * Abstract base class for all seeders. Each seeder extends this class and
 * overrides:
 *   - `seed()` (required) — apply the seed data
 *   - `unseed()` (optional) — remove seeded data
 *   - Static config: `name`, `classification`, `runOrder`, `description`
 *
 * The base class provides:
 *   - Shared PrismaClient singleton (from @/lib/prisma)
 *   - Result tracking (created/updated/deleted/skipped/errors)
 *   - Structured logging via `log()` and `warn()`
 *   - Idempotency support via `seedTag`
 *   - Static `create()` factory for runner integration
 */

import { prisma } from "@/lib/prisma"
import type { PrismaClient } from "@prisma/client"

// ── Types ──────────────────────────────────────────────────────────────────

export type SeedClassification = "system" | "dummy"

export interface SeedResult {
  name: string
  classification: SeedClassification
  created: number
  updated: number
  deleted: number
  skipped: number
  errors: string[]
}

export interface SeederConfig {
  name: string
  classification: SeedClassification
  runOrder: number
  description: string
  seedTag: string | null
  requiredEnvVars: readonly string[]
}

// ── Abstract Base Class ────────────────────────────────────────────────────

export abstract class BaseSeeder {
  // ── Static Configuration (override in subclass) ────────────────────────

  /**
   * Unique name for this seeder.
   * Used for logging, identification, and CLI selection.
   * Note: cannot use `name` as it conflicts with Function.name.
   */
  static readonly seederName: string = "unnamed"

  /**
   * Classification: "system" (production-required) or "dummy" (dev/test only).
   * Determines which runner flags include this seeder.
   */
  static readonly classification: SeedClassification = "system"

  /**
   * Execution order — lower numbers run first.
   * Use tens: 10, 20, 30... to leave room for insertions.
   * Default: 100.
   */
  static readonly runOrder: number = 100

  /**
   * Human-readable description for --list output.
   */
  static readonly description: string = ""

  /**
   * Optional tag for idempotent seeding.
   * When set, the runner can check whether data with this tag already
   * exists before calling seed(). Use for dummy seeders that create
   * unique tagged records (e.g., "console-demo-v1").
   */
  static readonly seedTag: string | null = null

  /**
   * Environment variables required by this seeder.
   * The runner validates these before calling seed().
   */
  static readonly requiredEnvVars: readonly string[] = []

  /**
   * Creates an instance of this seeder.
   * Subclasses can override to accept constructor arguments.
   */
  static create(
    cliArgs: Map<string, string> = new Map()
  ): InstanceType<typeof BaseSeeder> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new (this as any)(cliArgs)
  }

  // ── Instance Properties ────────────────────────────────────────────────

  /** Shared PrismaClient singleton from @/lib/prisma. */
  protected readonly prisma: PrismaClient = prisma

  /** CLI arguments forwarded from the runner (--key=value pairs). */
  protected readonly cliArgs: Map<string, string>

  /** Accumulated result summary. */
  protected result: SeedResult

  constructor(cliArgs: Map<string, string> = new Map()) {
    this.cliArgs = cliArgs
    const ctor = this.constructor as typeof BaseSeeder
    this.result = {
      name: ctor.seederName,
      classification: ctor.classification,
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      errors: [],
    }
  }

  // ── Lifecycle Hooks (override in subclass) ─────────────────────────────

  /**
   * Apply the seed. Called by the runner.
   * Use trackCreated(), trackUpdated(), trackSkipped() to record counts.
   * Use log() for structured logging.
   */
  abstract seed(): Promise<void>

  /**
   * Remove seeded data. Optional — not all seeders support teardown.
   * Used for dummy seeders to clean up after themselves.
   */
  async unseed(): Promise<void> {
    this.log("unseed() not implemented — skipping")
  }

  // ── Result Tracking ────────────────────────────────────────────────────

  protected trackCreated(count = 1): void {
    this.result.created += count
  }

  protected trackUpdated(count = 1): void {
    this.result.updated += count
  }

  protected trackDeleted(count = 1): void {
    this.result.deleted += count
  }

  protected trackSkipped(count = 1): void {
    this.result.skipped += count
  }

  protected trackError(message: string): void {
    this.result.errors.push(message)
  }

  // ── Logging ────────────────────────────────────────────────────────────

  protected log(message: string): void {
    const seederName = (this.constructor as typeof BaseSeeder).seederName
    console.log(`  [${seederName}] ${message}`)
  }

  protected warn(message: string): void {
    const seederName = (this.constructor as typeof BaseSeeder).seederName
    console.warn(`  [${seederName}] ⚠ ${message}`)
  }

  // ── Result Access ──────────────────────────────────────────────────────

  getResult(): SeedResult {
    return { ...this.result }
  }

  // ── Static Helpers for Runner ──────────────────────────────────────────

  /**
   * Get the seeder configuration as a plain object.
   * Used by the runner for listing, filtering, and validation.
   */
  static getConfig(): SeederConfig {
    return {
      name: this.seederName,
      classification: this.classification,
      runOrder: this.runOrder,
      description: this.description,
      seedTag: this.seedTag,
      requiredEnvVars: this.requiredEnvVars,
    }
  }

  /**
   * Validate that all required environment variables are set.
   * Returns an array of missing variable names (empty if all present).
   */
  static validateEnv(): string[] {
    return this.requiredEnvVars.filter(
      (varName) => !process.env[varName]?.trim()
    )
  }
}

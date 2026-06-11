/**
 * Seeder Registry
 *
 * Central registry for discovering and managing seeders.
 * Seeders self-register by calling `registerSeeder()` at module load time.
 * The runner uses `discoverSeeders()` to dynamically import all `.seeder.ts`
 * files from the system/ and dummy/ directories.
 */

import { readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { BaseSeeder, type SeedClassification, type SeederConfig } from "./base-seeder"

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Type for a concrete seeder class.
 * Captures both the static config (on the class) and the instance shape.
 */
export interface SeederClass {
  new (): BaseSeeder
  readonly seederName: string
  readonly classification: SeedClassification
  readonly runOrder: number
  readonly description: string
  readonly seedTag: string | null
  readonly requiredEnvVars: readonly string[]
  getConfig(): SeederConfig
  validateEnv(): string[]
  create(cliArgs?: Map<string, string>): BaseSeeder
}

// ── Registry State ─────────────────────────────────────────────────────────

const registry = new Map<string, SeederClass>()
let discovered = false

// ── Registration ───────────────────────────────────────────────────────────

/**
 * Register a seeder class. Called by each seeder module at import time.
 * Throws if a seeder with the same name is already registered.
 */
export function registerSeeder(cls: SeederClass): void {
  const name = cls.seederName
  if (registry.has(name)) {
    throw new Error(`Seeder "${name}" is already registered`)
  }
  registry.set(name, cls)
}

// ── Discovery ──────────────────────────────────────────────────────────────

/**
 * Dynamically import all `.seeder.ts` / `.seeder.js` files from
 * `lib/seeders/system/` and `lib/seeders/dummy/`.
 * Each module is expected to call `registerSeeder()` on import.
 * Idempotent — subsequent calls are no-ops.
 */
export async function discoverSeeders(): Promise<void> {
  if (discovered) return
  discovered = true

  const seedersDir = join(process.cwd(), "lib", "seeders")
  const subdirs: Array<"system" | "dummy"> = ["system", "dummy"]

  for (const sub of subdirs) {
    const dir = join(seedersDir, sub)
    if (!existsSync(dir)) continue

    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".seeder.ts") || f.endsWith(".seeder.js"))
      .sort()

    for (const file of files) {
      await import(join(dir, file))
    }
  }
}

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Get registered seeders, optionally filtered by classification,
 * sorted by runOrder (ascending).
 */
export function getSeeders(
  classification?: SeedClassification,
): SeederClass[] {
  const all = Array.from(registry.values())
  const filtered = classification
    ? all.filter((s) => s.classification === classification)
    : all
  return filtered.sort((a, b) => a.runOrder - b.runOrder)
}

/**
 * Get config objects for all registered seeders (sorted by runOrder).
 */
export function listSeeders(): SeederConfig[] {
  return getSeeders().map((s) => s.getConfig())
}

/**
 * Get a seeder by name, or undefined if not found.
 */
export function getSeeder(name: string): SeederClass | undefined {
  return registry.get(name)
}

// ── Test Helpers ───────────────────────────────────────────────────────────

/**
 * Clear the registry and reset the discovery flag.
 * Only for use in tests.
 */
export function clearRegistry(): void {
  registry.clear()
  discovered = false
}

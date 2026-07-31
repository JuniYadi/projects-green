import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { BaseSeeder, registerSeeder } from "@/lib/seeders"
import { SEED_TABLES } from "@/prisma/seeds/manifest"

const SEEDS_DIR = join(process.cwd(), "prisma/seeds")

export class SqlRestoreSeeder extends BaseSeeder {
  static override readonly seederName = "SqlRestore"
  static override readonly classification = "system" as const
  static override readonly runOrder = 1 // runs before other system seeders
  static override readonly description =
    "Restore data from prisma/seeds/*.sql files (FK-safe, idempotent via ON CONFLICT DO NOTHING)"

  async seed(): Promise<void> {
    if (!existsSync(SEEDS_DIR)) {
      this.log("No prisma/seeds directory found — skipping SQL restore")
      return
    }
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      const message = "DATABASE_URL is required for SQL restore"
      this.trackError(message)
      this.warn(message)
      return
    }
    // psql/libpq rejects Prisma's ?schema= param — strip it for psql only
    let psqlDatabaseUrl = databaseUrl
    try {
      const url = new URL(databaseUrl)
      if (url.searchParams.has("schema")) {
        url.searchParams.delete("schema")
        psqlDatabaseUrl = url.toString().replace(/\?$/, "")
      }
    } catch {
      // non-URI conninfo strings pass to psql unchanged
    }

    for (const table of SEED_TABLES) {
      const filePath = join(SEEDS_DIR, `${table}.sql`)
      if (!existsSync(filePath)) {
        this.warn(`No dump file for table ${table} — skipping`)
        continue
      }

      const sql = readFileSync(filePath, "utf8").trim()
      if (!sql) {
        this.warn(`Empty dump file for ${table} — skipping`)
        continue
      }

      try {
        const proc = Bun.spawn(
          [
            "psql",
            psqlDatabaseUrl,
            "--file",
            filePath,
            "--set",
            "ON_ERROR_STOP=1",
            "--single-transaction",
          ],
          { stdout: "ignore", stderr: "pipe" }
        )
        const exitCode = await proc.exited
        if (exitCode !== 0) {
          const stderr = await new Response(proc.stderr).text()
          throw new Error(stderr.trim() || `psql exited with code ${exitCode}`)
        }
        this.trackCreated()
        this.log(`Restored ${table}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.trackError(`${table}: ${msg}`)
        this.warn(`Failed to restore ${table}: ${msg.split("\n")[0]}`)
      }
    }
  }

  async unseed(): Promise<void> {
    // Reverse order to respect FK constraints (children first, then parents)
    for (const table of [...SEED_TABLES].reverse()) {
      const filePath = join(SEEDS_DIR, `${table}.sql`)
      if (!existsSync(filePath)) continue

      try {
        await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`)
        this.trackDeleted()
        this.log(`Truncated ${table}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.trackError(`${table} truncate: ${msg}`)
      }
    }
  }
}

registerSeeder(SqlRestoreSeeder)

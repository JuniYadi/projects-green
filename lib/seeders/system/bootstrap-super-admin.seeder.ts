/**
 * Bootstrap Super Admin Seeder (System)
 *
 * Creates the initial super admin platform user roles from
 * INITIAL_SUPER_ADMIN_EMAIL env var. Only runs when no super admins
 * exist yet (idempotent guard). Migrated from
 * scripts/bootstrap-super-admin.ts.
 */

import { BaseSeeder, registerSeeder } from "@/lib/seeders"
import { AuthPlatformRole } from "@prisma/client"
import { createHash } from "crypto"

const INITIAL_EMAIL_ENV_VAR = "INITIAL_SUPER_ADMIN_EMAIL"

function createWorkosUserId(email: string): string {
  return `bootstrap:${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16)}`
}

export class BootstrapSuperAdminSeeder extends BaseSeeder {
  static override readonly seederName = "BootstrapSuperAdmin"
  static override readonly classification = "system" as const
  static override readonly runOrder = 40
  static override readonly description =
    "Initial super admin platform user roles from env var"

  async seed(): Promise<void> {
    const emails =
      process.env[INITIAL_EMAIL_ENV_VAR]?.split(",")
        .map((e) => e.trim())
        .filter(Boolean) ?? []

    if (emails.length === 0) {
      this.warn(
        `No initial super admin emails configured. Set ${INITIAL_EMAIL_ENV_VAR} env var.`
      )
      this.trackSkipped()
      return
    }

    const existingSuperAdmins = await this.prisma.authPlatformUserRole.findMany(
      {
        where: { role: AuthPlatformRole.SUPER_ADMIN },
      }
    )

    if (existingSuperAdmins.length > 0) {
      this.log(
        `Found ${existingSuperAdmins.length} existing super admin(s). Skipping bootstrap.`
      )
      this.trackSkipped()
      return
    }

    this.log("No super admins found. Bootstrapping from env var...")

    const entries: Array<{ email: string; workosUserId: string }> = emails.map(
      (email) => ({
        email,
        workosUserId: createWorkosUserId(email),
      })
    )

    for (const entry of entries) {
      const platformUserRole = await this.prisma.authPlatformUserRole.upsert({
        where: {
          ...(entry.email
            ? { email: entry.email }
            : { workosUserId: entry.workosUserId }),
        },
        update: {},
        create: {
          email: entry.email ?? undefined,
          workosUserId: entry.workosUserId ?? undefined,
          role: AuthPlatformRole.SUPER_ADMIN,
        },
      })

      this.trackCreated()
      this.log(
        `Created super admin: ${platformUserRole.email || platformUserRole.workosUserId}`
      )
    }
  }
}

registerSeeder(BootstrapSuperAdminSeeder)

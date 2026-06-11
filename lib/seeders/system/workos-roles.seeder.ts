/**
 * WorkOS Roles Seeder (System)
 *
 * Seeds default environment roles in WorkOS.
 * Converted from scripts/seed-workos-roles.mjs.
 *
 * Requires WORKOS_API_KEY environment variable.
 */

import { BaseSeeder, registerSeeder } from "@/lib/seeders"
import { WorkOS } from "@workos-inc/node"

const DEFAULT_ROLES = [
  {
    slug: "owner",
    name: "Owner",
    description: "Tenant owner with full management permissions.",
  },
  {
    slug: "admin",
    name: "Admin",
    description: "Tenant administrator role.",
  },
  {
    slug: "member",
    name: "Member",
    description: "Default tenant member role.",
  },
  {
    slug: "user_owner",
    name: "User Owner",
    description: "User target with owner organization permission.",
  },
  {
    slug: "user_admin",
    name: "User Admin",
    description: "User target with admin organization permission.",
  },
  {
    slug: "user_member",
    name: "User Member",
    description: "User target with member organization permission.",
  },
]

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase()
}

export class WorkosRolesSeeder extends BaseSeeder {
  static override readonly seederName = "WorkosRoles"
  static override readonly classification = "system" as const
  static override readonly runOrder = 5
  static override readonly description =
    "Default WorkOS environment roles (owner, admin, member, etc.)"
  static override readonly requiredEnvVars: readonly string[] = [
    "WORKOS_API_KEY",
  ]

  async seed(): Promise<void> {
    const workos = new WorkOS(process.env.WORKOS_API_KEY)

    this.log("Seeding WorkOS environment roles...")

    const existing = await workos.authorization.listEnvironmentRoles()
    const existingBySlug = new Map(
      existing.data.map((role) => [normalizeSlug(role.slug), role]),
    )

    for (const roleSpec of DEFAULT_ROLES) {
      const slug = normalizeSlug(roleSpec.slug)
      const current = existingBySlug.get(slug)

      if (current) {
        this.trackSkipped()
        this.log(`Role "${current.slug}" already exists — skipping`)
        continue
      }

      const created = await workos.authorization.createEnvironmentRole({
        slug: roleSpec.slug,
        name: roleSpec.name,
        description: roleSpec.description,
      })

      this.trackCreated()
      this.log(`Created role "${created.slug}"`)
    }
  }
}

registerSeeder(WorkosRolesSeeder)

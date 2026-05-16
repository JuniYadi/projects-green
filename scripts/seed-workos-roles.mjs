import { WorkOS } from "@workos-inc/node"

const REQUIRED_ENV_VARS = ["WORKOS_API_KEY"]

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
  {
    slug: "admin_owner",
    name: "Admin Owner",
    description: "Admin target with owner role (treated as superadmin claim).",
  },
]

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")

const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => {
  const value = process.env[name]?.trim()
  return !value
})

if (missingEnvVars.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missingEnvVars.join(", ")}`
  )
  process.exit(1)
}

const workos = new WorkOS(process.env.WORKOS_API_KEY)

const normalizeSlug = (value) => value.trim().toLowerCase()

try {
  const existing = await workos.authorization.listEnvironmentRoles()
  const existingBySlug = new Map(
    existing.data.map((role) => [normalizeSlug(role.slug), role])
  )

  const report = {
    existing: [],
    created: [],
  }

  for (const roleSpec of DEFAULT_ROLES) {
    const slug = normalizeSlug(roleSpec.slug)
    const current = existingBySlug.get(slug)

    if (current) {
      report.existing.push({
        slug: current.slug,
        name: current.name,
      })
      continue
    }

    if (dryRun) {
      report.created.push({
        slug: roleSpec.slug,
        name: roleSpec.name,
        dryRun: true,
      })
      continue
    }

    const created = await workos.authorization.createEnvironmentRole({
      slug: roleSpec.slug,
      name: roleSpec.name,
      description: roleSpec.description,
    })

    report.created.push({
      slug: created.slug,
      name: created.name,
      dryRun: false,
    })
  }

  console.log("WorkOS role seed completed.")
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  console.error("Failed to seed WorkOS environment roles.")
  if (error instanceof Error) {
    console.error(error.message)
  }
  process.exit(1)
}

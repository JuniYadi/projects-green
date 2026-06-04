import { createHash } from "crypto"

import { PlatformRole, type PlatformUserRole } from "@prisma/client"

import { prisma } from "@/lib/prisma"

type ParsedAdminRoleArgs =
  | { action: "list" }
  | { action: "add"; email: string }
  | { action: "add"; workosUserId: string }
  | { action: "delete"; email: string }
  | { action: "delete"; workosUserId: string }

type AdminIdentifier = { email: string } | { workosUserId: string }

export function usage() {
  return [
    "Usage:",
    "  bun run admin:role --list",
    "  bun run admin:role --add --email admin@example.com",
    "  bun run admin:role --add --workos-user-id user_123",
    "  bun run admin:role --delete --email admin@example.com",
    "  bun run admin:role --delete --workos-user-id user_123",
  ].join("\n")
}

export function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? ""
  return normalized.length > 0 ? normalized : null
}

export function normalizeWorkosUserId(value?: string | null) {
  const normalized = value?.trim() ?? ""
  return normalized.length > 0 ? normalized : null
}

export function createBootstrapWorkosUserId(email: string) {
  return `bootstrap:${createHash("sha256").update(email).digest("hex").slice(0, 16)}`
}

export function parseAdminRoleArgs(args: string[]): ParsedAdminRoleArgs {
  const hasList = args.includes("--list")
  const hasAdd = args.includes("--add")
  const hasDelete = args.includes("--delete")
  const actionCount = [hasList, hasAdd, hasDelete].filter(Boolean).length

  if (actionCount !== 1) {
    throw new Error("Exactly one action flag is required")
  }

  const emailIndex = args.indexOf("--email")
  const workosUserIdIndex = args.indexOf("--workos-user-id")
  const email = emailIndex >= 0 ? normalizeEmail(args[emailIndex + 1]) : null
  const workosUserId = workosUserIdIndex >= 0 ? normalizeWorkosUserId(args[workosUserIdIndex + 1]) : null

  if (hasList) {
    if (email || workosUserId) {
      throw new Error("--list does not accept an identifier")
    }

    return { action: "list" }
  }

  if ((email ? 1 : 0) + (workosUserId ? 1 : 0) !== 1) {
    throw new Error("Provide exactly one identifier")
  }

  if (hasAdd && email) {
    return { action: "add", email }
  }

  if (hasAdd && workosUserId) {
    return { action: "add", workosUserId }
  }

  if (hasDelete && email) {
    return { action: "delete", email }
  }

  if (hasDelete && workosUserId) {
    return { action: "delete", workosUserId }
  }

  throw new Error("Invalid arguments")
}

function toLookupWhere(identifier: AdminIdentifier) {
  if ("email" in identifier) {
    return { OR: [{ email: normalizeEmail(identifier.email) ?? "" }] }
  }

  return { OR: [{ workosUserId: normalizeWorkosUserId(identifier.workosUserId) ?? "" }] }
}

export async function listSuperAdmins(): Promise<PlatformUserRole[]> {
  return prisma.platformUserRole.findMany({
    where: { role: PlatformRole.SUPER_ADMIN },
    orderBy: { createdAt: "asc" },
  })
}

export async function addSuperAdmin(identifier: AdminIdentifier) {
  const existing = await prisma.platformUserRole.findFirst({
    where: toLookupWhere(identifier),
  })

  if (existing?.role === PlatformRole.SUPER_ADMIN) {
    return { status: "already-super-admin", record: existing }
  }

  if (existing) {
    const updated = await prisma.platformUserRole.update({
      where: { id: existing.id },
      data: { role: PlatformRole.SUPER_ADMIN },
    })

    return { status: "promoted", record: updated }
  }

  const email = "email" in identifier ? normalizeEmail(identifier.email) : null
  const workosUserId = "workosUserId" in identifier
    ? normalizeWorkosUserId(identifier.workosUserId)
    : email
      ? createBootstrapWorkosUserId(email)
      : null

  if (!workosUserId) {
    throw new Error("Could not determine workos user id")
  }

  const created = await prisma.platformUserRole.create({
    data: {
      email,
      workosUserId,
      role: PlatformRole.SUPER_ADMIN,
    },
  })

  return { status: "created", record: created }
}

export async function deleteSuperAdmin(identifier: AdminIdentifier) {
  const existing = await prisma.platformUserRole.findFirst({
    where: toLookupWhere(identifier),
  })

  if (!existing || existing.role !== PlatformRole.SUPER_ADMIN) {
    throw new Error("Super admin not found")
  }

  await prisma.platformUserRole.delete({ where: { id: existing.id } })

  return { status: "deleted", record: existing }
}

export function formatSuperAdmin(record: PlatformUserRole) {
  return [
    record.id,
    record.email ?? "-",
    record.workosUserId,
    record.createdAt.toISOString(),
  ].join("\t")
}

export async function runAdminRoleCli(args: string[]) {
  const parsed = parseAdminRoleArgs(args)

  if (parsed.action === "list") {
    const rows = await listSuperAdmins()

    if (rows.length === 0) {
      console.log("No super admins found.")
      return
    }

    console.log("id\temail\tworkosUserId\tcreatedAt")
    for (const row of rows) {
      console.log(formatSuperAdmin(row))
    }
    return
  }

  if (parsed.action === "add") {
    const result = await addSuperAdmin(parsed)
    console.log(`${result.status}: ${result.record.email ?? result.record.workosUserId}`)
    return
  }

  const result = await deleteSuperAdmin(parsed)
  console.log(`${result.status}: ${result.record.email ?? result.record.workosUserId}`)
}

if (import.meta.main) {
  runAdminRoleCli(process.argv.slice(2))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : "Admin role command failed")
      console.error(usage())
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}

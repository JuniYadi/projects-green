import { prisma } from "@/lib/prisma"

/** Billing operations address every registered platform user, regardless of role. */
export async function getPlatformAdminEmails(): Promise<string[]> {
  try {
    const records = await prisma.authPlatformUserRole.findMany({
      where: { email: { not: null } },
      select: { email: true },
    })
    return Array.from(
      new Set(
        records
          .map((record) => record.email?.trim().toLowerCase())
          .filter((email): email is string =>
            Boolean(email && email.includes("@"))
          )
      )
    )
  } catch (error) {
    console.error("[PlatformRole] Failed to resolve platform emails:", error)
    return []
  }
}

/**
 * Resolves email addresses of all platform SUPER_ADMIN users from AuthPlatformUserRole.
 */
export async function getPlatformSuperAdminEmails(): Promise<string[]> {
  try {
    const records = await prisma.authPlatformUserRole.findMany({
      where: {
        role: "SUPER_ADMIN",
        email: { not: null },
      },
      select: {
        email: true,
      },
    })

    const emails = records
      .map((r) => r.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email && email.includes("@")))

    return Array.from(new Set(emails))
  } catch (error) {
    console.error("[PlatformRole] Failed to resolve super admin emails:", error)
    return []
  }
}

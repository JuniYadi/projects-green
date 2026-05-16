import { prisma } from "@/lib/prisma"

export type PlatformAccessRole = "none" | "super_admin"

const toPlatformAccessRole = (
  role: string | null | undefined
): PlatformAccessRole => {
  if (role === "SUPER_ADMIN" || role === "super_admin") {
    return "super_admin"
  }

  return "none"
}

const normalizeEmail = (value: string | null | undefined) => {
  return value?.trim().toLowerCase() ?? null
}

type PlatformUserRoleRecord = {
  role?: string | null
}

type PlatformUserRoleDelegate = {
  findFirst: (args: {
    where: {
      OR: Array<{ workosUserId?: string; email?: string }>
    }
  }) => Promise<PlatformUserRoleRecord | null>
}

export const getPlatformRoleForUser = async (
  user: { id?: string | null; email?: string | null } | null | undefined
): Promise<PlatformAccessRole> => {
  const workosUserId = user?.id?.trim()
  const email = normalizeEmail(user?.email)

  if (!workosUserId && !email) {
    return "none"
  }

  const platformUserRoleDelegate = (prisma as unknown as {
    platformUserRole?: PlatformUserRoleDelegate
  }).platformUserRole

  if (!platformUserRoleDelegate) {
    return "none"
  }

  const platformUserRole = await platformUserRoleDelegate.findFirst({
    where: {
      OR: [
        ...(workosUserId ? [{ workosUserId }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
  })

  return toPlatformAccessRole(platformUserRole?.role ?? undefined)
}

import { prisma } from "@/lib/prisma"

export type PlatformAccessRole = "none" | "super_admin"

export type PlatformAccess = {
  exists: boolean
  role: PlatformAccessRole
}

const toPlatformAccessRole = (
  role: string | null | undefined
): PlatformAccessRole => {
  if (role === "SUPER_ADMIN") {
    return "super_admin"
  }

  return "none"
}

export const getPlatformAccessForUser = async (
  user: { id?: string | null; email?: string | null } | null | undefined
): Promise<PlatformAccess> => {
  const workosUserId = user?.id?.trim()
  const email = user?.email?.trim().toLowerCase() ?? null

  if (!workosUserId && !email) {
    return { exists: false, role: "none" }
  }

  try {
    const record = await prisma.platformUserRole.findFirst({
      where: {
        OR: [
          ...(workosUserId ? [{ workosUserId }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    })
    return {
      exists: Boolean(record),
      role: toPlatformAccessRole(record?.role ?? undefined),
    }
  } catch {
    // DB failure: deny access rather than exposing internal errors
    return { exists: false, role: "none" }
  }
}

export const getPlatformRoleForUser = async (
  user: { id?: string | null; email?: string | null } | null | undefined
): Promise<PlatformAccessRole> => {
  const access = await getPlatformAccessForUser(user)

  return access.role
}

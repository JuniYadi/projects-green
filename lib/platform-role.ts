import { prisma } from "@/lib/prisma"

export type PlatformAccessRole = "none" | "super_admin"

const toPlatformAccessRole = (
  role: string | null | undefined
): PlatformAccessRole => {
  if (role === "SUPER_ADMIN") {
    return "super_admin"
  }

  return "none"
}

export const getPlatformRoleForUser = async (
  user: { id?: string | null; email?: string | null } | null | undefined
): Promise<PlatformAccessRole> => {
  const workosUserId = user?.id?.trim()
  const email = user?.email?.trim().toLowerCase() ?? null

  if (!workosUserId && !email) {
    return "none"
  }

  const record = await prisma.platformUserRole.findFirst({
    where: {
      OR: [
        ...(workosUserId ? [{ workosUserId }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
  })

  return toPlatformAccessRole(record?.role ?? undefined)
}

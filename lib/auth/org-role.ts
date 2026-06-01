import { createWorkOS } from "@workos-inc/node"

export const ORG_ROLES = ["owner", "admin", "member"] as const
export type OrgRole = (typeof ORG_ROLES)[number]

export const resolveOrgRole = async (
  userId: string,
  organizationId: string
): Promise<OrgRole | null> => {
  try {
    const workos = createWorkOS({ apiKey: process.env.WORKOS_API_KEY ?? "" })
    const memberships = await workos.userManagement
      .listOrganizationMemberships({
        userId,
        organizationId,
        statuses: ["active"],
      })
      .then((r) => r.autoPagination())

    const active = memberships[0]
    if (!active?.role?.slug) return null

    const slug = active.role.slug.toLowerCase()
    if (slug === "user_owner") return "owner"
    if (slug === "user_admin") return "admin"
    if (slug === "user_member") return "member"
    return null
  } catch {
    return null
  }
}

import { createWorkOS } from "@workos-inc/node"

/**
 * Resolve the first active organization membership for a WorkOS user.
 * Returns `null` (no org) when the user has no active memberships, or when
 * the WorkOS SDK call fails (network / 401). Failures are logged once.
 */
export const resolveFirstActiveOrganization = async (
  userId: string
): Promise<{ organizationId: string } | null> => {
  try {
    const workos = createWorkOS({ apiKey: process.env.WORKOS_API_KEY ?? "" })
    const memberships = await workos.userManagement
      .listOrganizationMemberships({
        userId,
        statuses: ["active"],
      })
      .then((r) => r.autoPagination())

    const first = memberships[0]
    if (!first?.organizationId) return null
    return { organizationId: first.organizationId }
  } catch (err) {
    console.warn(
      "[whatsapp-auth] workos membership lookup failed",
      err instanceof Error ? err.message : err
    )
    return null
  }
}

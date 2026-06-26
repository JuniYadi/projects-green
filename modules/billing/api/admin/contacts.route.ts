import { Elysia } from "elysia"
import { z } from "zod"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { toBillingContactDTO } from "../../billing.dto"

type BillingAuthContext = {
  organizationId?: string | null
  user: { id: string; email?: string | null } | null
}

type RouteSet = { status?: number | string }

type AdminContactsDeps = {
  authenticate: () => Promise<BillingAuthContext>
  getPlatformRole: (input: {
    id?: string | null
    email?: string | null
  }) => Promise<string>
}

const defaultDeps: AdminContactsDeps = {
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
}

export const createAdminBillingContactsRoutes = (
  deps: Partial<AdminContactsDeps> = {}
) => {
  const { authenticate, getPlatformRole } = { ...defaultDeps, ...deps }

  return new Elysia().get(
    "/admin/billing/orgs/:orgId/contacts",
    async ({ params, set }) => {
      const auth = await authenticate()
      if (!auth.user) {
        set.status = 401
        return { ok: false as const, error: "UNAUTHORIZED", message: "You must be signed in." }
      }

      const role = await getPlatformRole({ id: auth.user.id, email: auth.user.email })
      if (role !== "super_admin") {
        set.status = 403
        return { ok: false as const, error: "FORBIDDEN", message: "Only super administrators can manage billing contacts." }
      }

      const { orgId } = params as { orgId: string }
      const parsed = z.string().uuid().safeParse(orgId)
      if (!parsed.success) {
        set.status = 422
        return { ok: false as const, error: "VALIDATION_ERROR", message: "Invalid organization ID." }
      }

      const account = await prisma.billingAccount.findUnique({
        where: { organizationId: parsed.data },
        include: { contacts: { orderBy: { createdAt: "asc" } } },
      })

      if (!account) {
        set.status = 404
        return { ok: false as const, error: "NOT_FOUND", message: "Billing account not found." }
      }

      return {
        ok: true as const,
        id: account.id,
        organizationId: account.organizationId,
        contacts: account.contacts.map(toBillingContactDTO),
      }
    }
  )
}

export const adminBillingContactsRoutes = createAdminBillingContactsRoutes()

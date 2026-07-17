import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import {
  listCredentials,
  upsertCredential,
  deleteCredential,
} from "../cloudflare-dns.service"

const requireAuth = async (set: { status?: number | string }) => {
  const auth = await withAuth({ ensureSignedIn: true })
  if (!auth.user) {
    set.status = 401
    return { ok: false, error: "UNAUTHORIZED" } as const
  }
  if (!auth.organizationId) {
    set.status = 403
    return {
      ok: false,
      error: "FORBIDDEN",
      message: "No organization selected",
    } as const
  }
  return auth
}

export const cloudflareDnsTokenRoutes = new Elysia({
  prefix: "/api/integrations/cloudflare/dns-token",
}).get(
  "/",
  async ({ set }) => {
    const auth = await requireAuth(set)
    if (!("user" in auth)) return auth

    const credentials = await listCredentials(auth.organizationId!)
    return { ok: true, credentials }
  }
)

.post(
  "/",
  async ({ body, set }) => {
    const auth = await requireAuth(set)
    if (!("user" in auth)) return auth

    const credential = await upsertCredential({
      organizationId: auth.organizationId!,
      name: body.name,
      token: body.token,
    })
    return {
      ok: true,
      credential: {
        id: credential.id,
        name: credential.name,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
        maskedToken: credential.maskedToken,
      },
    }
  },
  {
    body: t.Object({
      name: t.String(),
      token: t.String(),
    }),
  }
)

.delete(
  "/",
  async ({ query, set }) => {
    const auth = await requireAuth(set)
    if (!("user" in auth)) return auth

    await deleteCredential({ organizationId: auth.organizationId!, id: query.id })
    return { ok: true }
  },
  {
    query: t.Object({
      id: t.String(),
    }),
  }
)

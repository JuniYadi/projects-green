import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import {
  listCredentials,
  upsertCredential,
  deleteCredential,
} from "../cloudflare-dns.service"

export const cloudflareDnsTokenRoutes = new Elysia({
  prefix: "/api/integrations/cloudflare/dns-token",
}).get(
  "/",
  async ({ set }) => {
    const auth = await withAuth({ ensureSignedIn: true })
    if (!auth.user) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }
    if (!auth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "No organization selected" }
    }
    const credentials = await listCredentials(auth.organizationId)
    return { ok: true, credentials }
  }
)

.post(
  "/",
  async ({ body, set }) => {
    const auth = await withAuth({ ensureSignedIn: true })
    if (!auth.user) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }
    if (!auth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "No organization selected" }
    }
    const { name, token } = body as { name: string; token: string }
    const credential = await upsertCredential({
      organizationId: auth.organizationId,
      name,
      token,
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
    const auth = await withAuth({ ensureSignedIn: true })
    if (!auth.user) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }
    if (!auth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "No organization selected" }
    }
    const { id } = query as { id: string }
    await deleteCredential({ organizationId: auth.organizationId, id })
    return { ok: true }
  },
  {
    query: t.Object({
      id: t.String(),
    }),
  }
)

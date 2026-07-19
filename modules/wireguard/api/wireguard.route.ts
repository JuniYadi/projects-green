import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import { prisma } from "@/lib/prisma"
import { WireGuardService } from "../wireguard.service"
import { WireGuardSshAdapter } from "../wireguard-ssh-adapter"

const wireguard = new WireGuardService(prisma, new WireGuardSshAdapter())

// ponytail: no auth middleware abstraction yet (same as vpn.route.ts pattern);
// extract requireAdmin into shared helper when a third route needs it.
async function requireAdmin(): Promise<
  { ok: true; orgId: string } | { ok: false; status: number; body: unknown }
> {
  const auth = await withAuth()
  if (!auth.user) {
    return {
      ok: false,
      status: 401,
      body: { error: "UNAUTHORIZED", message: "Not signed in" },
    }
  }
  if (!auth.organizationId) {
    return {
      ok: false,
      status: 403,
      body: { error: "FORBIDDEN", message: "No organization" },
    }
  }
  const roles = new Set([auth.role, ...(auth.roles ?? [])].filter(Boolean))
  const isAdmin = ["admin", "owner", "super_admin"].some((r) => roles.has(r))
  if (!isAdmin) {
    return {
      ok: false,
      status: 403,
      body: { error: "FORBIDDEN", message: "Admin role required" },
    }
  }
  return { ok: true, orgId: auth.organizationId }
}

export const wireguardRoutes = new Elysia({ prefix: "/portal/vpn/wireguard" })
  .get("/peers", async ({ set }) => {
    const auth = await requireAdmin()
    if (!auth.ok) {
      set.status = auth.status
      return auth.body
    }

    try {
      const peers = await wireguard.listPeers()
      return { peers }
    } catch (err) {
      set.status = 503
      return {
        error: "SSH_CONNECTION_FAILED",
        message:
          err instanceof Error ? err.message : "WireGuard server unreachable",
      }
    }
  })
  .post(
    "/peers",
    async ({ body, set }) => {
      const auth = await requireAdmin()
      if (!auth.ok) {
        set.status = auth.status
        return auth.body
      }

      try {
        const result = await wireguard.createPeer(body.username, auth.orgId)
        set.status = 201
        return result
      } catch (err) {
        const e = err as Error & { statusCode?: number }
        if (e.statusCode === 409 || e.message.includes("already exists")) {
          set.status = 409
          return { error: "CONFLICT", message: e.message }
        }
        set.status = 503
        return { error: "SSH_CONNECTION_FAILED", message: e.message }
      }
    },
    { body: t.Object({ username: t.String({ minLength: 1 }) }) }
  )
  .delete("/peers/:username", async ({ params, set }) => {
    const auth = await requireAdmin()
    if (!auth.ok) {
      set.status = auth.status
      return auth.body
    }

    try {
      await wireguard.removePeer(params.username)
      return { ok: true }
    } catch (err) {
      set.status = 503
      return {
        error: "SSH_CONNECTION_FAILED",
        message: err instanceof Error ? err.message : "Failed to remove peer",
      }
    }
  })
  .get("/peers/:username/config", async ({ params, set }) => {
    const auth = await requireAdmin()
    if (!auth.ok) {
      set.status = auth.status
      return auth.body
    }

    try {
      const config = await wireguard.getConfig(params.username)
      return new Response(config, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "content-disposition": `attachment; filename="${params.username}.conf"`,
        },
      })
    } catch (err) {
      set.status = 503
      return {
        error: "CONFIG_FETCH_FAILED",
        message: err instanceof Error ? err.message : "Failed to fetch config",
      }
    }
  })
  .get("/peers/:username/qr", async ({ params, set }) => {
    const auth = await requireAdmin()
    if (!auth.ok) {
      set.status = auth.status
      return auth.body
    }

    try {
      const qrDataUrl = await wireguard.getQr(params.username)
      // qrDataUrl is "data:image/png;base64,..."
      const base64 = qrDataUrl.split(",")[1]
      if (!base64) {
        set.status = 500
        return {
          error: "QR_GENERATION_FAILED",
          message: "Failed to generate QR code",
        }
      }

      const png = Buffer.from(base64, "base64")
      return new Response(png, {
        headers: {
          "content-type": "image/png",
          "cache-control": "private, max-age=3600",
        },
      })
    } catch (err) {
      set.status = 503
      return {
        error: "QR_GENERATION_FAILED",
        message: err instanceof Error ? err.message : "Failed to generate QR",
      }
    }
  })

/**
 * Debug endpoint — returns the current auth context regardless of auth method.
 *
 * Browser (cookie):  GET  /api/auth/whoami
 * curl (API key):    curl http://localhost:3300/api/auth/whoami \
 *                      -H "Authorization: Bearer live_xxx"
 *
 * The response shape mirrors the whatsappAuth context injected by
 * whatsappAuthPlugin, so you can verify session resolution from any client.
 */
import { Elysia } from "elysia"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"

export const authWhoamiRoute = new Elysia()
  .get("/auth/whoami", async ({ request, query }: { request: Request; query: Record<string, string | undefined> }) => {
    const auth = await resolveAuthContext(request)
    if (!auth) {
      if (query.strict === "1") {
        return { status: 401 as const, ok: false as const, error: "UNAUTHORIZED" as const, message: "Valid WorkOS session or API key required." }
      }
      return { ok: false as const, auth: null, message: "No valid session or API key. Try: curl ... -H 'Authorization: Bearer live_xxx'" }
    }
    const { source, ...rest } = auth
    return { ok: true as const, auth: { ...rest, source } }
  })
import { Elysia } from "elysia"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { apiCallTracker } from "../rate-limit.service"

export const rateLimitRoutes = new Elysia({ prefix: "/rate-limit" }).get(
  "/status",
  async ({
    request,
    set,
    query,
  }: {
    request: any
    set: any
    query: any
  }) => {
    const auth = await resolveAuthContext(request)
    if (!auth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }

    const { deviceId } = query as { deviceId?: string }
    const callsLastMinute = deviceId
      ? await apiCallTracker.getCallCount(deviceId, 1)
      : 0
    const errorsLast5Min = deviceId
      ? await apiCallTracker.getRecentErrors(deviceId, 5)
      : 0

    return { ok: true, callsLastMinute, errorsLast5Min }
  }
)

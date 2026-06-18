import { Elysia } from "elysia"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { apiCallTracker } from "../rate-limit.service"
import { prisma } from "@/lib/prisma"

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
    if (!auth.organizationId) {
      set.status = 400
      return { ok: false, error: "NO_ORGANIZATION" }
    }

    const { deviceId: rawDeviceId } = query as { deviceId?: string | null };
    if (!rawDeviceId) {
      set.status = 400;
      return { ok: false, error: "DEVICE_ID_REQUIRED" };
    }

    const deviceId = rawDeviceId;

    // Verify device ownership
    const device = await prisma.whatsappDevice.findUnique({
      where: {
        id: deviceId,
        organizationId: auth.organizationId,
      },
    });

    if (!device) {
      set.status = 404;
      return { ok: false, error: "DEVICE_NOT_FOUND_OR_UNAUTHORIZED" };
    }

    const callsLastMinute = await apiCallTracker.getCallCount(
      device.id, // Use device.id which is definitely a string
      1
    );
    const errorsLast5Min = await apiCallTracker.getRecentErrors(
      device.id, // Use device.id which is definitely a string
      5
    );

    return { ok: true, callsLastMinute, errorsLast5Min }
  }
)

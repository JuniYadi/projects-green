import { Elysia, t } from "elysia"

import {
  requireSuperAdmin,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"
import { verifyJenkinsHmacSignature } from "@/modules/deploy/jenkins-webhook-auth"
import {
  defaultRuntimeManifestService,
  RuntimeManifestService,
} from "@/modules/deploy/runtime-manifest.service"

export async function isAuthorizedForManifestSync(
  headers: Headers | Record<string, string | undefined>,
  rawBody: string,
  set: RouteSet
): Promise<boolean> {
  const syncSecret =
    process.env.RUNTIME_MANIFEST_SYNC_SECRET ||
    process.env.JENKINS_WEBHOOK_TOKEN

  const headerToken =
    headers instanceof Headers
      ? headers.get("x-runtime-sync-token") ||
        headers.get("authorization")?.replace(/^Bearer\s+/i, "")
      : headers["x-runtime-sync-token"] ||
        headers["authorization"]?.replace(/^Bearer\s+/i, "")

  if (syncSecret && headerToken && headerToken === syncSecret) {
    return true
  }

  if (
    syncSecret &&
    verifyJenkinsHmacSignature(rawBody, headers, syncSecret)
  ) {
    return true
  }

  try {
    const adminActor = await requireSuperAdmin(set)
    if ("ok" in adminActor && adminActor.ok) {
      return true
    }
  } catch {
    // Super admin check not applicable or failed
  }

  return false
}

export type RuntimeManifestSyncRouteDeps = {
  manifestService?: RuntimeManifestService
  authCheck?: typeof isAuthorizedForManifestSync
}

export const createRuntimeManifestSyncRoutes = (
  deps: RuntimeManifestSyncRouteDeps = {}
) => {
  const manifestService =
    deps.manifestService ?? defaultRuntimeManifestService
  const authCheck = deps.authCheck ?? isAuthorizedForManifestSync

  return new Elysia({ prefix: "/admin/runtimes" })
    .get(
      "/manifests",
      async ({ query, request, set }) => {
        const authorized = await authCheck(request.headers, "", set)
        if (!authorized) {
          if (!set.status || set.status === 200) {
            set.status = 401
          }
          return {
            ok: false as const,
            error: "UNAUTHORIZED",
            message: "Missing super admin access or valid sync credentials.",
          }
        }

        try {
          if (query.framework) {
            const manifest = await manifestService.getRuntimeManifest(
              query.framework
            )
            return {
              ok: true as const,
              data: manifest,
            }
          }

          const records = await manifestService.listManifests()
          return {
            ok: true as const,
            data: records,
          }
        } catch (error) {
          set.status = 500
          return {
            ok: false as const,
            error: "INTERNAL_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch manifests",
          }
        }
      },
      {
        query: t.Object({
          framework: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/sync-manifests",
      async ({ body, request, set }) => {
        let rawBody = ""
        try {
          rawBody = await request.clone().text()
        } catch {
          rawBody = ""
        }
        if (!rawBody) {
          rawBody = JSON.stringify(body)
        }

        const authorized = await authCheck(request.headers, rawBody, set)
        if (!authorized) {
          if (!set.status || set.status === 200) {
            set.status = 401
          }
          return {
            ok: false as const,
            error: "UNAUTHORIZED",
            message: "Missing super admin access or valid sync credentials.",
          }
        }

        try {
          const synced = await manifestService.syncManifests(body)
          return {
            ok: true as const,
            data: synced,
            count: synced.length,
          }
        } catch (error) {
          set.status = 400
          return {
            ok: false as const,
            error: "INVALID_MANIFEST",
            message:
              error instanceof Error
                ? error.message
                : "Invalid runtime manifest schema",
          }
        }
      }
    )
}

export const runtimeManifestSyncRoutes = createRuntimeManifestSyncRoutes()

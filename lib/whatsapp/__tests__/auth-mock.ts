import { mock } from "bun:test"
import { Elysia } from "elysia"

import type { WorkOSScope } from "../auth"

export const mockAuthContext = {
  current: {
    type: "workos" as const,
    userId: "user-1",
    email: "admin@example.com",
    organizationId: "org-1",
    tenantRole: "admin" as const,
    platformRole: "none" as const,
  } as WorkOSScope,
}

export const setMockAuthContext = (overrides: Partial<WorkOSScope> | null) => {
  if (overrides === null) {
    mockAuthContext.current = null as any
  } else {
    mockAuthContext.current = { ...mockAuthContext.current, ...overrides }
  }
}

export const whatsappAuthMock = {
  whatsappAuthPlugin: new Elysia({ name: "whatsapp.auth" })
    .onBeforeHandle((ctx) => {
      const auth = (ctx as any).whatsappAuth
      if (!auth) {
        ctx.set.status = 401
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Valid WorkOS session or API key required.",
        }
      }
    })
    .derive(() => ({
      whatsappAuth: mockAuthContext.current,
    })),
  guardTenantAdmin: (route: any) => async (ctx: any) => {
    const auth = mockAuthContext.current
    if (!auth) {
      ctx.set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }
    const isAdmin =
      auth.tenantRole === "admin" ||
      auth.tenantRole === "owner" ||
      auth.platformRole === "super_admin"
    if (!isAdmin) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(ctx as any).whatsappAuth = auth
    return route(ctx)
  },
  guardSuperAdmin: (route: any) => async (ctx: any) => {
    const auth = mockAuthContext.current
    if (!auth) {
      ctx.set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }
    if (auth.platformRole !== "super_admin") {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(ctx as any).whatsappAuth = auth
    return route(ctx)
  },
  guardWorkOSSession: (route: any) => async (ctx: any) => {
    const auth = mockAuthContext.current
    if (!auth || (auth as any).type !== ("workos" as string)) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(ctx as any).whatsappAuth = auth
    return route(ctx)
  },
  guardApiKey: (route: any) => async (ctx: any) => {
    const auth = mockAuthContext.current
    if (!auth || (auth as any).type !== ("platform" as string)) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(ctx as any).whatsappAuth = auth
    return route(ctx)
  },
  guardTenantMember: (route: any) => async (ctx: any) => {
    const auth = mockAuthContext.current
    if (!auth || (auth as any).organizationId === null) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(ctx as any).whatsappAuth = auth
    return route(ctx)
  },
  requireTenantAdmin: () => {
    const auth = mockAuthContext.current
    return (
      auth.tenantRole === "admin" ||
      auth.tenantRole === "owner" ||
      auth.platformRole === "super_admin"
    )
  },
  requireSuperAdmin: () => mockAuthContext.current.platformRole === "super_admin",
  requireWorkOSSession: () => (mockAuthContext.current.type as string) === "workos",
  requireApiKey: () => (mockAuthContext.current.type as string) === "platform",
  requireTenantMember: () => mockAuthContext.current.organizationId !== null,
  isWorkOSScope: (ctx: any): ctx is WorkOSScope => ctx?.type === "workos",
  isPlatformScope: (ctx: any) => ctx?.type === "platform",
  hashApiKey: async (key: string) => key,
}

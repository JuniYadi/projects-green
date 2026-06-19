import { mock } from "bun:test"
import { Elysia } from "elysia"

import type { WorkOSScope } from "../auth"

export const mockAuthContext = {
  current: {
    type: "workos" as const,
    userId: "user-1",
    email: "admin@example.com",
    organizationId: "org-1",
    orgRole: "admin" as const,
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
  guardOrgRead: (route: any) => async (ctx: any) => {
    const auth = mockAuthContext.current as any
    if (!auth) {
      ctx.set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }
    // Platform API keys pass read access (mirrors real guardOrgRead)
    if (auth.type === "platform") {
      ;(ctx as any).whatsappAuth = auth
      return route(ctx)
    }
    if (!auth.organizationId) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
    ;(ctx as any).whatsappAuth = auth
    return route(ctx)
  },
  guardOrgWrite: (route: any) => async (ctx: any) => {
    const auth = mockAuthContext.current as any
    if (!auth) {
      ctx.set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }
    // Platform API keys pass write access (mirrors real guardOrgWrite)
    if (auth.type === "platform") {
      ;(ctx as any).whatsappAuth = auth
      return route(ctx)
    }
    if (auth.platformRole === "super_admin") {
      ;(ctx as any).whatsappAuth = auth
      return route(ctx)
    }
    const isAdmin = auth.orgRole === "admin" || auth.orgRole === "owner"
    if (!isAdmin) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
    ;(ctx as any).whatsappAuth = auth
    return route(ctx)
  },
  guardOrgFull: (route: any) => async (ctx: any) => {
    const auth = mockAuthContext.current as any
    if (!auth) {
      ctx.set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }
    // Platform keys need platform:admin or * scope for full access (mirrors real guardOrgFull)
    if (auth.type === "platform") {
      const hasAdminScope =
        Array.isArray(auth.scopes) &&
        (auth.scopes.includes("platform:admin") || auth.scopes.includes("*"))
      if (!hasAdminScope) {
        ctx.set.status = 403
        return { ok: false, error: "FORBIDDEN" }
      }
      ;(ctx as any).whatsappAuth = auth
      return route(ctx)
    }
    if (auth.platformRole === "super_admin") {
      ;(ctx as any).whatsappAuth = auth
      return route(ctx)
    }
    if (auth.orgRole !== "owner") {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
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
    ;(ctx as any).whatsappAuth = auth
    return route(ctx)
  },
  guardWorkOSSession: (route: any) => async (ctx: any) => {
    const auth = mockAuthContext.current
    if (!auth || (auth as any).type !== ("workos" as string)) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
    ;(ctx as any).whatsappAuth = auth
    return route(ctx)
  },
  guardApiKey: (route: any) => async (ctx: any) => {
    const auth = mockAuthContext.current
    if (!auth || (auth as any).type !== ("platform" as string)) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
    ;(ctx as any).whatsappAuth = auth
    return route(ctx)
  },
  // Backward-compatible aliases
  guardTenantAdmin: (route: any) => async (ctx: any) => {
    const auth = mockAuthContext.current
    if (!auth) {
      ctx.set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }
    const isAdmin =
      auth.orgRole === "admin" ||
      auth.orgRole === "owner" ||
      auth.platformRole === "super_admin"
    if (!isAdmin) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
    ;(ctx as any).whatsappAuth = auth
    return route(ctx)
  },
  guardTenantMember: (route: any) => async (ctx: any) => {
    const auth = mockAuthContext.current
    if (!auth || (auth as any).organizationId === null) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
    ;(ctx as any).whatsappAuth = auth
    return route(ctx)
  },
  requireTenantAdmin: () => {
    const auth = mockAuthContext.current
    return (
      auth.orgRole === "admin" ||
      auth.orgRole === "owner" ||
      auth.platformRole === "super_admin"
    )
  },
  requireSuperAdmin: () =>
    mockAuthContext.current.platformRole === "super_admin",
  requireWorkOSSession: () =>
    (mockAuthContext.current.type as string) === "workos",
  requireApiKey: () => (mockAuthContext.current.type as string) === "platform",
  requireTenantMember: () => mockAuthContext.current.organizationId !== null,
  isWorkOSScope: (ctx: any): ctx is WorkOSScope => ctx?.type === "workos",
  isPlatformScope: (ctx: any) => ctx?.type === "platform",
  hashApiKey: async (key: string) => key,
}

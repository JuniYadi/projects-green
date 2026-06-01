import type { OrgRole } from "./org-role"

export type PlatformScope = {
  type: "platform"
  keyId: string
  keyName: string
  environment: "SANDBOX" | "LIVE"
  scopes: string[]
}

export type WorkOSScope = {
  type: "workos"
  userId: string
  email: string | null
  organizationId: string | null
  orgRole: OrgRole | null
  platformRole: "none" | "super_admin"
}

export type AuthContext = PlatformScope | WorkOSScope

export const isPlatformScope = (ctx: AuthContext): ctx is PlatformScope =>
  ctx.type === "platform"

export const isWorkOSScope = (ctx: AuthContext): ctx is WorkOSScope =>
  ctx.type === "workos"

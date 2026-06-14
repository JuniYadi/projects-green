import type { PlatformAccessRole } from "@/lib/platform-role"
import type { TenantRole } from "@/modules/tenants/tenant-policy"

export type InvoiceActorRoleContext = {
  platformRole: PlatformAccessRole
  tenantRole: TenantRole | null
}

export const canManageInvoiceCancellation = (
  actor: InvoiceActorRoleContext
) => {
  return actor.platformRole === "super_admin"
}

export const canManageInvoiceNotifications = (
  actor: InvoiceActorRoleContext
) => {
  if (actor.platformRole === "super_admin") {
    return true
  }
  return actor.tenantRole === "owner" || actor.tenantRole === "admin"
}

export const canManagePaymentConfirmations = (
  actor: InvoiceActorRoleContext
) => {
  return actor.platformRole === "super_admin"
}

export const canManuallyMarkPaid = (actor: InvoiceActorRoleContext) => {
  return actor.platformRole === "super_admin"
}

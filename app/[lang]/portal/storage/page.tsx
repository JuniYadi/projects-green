import { StorageAuditView } from "@/modules/storage/ui/portal/storage-audit-view"

export const metadata = {
  title: "Storage Audit & Governance | Super Admin Portal",
  description:
    "Cross-tenant S3 storage utilization, presigned upload audit logs, and file management",
}

export default function PortalStoragePage() {
  return <StorageAuditView />
}

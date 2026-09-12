import type { Metadata } from "next"

import { StorageAuditView } from "@/modules/storage/ui/portal/storage-audit-view"

export const metadata: Metadata = {
  title: "Storage Audit & Governance",
  description:
    "Cross-tenant S3 storage utilization, presigned upload audit logs, and file management",
}

export default function PortalStoragePage() {
  return <StorageAuditView />
}

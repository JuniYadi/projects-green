import type { Metadata } from "next"

import { CronJobsManagementView } from "@/modules/admin/ui/portal-cronjobs-view"

export const metadata: Metadata = {
  title: "CronJob & Worker Monitoring",
  description:
    "Kubernetes cronjob telemetry, execution logs, schedule overview, and manual trigger controls",
}

export default function PortalCronJobsPage() {
  return <CronJobsManagementView />
}

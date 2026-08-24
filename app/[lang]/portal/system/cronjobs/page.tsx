import { CronJobsManagementView } from "@/modules/admin/ui/portal-cronjobs-view"

export const metadata = {
  title: "CronJob & Worker Monitoring | Super Admin Portal",
  description:
    "Kubernetes cronjob telemetry, execution logs, schedule overview, and manual trigger controls",
}

export default function PortalCronJobsPage() {
  return <CronJobsManagementView />
}

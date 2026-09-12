export const APP_HOSTING_TRAFFIC_SNAPSHOT_QUEUE = "app-hosting-traffic-snapshot"
export const APP_HOSTING_TRAFFIC_SNAPSHOT_JOB = "process-daily-traffic-snapshot"

export type AppHostingTrafficSnapshotJobData = {
  scheduledAt?: string
  isManual?: boolean
  reason?: string
}

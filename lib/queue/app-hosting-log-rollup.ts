export const APP_HOSTING_LOG_ROLLUP_QUEUE = "app-hosting-log-rollup"
export const APP_HOSTING_LOG_ROLLUP_JOB = "process-hourly-log-rollup"

export type AppHostingLogRollupJobData = {
  scheduledAt?: string
  isManual?: boolean
}

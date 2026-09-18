import { BaseJob } from "@/lib/queue/base-job"
import { logger } from "@/lib/logger"

export type SecurityScanIngestJobData = {
  scanId: string
  storageKey: string
}

export class SecurityScanIngestJob extends BaseJob {
  static readonly queue = "security-scan-ingest"
  static readonly workerConcurrency = 2
  static readonly attempts = 3
  static readonly backoff = { type: "exponential" as const, delay: 5_000 }

  static async dispatch(scanId: string, storageKey: string): Promise<void> {
    await this.enqueue<SecurityScanIngestJobData>(
      { scanId, storageKey },
      { jobId: `security-scan_${scanId}` }
    )
  }

  static async handle(job: { data: SecurityScanIngestJobData }): Promise<void> {
    const { processSecurityScanReport } = await import(
      "@/modules/deploy/workers/security-scan-parser"
    )
    await processSecurityScanReport(job.data.scanId, job.data.storageKey)
  }
}

export async function enqueueSecurityScanIngest(
  scanId: string,
  storageKey: string
): Promise<boolean> {
  try {
    await SecurityScanIngestJob.dispatch(scanId, storageKey)
    return true
  } catch (error) {
    logger.error(
      {
        err: error,
        scanId,
        storageKey,
        event: "security_scan.enqueue_failed",
      },
      `[security-scan-ingest] failed to enqueue scan ingestion ${scanId}`
    )
    return false
  }
}

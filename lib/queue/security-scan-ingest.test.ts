import { describe, expect, it, mock } from "bun:test"
import {
  SecurityScanIngestJob,
  enqueueSecurityScanIngest,
} from "./security-scan-ingest"

describe("SecurityScanIngestJob", () => {
  it("configures expected queue settings", () => {
    expect(SecurityScanIngestJob.queue).toBe("security-scan-ingest")
    expect(SecurityScanIngestJob.workerConcurrency).toBe(2)
    expect(SecurityScanIngestJob.attempts).toBe(3)
  })

  it("dispatches job safely with enqueueSecurityScanIngest helper", async () => {
    const mockDispatch = mock(async () => {})
    SecurityScanIngestJob.dispatch = mockDispatch

    const success = await enqueueSecurityScanIngest(
      "scan-456",
      "tenants/org/report.json"
    )
    expect(success).toBe(true)
    expect(mockDispatch).toHaveBeenCalledWith(
      "scan-456",
      "tenants/org/report.json"
    )
  })

  it("returns false and catches error when dispatch fails", async () => {
    SecurityScanIngestJob.dispatch = mock(async () => {
      throw new Error("Redis connection error")
    })

    const success = await enqueueSecurityScanIngest(
      "scan-789",
      "tenants/org/report.json"
    )
    expect(success).toBe(false)
  })
})

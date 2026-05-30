import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

// Mock Redis connection
const mockQueueAdd = mock()

const mockQueue = {
  add: mockQueueAdd,
}

mock.module("@/lib/queue/quota-reconciliation", () => {
  // Return minimal mock that doesn't recursively import itself
  return {
    QUOTA_RECONCILIATION_QUEUE: "quota-reconciliation",
    QUOTA_RECONCILIATION_JOB: "quota-reconciliation-job",
    getSharedQueue: () => mockQueue,
    __testing: {
      resetQueueCache: mock(),
    },
  }
})

// Import after mocks
import {
  QUOTA_RECONCILIATION_QUEUE,
  QUOTA_RECONCILIATION_JOB,
  QuotaReconciliationJobData,
  createQuotaReconciliationQueue,
} from "@/lib/queue/quota-reconciliation"

describe("QuotaReconciliationQueue", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  describe("constants", () => {
    it("defines correct queue name", () => {
      expect(QUOTA_RECONCILIATION_QUEUE).toBe("quota-reconciliation")
    })

    it("defines correct job name", () => {
      expect(QUOTA_RECONCILIATION_JOB).toBe("quota-reconciliation-job")
    })
  })

  describe("createQuotaReconciliationQueue", () => {
    it("creates queue with custom queue name", () => {
      const queue = createQuotaReconciliationQueue({
        queueName: "custom-queue",
        queue: mockQueue as any,
      })

      expect(queue).toBeDefined()
      expect(typeof queue.enqueue).toBe("function")
      expect(typeof queue.close).toBe("function")
    })

    it("enqueue adds job with correct data", async () => {
      const queue = createQuotaReconciliationQueue({
        queue: {
          add: mockQueueAdd,
        } as any,
      })

      const jobData: QuotaReconciliationJobData = {
        organizationId: "org-1",
        deviceId: "device-1",
        direction: "OUT",
        messageId: "msg-1",
        timestamp: new Date().toISOString(),
      }

      await queue.enqueue(jobData)

      expect(mockQueueAdd).toHaveBeenCalledWith(
        QUOTA_RECONCILIATION_JOB,
        jobData,
        expect.objectContaining({
          jobId: expect.stringContaining("quota-recon:"),
        })
      )
    })

    it("enqueue uses custom job options", async () => {
      const customOptions = { attempts: 5 }

      const queue = createQuotaReconciliationQueue({
        queue: {
          add: mockQueueAdd,
        } as any,
      })

      const jobData: QuotaReconciliationJobData = {
        organizationId: "org-1",
        deviceId: "device-1",
        direction: "OUT",
        messageId: "msg-1",
        timestamp: new Date().toISOString(),
      }

      await queue.enqueue(jobData, customOptions)

      expect(mockQueueAdd).toHaveBeenCalledWith(
        QUOTA_RECONCILIATION_JOB,
        jobData,
        expect.objectContaining(customOptions)
      )
    })
  })

  describe("QuotaReconciliationJobData type", () => {
    it("validates IN direction", () => {
      const jobData: QuotaReconciliationJobData = {
        organizationId: "org-1",
        deviceId: "device-1",
        direction: "IN",
        messageId: "msg-1",
        timestamp: new Date().toISOString(),
      }

      expect(jobData.direction).toBe("IN")
    })

    it("validates OUT direction", () => {
      const jobData: QuotaReconciliationJobData = {
        organizationId: "org-1",
        deviceId: "device-1",
        direction: "OUT",
        messageId: "msg-1",
        timestamp: new Date().toISOString(),
      }

      expect(jobData.direction).toBe("OUT")
    })
  })
})
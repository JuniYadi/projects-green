import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { JobsOptions } from "bullmq"

import {
  createWhatsAppTemplateSyncQueue,
  WHATSAPP_TEMPLATE_SYNC_JOB_NAME,
  type WhatsAppTemplateSyncJobData,
} from "@/lib/queue/whatsapp-template-sync"

const add = mock(
  async (
    _name: string,
    _data: WhatsAppTemplateSyncJobData,
    _opts?: JobsOptions
  ) => undefined
)

describe("createWhatsAppTemplateSyncQueue", () => {
  beforeEach(() => {
    add.mockClear()
  })

  it("uses a fresh job id for each manual template sync enqueue", async () => {
    const queue = createWhatsAppTemplateSyncQueue({ queue: { add } })
    const data: WhatsAppTemplateSyncJobData = {
      organizationId: "org_1",
      deviceId: "dev_1",
      method: "sync-templates",
    }

    await queue.enqueue(data)
    await queue.enqueue(data)

    expect(add).toHaveBeenCalledTimes(2)
    expect(add.mock.calls[0][0]).toBe(WHATSAPP_TEMPLATE_SYNC_JOB_NAME)
    expect(add.mock.calls[0][1]).toEqual(data)
    expect(add.mock.calls[1][1]).toEqual(data)

    const firstJobId = add.mock.calls[0][2]?.jobId
    const secondJobId = add.mock.calls[1][2]?.jobId

    expect(firstJobId).toStartWith(
      "wa-template-sync_org_1_dev_1_sync-templates_"
    )
    expect(secondJobId).toStartWith(
      "wa-template-sync_org_1_dev_1_sync-templates_"
    )
    expect(secondJobId).not.toBe(firstJobId)
  })
})

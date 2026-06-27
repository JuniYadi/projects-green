import { beforeEach, describe, expect, it, mock } from "bun:test"

import {
  createWhatsAppTemplateSyncQueue,
  WHATSAPP_TEMPLATE_SYNC_JOB_NAME,
  type WhatsAppTemplateSyncJobData,
} from "@/lib/queue/whatsapp-template-sync"

// ponytail: params kept for BullMQ add() signature compatibility
const add = mock(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_name: string, _data: unknown, _opts: unknown) =>
    ({ jobId: undefined }) as never
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

    // ponytail: third arg is BullMQ job options with optional jobId
    const firstJobId = (add.mock.calls[0][2] as { jobId?: string } | undefined)?.jobId
    const secondJobId = (add.mock.calls[1][2] as { jobId?: string } | undefined)?.jobId

    expect(firstJobId).toStartWith(
      "wa-template-sync_org_1_dev_1_sync-templates_"
    )
    expect(secondJobId).toStartWith(
      "wa-template-sync_org_1_dev_1_sync-templates_"
    )
    expect(secondJobId).not.toBe(firstJobId)
  })
})

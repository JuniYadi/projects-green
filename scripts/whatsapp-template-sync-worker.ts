import {
  Prisma,
  WhatsappBillingCategory,
  WhatsappTemplateMetaStatus,
  WhatsappTemplateSyncStatus,
} from "@prisma/client"
import { Worker, type Job } from "bullmq"

import { prisma } from "@/lib/prisma"
import {
  WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME,
  getWhatsAppTemplateSyncRedisConnection,
  type WhatsAppTemplateSyncJobData,
} from "@/lib/queue/whatsapp-template-sync"
import { getQueueRuntimeConfig } from "@/lib/queue/queue-config"
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"

type MetaTemplateComponent = {
  type?: string
  format?: string
  text?: string
  buttons?: unknown
  [key: string]: unknown
}

type MetaTemplate = {
  id?: string
  name: string
  language?: string
  status?: string
  category?: string
  components?: MetaTemplateComponent[]
  rejected_reason?: string
  rejection_reason?: string
}

type MetaTemplatePage = {
  data?: MetaTemplate[]
  paging?: {
    cursors?: {
      after?: string
    }
    next?: string
  }
}

export type WhatsAppTemplateSyncSummary = {
  method: WhatsAppTemplateSyncJobData["method"]
  organizationId: string
  deviceId: string
  fetched: number
  created: number
  updated: number
  skipped: number
  notInMeta: number
  failed: number
}

const SUPPORTED_META_STATUSES = new Set<string>([
  WhatsappTemplateMetaStatus.APPROVED,
  WhatsappTemplateMetaStatus.PENDING,
  WhatsappTemplateMetaStatus.REJECTED,
])

function slugifyTemplateName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function toSupportedMetaStatus(status?: string) {
  const normalized = status?.toUpperCase()

  if (!normalized || !SUPPORTED_META_STATUSES.has(normalized)) {
    return null
  }

  return normalized as WhatsappTemplateMetaStatus
}

function getRejectReason(template: MetaTemplate) {
  return template.rejected_reason ?? template.rejection_reason ?? null
}

function getComponent(components: MetaTemplateComponent[], type: string) {
  return components.find(
    (component) => component.type?.toUpperCase() === type.toUpperCase()
  )
}

function toLanguageData(template: MetaTemplate) {
  const components = template.components ?? []
  const header = getComponent(components, "HEADER")
  const body = getComponent(components, "BODY")
  const footer = getComponent(components, "FOOTER")
  const buttons = getComponent(components, "BUTTONS")
  const metaStatus = toSupportedMetaStatus(template.status)

  return {
    lang: template.language ?? "default",
    headerType: header?.format?.toLowerCase() ?? null,
    headerText: typeof header?.text === "string" ? header.text : null,
    body: typeof body?.text === "string" ? body.text : null,
    footer: typeof footer?.text === "string" ? footer.text : null,
    buttons: buttons?.buttons as Prisma.InputJsonValue | undefined,
    parameters: { components } as Prisma.InputJsonValue,
    isApproved: metaStatus === WhatsappTemplateMetaStatus.APPROVED,
    metaStatus,
    rejectReason:
      metaStatus === WhatsappTemplateMetaStatus.REJECTED
        ? getRejectReason(template)
        : null,
  }
}

async function loadDevice(data: WhatsAppTemplateSyncJobData) {
  const device = await prisma.whatsappDevice.findFirst({
    where: {
      id: data.deviceId,
      organizationId: data.organizationId,
    },
    select: {
      id: true,
      token: true,
      tokenEncrypted: true,
      tokenIv: true,
      whatsappPhoneId: true,
      whatsappBusinessAccountId: true,
    },
  })

  if (!device) {
    throw new Error(
      `WhatsApp device not found: organizationId=${data.organizationId} deviceId=${data.deviceId}`
    )
  }

  const encryptedParts = device.tokenEncrypted?.split(".") ?? []
  const accessToken =
    device.tokenEncrypted && device.tokenIv && encryptedParts.length === 2
      ? `${encryptedParts[0]}.${device.tokenIv}.${encryptedParts[1]}`
      : device.tokenEncrypted
  const phoneNumberId = device.whatsappPhoneId
  const wabaId = device.whatsappBusinessAccountId

  if (!accessToken || !phoneNumberId || !wabaId) {
    throw new Error(
      `WhatsApp device is missing Meta credentials: deviceId=${data.deviceId}`
    )
  }

  return {
    accessToken,
    phoneNumberId,
    wabaId,
    organizationId: data.organizationId,
  }
}

async function createClient(data: WhatsAppTemplateSyncJobData) {
  const device = await loadDevice(data)

  return WhatsAppDeviceClient.fromDevice(device)
}

async function fetchAllTemplates(client: WhatsAppDeviceClient) {
  const templates: MetaTemplate[] = []
  let after: string | undefined

  do {
    const page = (await client.listTemplatesPage(after)) as MetaTemplatePage
    templates.push(...(page.data ?? []))
    after = page.paging?.cursors?.after
  } while (after)

  return templates
}

async function upsertTemplate(
  organizationId: string,
  deviceId: string,
  template: MetaTemplate
): Promise<"created" | "updated"> {
  const existing = await prisma.whatsappTemplate.findFirst({
    where: {
      organizationId,
      name: template.name,
    },
    select: { id: true },
  })
  const metaStatus = toSupportedMetaStatus(template.status)
  const languageData = toLanguageData(template)
  const data = {
    slug: slugifyTemplateName(template.name) || template.name,
    name: template.name,
    category: template.category
      ? (template.category as WhatsappBillingCategory)
      : null,
    syncStatus: WhatsappTemplateSyncStatus.SYNCED,
    metaStatus,
    lastSyncedAt: new Date(),
    whatsappDevice: { connect: { id: deviceId } },
  }

  if (!existing) {
    await prisma.whatsappTemplate.create({
      data: {
        ...data,
        organizationId,
        languages: {
          create: languageData,
        },
      },
    })
    return "created"
  }

  await prisma.whatsappTemplate.update({
    where: { id: existing.id },
    data,
  })

  await prisma.whatsappTemplateLanguage.upsert({
    where: {
      templateId_lang: {
        templateId: existing.id,
        lang: languageData.lang,
      },
    },
    create: {
      ...languageData,
      template: { connect: { id: existing.id } },
    },
    update: languageData,
  })

  return "updated"
}

export async function syncTemplates(
  jobData: WhatsAppTemplateSyncJobData,
  correlationId?: string | null
): Promise<WhatsAppTemplateSyncSummary> {
  // ponytail: independent try-catch — audit failure must not break worker flow
  try {
    await logWhatsappAuditEvent({
      action: "TEMPLATE_SYNC_STARTED",
      organizationId: jobData.organizationId,
      deviceId: jobData.deviceId,
      correlationId: correlationId ?? null,
      message: "Template sync started",
      status: "STARTED",
    })
  } catch (e) {
    console.warn("[whatsapp-template-sync-worker] audit failed", e)
  }

  // ponytail: independent try-catch — early-stage errors (createClient, fetchAllTemplates)
  // must also produce a FAILED audit to close the trace
  let client: WhatsAppDeviceClient
  let templates: MetaTemplate[]

  try {
    client = await createClient(jobData)
    templates = await fetchAllTemplates(client)
  } catch (error) {
    try {
      await logWhatsappAuditEvent({
        action: "TEMPLATE_SYNC_FAILED",
        organizationId: jobData.organizationId,
        deviceId: jobData.deviceId,
        correlationId: correlationId ?? null,
        message: "Template sync failed",
        errorMessage: String(error),
        status: "FAILED",
      })
    } catch (e) {
      console.warn("[whatsapp-template-sync-worker] audit failed", e)
    }
    throw error
  }

  const summary: WhatsAppTemplateSyncSummary = {
    method: "sync-templates",
    organizationId: jobData.organizationId,
    deviceId: jobData.deviceId,
    fetched: templates.length,
    created: 0,
    updated: 0,
    skipped: 0,
    notInMeta: 0,
    failed: 0,
  }

  for (const template of templates) {
    try {
      const result = await upsertTemplate(
        jobData.organizationId,
        jobData.deviceId,
        template
      )
      summary[result] += 1
    } catch (error) {
      summary.failed += 1
      console.error(
        `[whatsapp-template-sync-worker] failed template name=${template.name} org=${jobData.organizationId} device=${jobData.deviceId}`,
        error
      )
    }
  }

  // ponytail: mark templates in DB not returned by Meta as NOT_IN_META
  const notInMeta = await prisma.whatsappTemplate.updateMany({
    where: {
      organizationId: jobData.organizationId,
      whatsappDeviceId: jobData.deviceId,
      slug: {
        notIn: templates.map((t) => slugifyTemplateName(t.name) || t.name),
      },
      syncStatus: { not: WhatsappTemplateSyncStatus.NOT_IN_META },
    },
    data: {
      syncStatus: WhatsappTemplateSyncStatus.NOT_IN_META,
    },
  })
  summary.notInMeta = notInMeta.count

  console.info(
    `[whatsapp-template-sync-worker] sync-templates result org=${jobData.organizationId} device=${jobData.deviceId} fetched=${summary.fetched} created=${summary.created} updated=${summary.updated} notInMeta=${summary.notInMeta} failed=${summary.failed}`
  )

  if (summary.failed > 0) {
    try {
      await logWhatsappAuditEvent({
        action: "TEMPLATE_SYNC_FAILED",
        organizationId: jobData.organizationId,
        deviceId: jobData.deviceId,
        correlationId: correlationId ?? null,
        message: "Template sync partially failed",
        errorMessage: `Partial failure: failed=${summary.failed} fetched=${summary.fetched}`,
        status: "FAILED",
        details: { summary } as any,
      })
    } catch (e) {
      console.warn("[whatsapp-template-sync-worker] audit failed", e)
    }
    throw new Error(
      `Template sync partially failed: failed=${summary.failed} fetched=${summary.fetched}`
    )
  }

  try {
    await logWhatsappAuditEvent({
      action: "TEMPLATE_SYNCED",
      organizationId: jobData.organizationId,
      deviceId: jobData.deviceId,
      correlationId: correlationId ?? null,
      message: "Template sync completed",
      status: "OK",
      details: { summary } as any,
    })
  } catch (e) {
    console.warn("[whatsapp-template-sync-worker] audit failed", e)
  }

  return summary
}

export async function syncTemplateStatus(
  jobData: WhatsAppTemplateSyncJobData,
  correlationId?: string | null
): Promise<WhatsAppTemplateSyncSummary> {
  // ponytail: independent try-catch — audit failure must not break worker flow
  try {
    await logWhatsappAuditEvent({
      action: "TEMPLATE_SYNC_STARTED",
      organizationId: jobData.organizationId,
      deviceId: jobData.deviceId,
      correlationId: correlationId ?? null,
      message: "Template status sync started",
      status: "STARTED",
    })
  } catch (e) {
    console.warn("[whatsapp-template-sync-worker] audit failed", e)
  }

  // ponytail: independent try-catch — early-stage errors (createClient, fetchAllTemplates)
  // must also produce a FAILED audit to close the trace
  let client: WhatsAppDeviceClient
  let templates: MetaTemplate[]

  try {
    client = await createClient(jobData)
    templates = await fetchAllTemplates(client)
  } catch (error) {
    try {
      await logWhatsappAuditEvent({
        action: "TEMPLATE_SYNC_FAILED",
        organizationId: jobData.organizationId,
        deviceId: jobData.deviceId,
        correlationId: correlationId ?? null,
        message: "Template status sync failed",
        errorMessage: String(error),
        status: "FAILED",
      })
    } catch (e) {
      console.warn("[whatsapp-template-sync-worker] audit failed", e)
    }
    throw error
  }

  const summary: WhatsAppTemplateSyncSummary = {
    method: "sync-status",
    organizationId: jobData.organizationId,
    deviceId: jobData.deviceId,
    fetched: templates.length,
    created: 0,
    updated: 0,
    skipped: 0,
    notInMeta: 0,
    failed: 0,
  }

  for (const template of templates) {
    try {
      const existing = await prisma.whatsappTemplate.findFirst({
        where: {
          organizationId: jobData.organizationId,
          name: template.name,
        },
        select: { id: true },
      })

      if (!existing) {
        summary.skipped += 1
        continue
      }

      const metaStatus = toSupportedMetaStatus(template.status)
      const languageData = toLanguageData(template)

      await prisma.whatsappTemplate.update({
        where: { id: existing.id },
        data: {
          syncStatus: WhatsappTemplateSyncStatus.SYNCED,
          metaStatus,
          lastSyncedAt: new Date(),
          ...(template.category
            ? { category: template.category as WhatsappBillingCategory }
            : {}),
        },
      })

      await prisma.whatsappTemplateLanguage.upsert({
        where: {
          templateId_lang: {
            templateId: existing.id,
            lang: languageData.lang,
          },
        },
        create: {
          ...languageData,
          template: { connect: { id: existing.id } },
        },
        update: languageData,
      })

      summary.updated += 1
    } catch (error) {
      summary.failed += 1
      console.error(
        `[whatsapp-template-sync-worker] failed template status name=${template.name} org=${jobData.organizationId} device=${jobData.deviceId}`,
        error
      )
    }
  }

  console.info(
    `[whatsapp-template-sync-worker] sync-status result org=${jobData.organizationId} device=${jobData.deviceId} fetched=${summary.fetched} updated=${summary.updated} skipped=${summary.skipped} failed=${summary.failed}`
  )

  if (summary.failed > 0) {
    try {
      await logWhatsappAuditEvent({
        action: "TEMPLATE_SYNC_FAILED",
        organizationId: jobData.organizationId,
        deviceId: jobData.deviceId,
        correlationId: correlationId ?? null,
        message: "Template status sync partially failed",
        errorMessage: `Partial failure: failed=${summary.failed} fetched=${summary.fetched}`,
        status: "FAILED",
        details: { summary } as any,
      })
    } catch (e) {
      console.warn("[whatsapp-template-sync-worker] audit failed", e)
    }
    throw new Error(
      `Template status sync partially failed: failed=${summary.failed} fetched=${summary.fetched}`
    )
  }

  try {
    await logWhatsappAuditEvent({
      action: "TEMPLATE_SYNCED",
      organizationId: jobData.organizationId,
      deviceId: jobData.deviceId,
      correlationId: correlationId ?? null,
      message: "Template status sync completed",
      status: "OK",
      details: { summary } as any,
    })
  } catch (e) {
    console.warn("[whatsapp-template-sync-worker] audit failed", e)
  }

  return summary
}

export async function processWhatsAppTemplateSyncJob(
  job: Job<WhatsAppTemplateSyncJobData>
): Promise<WhatsAppTemplateSyncSummary | undefined> {
  const correlationId = job.id ?? null

  if (job.data.method === "sync-templates") {
    const summary = await syncTemplates(job.data, correlationId)
    await job.log(
      `Sync templates: fetched=${summary.fetched}, created=${summary.created}, updated=${summary.updated}, notInMeta=${summary.notInMeta}, failed=${summary.failed}`
    )
    return summary
  }

  if (job.data.method === "sync-status") {
    const summary = await syncTemplateStatus(job.data, correlationId)
    await job.log(
      `Sync status: fetched=${summary.fetched}, updated=${summary.updated}, skipped=${summary.skipped}, failed=${summary.failed}`
    )
    return summary
  }
}

if (import.meta.main) {
  const redisConnection = getWhatsAppTemplateSyncRedisConnection()
  const { prefix } = getQueueRuntimeConfig()

  const worker = new Worker<WhatsAppTemplateSyncJobData>(
    WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME,
    processWhatsAppTemplateSyncJob,
    {
      connection: redisConnection,
      prefix,
      concurrency: 2,
    }
  )

  worker.on("active", (job) => {
    console.info(
      `[whatsapp-template-sync-worker] processing ${job.name} id=${job.id}`
    )
  })

  worker.on("completed", (job, summary) => {
    console.info(
      `[whatsapp-template-sync-worker] completed ${job.name} id=${job.id} result=${JSON.stringify(summary ?? null)}`
    )
  })

  worker.on("failed", (job, error) => {
    if (!job) {
      console.error(
        "[whatsapp-template-sync-worker] failed job missing payload",
        error
      )
      return
    }

    console.error(
      `[whatsapp-template-sync-worker] failed ${job.name} id=${job.id} attempts=${job.attemptsMade}`,
      error
    )
  })

  let shuttingDown = false

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    console.info(
      `[whatsapp-template-sync-worker] received ${signal}, shutting down`
    )

    try {
      await worker.close()
      process.exit(0)
    } catch (error) {
      console.error(
        "[whatsapp-template-sync-worker] shutdown failed while closing worker",
        error
      )
      process.exit(1)
    }
  }

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM")
  })

  process.on("SIGINT", () => {
    void shutdown("SIGINT")
  })
}

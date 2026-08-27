import {
  Prisma,
  WhatsappBillingCategory,
  WhatsappTemplateMetaStatus,
  WhatsappTemplateSyncStatus,
} from "@prisma/client"
import { Worker, type Job } from "bullmq"

import { prisma } from "@/lib/prisma"
import { getQueueRuntimeConfig } from "@/lib/queue/queue-config"
import {
  WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME,
  getWhatsAppTemplateSyncRedisConnection,
  type WhatsAppTemplateSyncJobData,
} from "@/lib/queue/whatsapp-template-sync"
import { logger } from "@/lib/logger"
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"
import {
  buildMetaTemplateComponents,
  formatTemplateSlug,
} from "@/modules/whatsapp/templates/template-validator"
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
function possibleSlugsFor(name: string): string[] {
  return Array.from(
    new Set(
      [
        formatTemplateSlug(name),
        name,
        name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      ].filter(Boolean)
    )
  )
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
    headerUrl: typeof header?.url === "string" ? header.url : null,
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

async function pushLocalTemplatesToMeta(
  client: WhatsAppDeviceClient,
  organizationId: string,
  deviceId: string
) {
  // Find templates belonging to this org & device that need to be pushed to Meta
  const unpushedTemplates = await prisma.whatsappTemplate.findMany({
    where: {
      organizationId,
      whatsappDeviceId: deviceId,
      OR: [
        { syncStatus: WhatsappTemplateSyncStatus.NOT_SYNCED },
        { metaStatus: null },
      ],
    },
    include: {
      languages: true,
    },
  })

  for (const tpl of unpushedTemplates) {
    for (const lang of tpl.languages) {
      try {
        const components = buildMetaTemplateComponents({
          ...lang,
          category: tpl.category ?? undefined,
        })
        const payload = {
          name: tpl.slug || tpl.name,
          category: tpl.category || "UTILITY",
          language: lang.lang,
          components,
        }
        const metaResult = await client.createTemplate(payload)
        const metaStatus =
          toSupportedMetaStatus(metaResult.status) ??
          WhatsappTemplateMetaStatus.PENDING

        await prisma.whatsappTemplate.update({
          where: { id: tpl.id },
          data: {
            syncStatus: WhatsappTemplateSyncStatus.SYNCED,
            metaStatus,
            lastSyncedAt: new Date(),
          },
        })

        await prisma.whatsappTemplateLanguage.update({
          where: { id: lang.id },
          data: {
            metaStatus,
          },
        })
      } catch (err) {
        logger.warn(
          {
            event: "whatsapp.template_sync.push_failed",
            templateName: tpl.name,
            lang: lang.lang,
            err,
          },
          `failed to push template ${tpl.name} (${lang.lang}) to Meta`
        )
      }
    }
  }
}

async function upsertTemplate(
  organizationId: string,
  deviceId: string,
  template: MetaTemplate
): Promise<"created" | "updated"> {
  const canonicalSlug = formatTemplateSlug(template.name)
  const possibleSlugs = possibleSlugsFor(template.name)

  const existing = await prisma.whatsappTemplate.findFirst({
    where: {
      organizationId,
      whatsappDeviceId: deviceId,
      slug: { in: possibleSlugs },
    },
    select: { id: true },
  })
  const metaStatus = toSupportedMetaStatus(template.status)
  const languageData = toLanguageData(template)
  const metaData = {
    slug: canonicalSlug || template.name,
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
        ...metaData,
        // Meta-only discoveries have no local display label yet.
        name: template.name,
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
    data: metaData,
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
    logger.warn(
      {
        event: "whatsapp.template_sync.audit_failed",
        action: "TEMPLATE_SYNC_STARTED",
        organizationId: jobData.organizationId,
        deviceId: jobData.deviceId,
        err: e,
      },
      "audit failed"
    )
  }

  // ponytail: independent try-catch — early-stage errors (createClient, fetchAllTemplates)
  // must also produce a FAILED audit to close the trace
  let client: WhatsAppDeviceClient
  let templates: MetaTemplate[]

  try {
    client = await createClient(jobData)
    // 1. Push local un-synced / newly created templates to Meta Cloud API
    await pushLocalTemplatesToMeta(
      client,
      jobData.organizationId,
      jobData.deviceId
    )
    // 2. Pull all templates from Meta Cloud API
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
      logger.warn(
        {
          event: "whatsapp.template_sync.audit_failed",
          action: "TEMPLATE_SYNC_FAILED",
          organizationId: jobData.organizationId,
          deviceId: jobData.deviceId,
          err: e,
        },
        "audit failed"
      )
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
      logger.error(
        {
          event: "whatsapp.template_sync.template_failed",
          templateName: template.name,
          organizationId: jobData.organizationId,
          deviceId: jobData.deviceId,
          err: error,
        },
        `failed template name=${template.name} org=${jobData.organizationId} device=${jobData.deviceId}`
      )
    }
  }

  // ponytail: mark templates in DB not returned by Meta as NOT_IN_META
  const notInMeta = await prisma.whatsappTemplate.updateMany({
    where: {
      organizationId: jobData.organizationId,
      whatsappDeviceId: jobData.deviceId,
      slug: {
        notIn: Array.from(
          new Set(templates.flatMap((t) => possibleSlugsFor(t.name)))
        ),
      },
      syncStatus: { not: WhatsappTemplateSyncStatus.NOT_IN_META },
    },
    data: {
      syncStatus: WhatsappTemplateSyncStatus.NOT_IN_META,
    },
  })
  summary.notInMeta = notInMeta.count

  logger.info(
    {
      event: "whatsapp.template_sync.sync_templates.completed",
      organizationId: jobData.organizationId,
      deviceId: jobData.deviceId,
      summary,
    },
    `sync-templates result org=${jobData.organizationId} device=${jobData.deviceId} fetched=${summary.fetched} created=${summary.created} updated=${summary.updated} notInMeta=${summary.notInMeta} failed=${summary.failed}`
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
      logger.warn(
        {
          event: "whatsapp.template_sync.audit_failed",
          action: "TEMPLATE_SYNC_FAILED",
          organizationId: jobData.organizationId,
          deviceId: jobData.deviceId,
          err: e,
        },
        "audit failed"
      )
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
    logger.warn(
      {
        event: "whatsapp.template_sync.audit_failed",
        action: "TEMPLATE_SYNCED",
        organizationId: jobData.organizationId,
        deviceId: jobData.deviceId,
        err: e,
      },
      "audit failed"
    )
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
    logger.warn(
      {
        event: "whatsapp.template_sync.audit_failed",
        action: "TEMPLATE_SYNC_STARTED",
        organizationId: jobData.organizationId,
        deviceId: jobData.deviceId,
        err: e,
      },
      "audit failed"
    )
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
      logger.warn(
        {
          event: "whatsapp.template_sync.audit_failed",
          action: "TEMPLATE_SYNC_FAILED",
          organizationId: jobData.organizationId,
          deviceId: jobData.deviceId,
          err: e,
        },
        "audit failed"
      )
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
      const possibleSlugs = possibleSlugsFor(template.name)

      const existing = await prisma.whatsappTemplate.findFirst({
        where: {
          organizationId: jobData.organizationId,
          whatsappDeviceId: jobData.deviceId,
          slug: { in: possibleSlugs },
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
      logger.error(
        {
          event: "whatsapp.template_sync.template_status_failed",
          templateName: template.name,
          organizationId: jobData.organizationId,
          deviceId: jobData.deviceId,
          err: error,
        },
        `failed template status name=${template.name} org=${jobData.organizationId} device=${jobData.deviceId}`
      )
    }
  }

  logger.info(
    {
      event: "whatsapp.template_sync.sync_status.completed",
      organizationId: jobData.organizationId,
      deviceId: jobData.deviceId,
      summary,
    },
    `sync-status result org=${jobData.organizationId} device=${jobData.deviceId} fetched=${summary.fetched} updated=${summary.updated} skipped=${summary.skipped} failed=${summary.failed}`
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
      logger.warn(
        {
          event: "whatsapp.template_sync.audit_failed",
          action: "TEMPLATE_SYNC_FAILED",
          organizationId: jobData.organizationId,
          deviceId: jobData.deviceId,
          err: e,
        },
        "audit failed"
      )
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
    logger.warn(
      {
        event: "whatsapp.template_sync.audit_failed",
        action: "TEMPLATE_SYNCED",
        organizationId: jobData.organizationId,
        deviceId: jobData.deviceId,
        err: e,
      },
      "audit failed"
    )
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
    logger.info(
      {
        event: "worker.job.active",
        workerName: "whatsapp-template-sync",
        jobName: job.name,
        jobId: job.id,
      },
      `processing ${job.name} id=${job.id}`
    )
  })

  worker.on("completed", (job, summary) => {
    logger.info(
      {
        event: "worker.job.completed",
        workerName: "whatsapp-template-sync",
        jobName: job.name,
        jobId: job.id,
        summary,
      },
      `completed ${job.name} id=${job.id}`
    )
  })

  worker.on("failed", (job, error) => {
    if (!job) {
      logger.error(
        {
          event: "worker.job.failed",
          workerName: "whatsapp-template-sync",
          err: error,
        },
        "failed job missing payload"
      )
      return
    }

    logger.error(
      {
        event: "worker.job.failed",
        workerName: "whatsapp-template-sync",
        jobName: job.name,
        jobId: job.id,
        attempts: job.attemptsMade,
        err: error,
      },
      `failed ${job.name} id=${job.id} attempts=${job.attemptsMade}`
    )
  })

  let shuttingDown = false

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    logger.info(
      {
        event: "worker.shutdown.started",
        workerName: "whatsapp-template-sync",
        signal,
      },
      `received ${signal}, shutting down`
    )
    try {
      await worker.close()
      process.exit(0)
    } catch (error) {
      logger.error(
        {
          event: "worker.shutdown.failed",
          workerName: "whatsapp-template-sync",
          err: error,
        },
        "shutdown failed while closing worker"
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

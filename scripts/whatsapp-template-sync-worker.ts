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
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"

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
  })

  if (!device) {
    throw new Error(
      `WhatsApp device not found: organizationId=${data.organizationId} deviceId=${data.deviceId}`
    )
  }

  const accessToken = device.tokenEncrypted
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
) {
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
    return
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
}

export async function syncTemplates(jobData: WhatsAppTemplateSyncJobData) {
  const client = await createClient(jobData)
  const templates = await fetchAllTemplates(client)
  const syncedSlugs = new Set<string>()

  for (const template of templates) {
    await upsertTemplate(jobData.organizationId, jobData.deviceId, template)
    syncedSlugs.add(slugifyTemplateName(template.name) || template.name)
  }

  // ponytail: mark templates in DB not returned by Meta as NOT_IN_META
  if (syncedSlugs.size > 0) {
    await prisma.whatsappTemplate.updateMany({
      where: {
        organizationId: jobData.organizationId,
        whatsappDeviceId: jobData.deviceId,
        slug: { notIn: Array.from(syncedSlugs) },
        syncStatus: { not: WhatsappTemplateSyncStatus.NOT_IN_META },
      },
      data: {
        syncStatus: WhatsappTemplateSyncStatus.NOT_IN_META,
      },
    })
  }

  console.info(
    `[whatsapp-template-sync-worker] synced ${templates.length} templates org=${jobData.organizationId} device=${jobData.deviceId}`
  )
}

export async function syncTemplateStatus(jobData: WhatsAppTemplateSyncJobData) {
  const client = await createClient(jobData)
  const templates = await fetchAllTemplates(client)

  for (const template of templates) {
    const existing = await prisma.whatsappTemplate.findFirst({
      where: {
        organizationId: jobData.organizationId,
        name: template.name,
      },
      select: { id: true },
    })

    if (!existing) {
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
  }

  console.info(
    `[whatsapp-template-sync-worker] synced ${templates.length} template statuses org=${jobData.organizationId} device=${jobData.deviceId}`
  )
}

export async function processWhatsAppTemplateSyncJob(
  job: Job<WhatsAppTemplateSyncJobData>
) {
  if (job.data.method === "sync-templates") {
    await syncTemplates(job.data)
    return
  }

  if (job.data.method === "sync-status") {
    await syncTemplateStatus(job.data)
    return
  }
}

const redisConnection = getWhatsAppTemplateSyncRedisConnection()

const worker = new Worker<WhatsAppTemplateSyncJobData>(
  WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME,
  processWhatsAppTemplateSyncJob,
  {
    connection: redisConnection,
    concurrency: 2,
  }
)

worker.on("active", (job) => {
  console.info(
    `[whatsapp-template-sync-worker] processing ${job.name} id=${job.id}`
  )
})

worker.on("completed", (job) => {
  console.info(
    `[whatsapp-template-sync-worker] completed ${job.name} id=${job.id}`
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

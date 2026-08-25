import {
  WhatsappBillingCategory,
  WhatsappTemplateMetaStatus,
  WhatsappTemplateSyncStatus,
} from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { TemplateStatusUpdate } from "@/lib/whatsapp/handle-event"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"
import { formatTemplateSlug } from "./template-validator"

const supportedStatuses = new Set<string>(
  Object.values(WhatsappTemplateMetaStatus)
)
const supportedCategories = new Set<string>(
  Object.values(WhatsappBillingCategory)
)

export type TemplateStatusUpdateResult =
  | "updated"
  | "duplicate"
  | "stale"
  | "unmatched"
  | "unsupported_event"

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

function toMetaStatus(event: string): WhatsappTemplateMetaStatus | null {
  const normalized = event.toUpperCase()

  return supportedStatuses.has(normalized)
    ? (normalized as WhatsappTemplateMetaStatus)
    : null
}

function toCategory(category?: string): WhatsappBillingCategory | undefined {
  const normalized = category?.toUpperCase()

  return normalized && supportedCategories.has(normalized)
    ? (normalized as WhatsappBillingCategory)
    : undefined
}

function toMetaReason(reason?: string): string | null {
  const normalized = reason?.trim()

  return normalized && normalized !== "NONE" ? normalized : null
}

async function auditResult(params: {
  organizationId: string
  deviceId: string
  update: TemplateStatusUpdate
  result: TemplateStatusUpdateResult
}) {
  await logWhatsappAuditEvent({
    action: "TEMPLATE_UPDATED",
    status: "OK",
    organizationId: params.organizationId,
    deviceId: params.deviceId,
    message: `Template status update ${params.result}`,
    details: {
      templateId: params.update.templateId,
      templateName: params.update.templateName,
      event: params.update.event,
      result: params.result,
    },
  })
}

/**
 * Applies a Meta template status event without replacing the local display name.
 * Meta's template ID is not persisted locally, so this uses the established
 * tenant/device-scoped canonical slug fallback.
 */
export async function processTemplateStatusUpdate(
  organizationId: string,
  deviceId: string,
  update: TemplateStatusUpdate
): Promise<TemplateStatusUpdateResult> {
  const metaStatus = toMetaStatus(update.event)
  if (!metaStatus) {
    await auditResult({
      organizationId,
      deviceId,
      update,
      result: "unsupported_event",
    })
    return "unsupported_event"
  }

  const template = await prisma.whatsappTemplate.findFirst({
    where: {
      organizationId,
      whatsappDeviceId: deviceId,
      OR: [
        { slug: { in: possibleSlugsFor(update.templateName) } },
        { name: update.templateName },
      ],
    },
    select: {
      id: true,
      category: true,
      metaStatus: true,
      syncStatus: true,
      lastSyncedAt: true,
    },
  })

  if (!template) {
    await auditResult({ organizationId, deviceId, update, result: "unmatched" })
    return "unmatched"
  }

  const category = toCategory(update.category)
  const isDuplicate =
    template.metaStatus === metaStatus &&
    (category === undefined || template.category === category) &&
    template.syncStatus === WhatsappTemplateSyncStatus.SYNCED
  if (isDuplicate) {
    await auditResult({ organizationId, deviceId, update, result: "duplicate" })
    return "duplicate"
  }

  const occurredAt =
    typeof update.occurredAt === "number"
      ? new Date(update.occurredAt * 1000)
      : null
  if (
    occurredAt &&
    !Number.isNaN(occurredAt.getTime()) &&
    template.lastSyncedAt &&
    template.lastSyncedAt > occurredAt
  ) {
    await auditResult({ organizationId, deviceId, update, result: "stale" })
    return "stale"
  }

  await prisma.whatsappTemplate.update({
    where: { id: template.id },
    data: {
      ...(category === undefined ? {} : { category }),
      metaStatus,
      syncStatus: WhatsappTemplateSyncStatus.SYNCED,
      lastSyncedAt: new Date(),
    },
  })

  if (update.language) {
    const metaReason = toMetaReason(update.reason)

    await prisma.whatsappTemplateLanguage.updateMany({
      where: { templateId: template.id, lang: update.language },
      data: {
        metaStatus,
        isApproved: metaStatus === WhatsappTemplateMetaStatus.APPROVED,
        // Meta also supplies a reason for non-rejection status updates.
        // The column is historical, but the DTO exposes this as `metaReason`.
        rejectReason: metaReason,
      },
    })
  }

  await auditResult({ organizationId, deviceId, update, result: "updated" })
  return "updated"
}

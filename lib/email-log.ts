import type { EmailLogType } from "@prisma/client"

import { CREDENTIAL_PATTERNS } from "@/lib/credential-patterns"
import { prisma } from "@/lib/prisma"

export type CreateEmailLogInput = {
  recipientEmail: string
  type: EmailLogType
  subject: string
  bodyHtml: string
  ticketId?: string | null
  ticketNumber?: string | null
  organizationId?: string | null
  relatedEntityType?: string | null
  relatedEntityId?: string | null
}

export function redactEmailHtml(html: string): string {
  let result = html
  for (const entry of CREDENTIAL_PATTERNS) {
    const flags = entry.pattern.flags.includes("g")
      ? entry.pattern.flags
      : `${entry.pattern.flags}g`
    const regex = new RegExp(entry.pattern.source, flags)
    result = result.replace(regex, "[redacted]")
  }
  return result
}

export async function createEmailLog(
  input: CreateEmailLogInput
): Promise<string | null> {
  try {
    const log = await prisma.emailLog.create({
      data: {
        recipientEmail: input.recipientEmail,
        type: input.type,
        subject: input.subject,
        bodyHtml: redactEmailHtml(input.bodyHtml),
        status: "QUEUED",
        ticketId: input.ticketId ?? null,
        ticketNumber: input.ticketNumber ?? null,
        organizationId: input.organizationId ?? null,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
      },
    })
    return log.id
  } catch (err) {
    console.error("[EmailLog] Failed to create email log:", err)
    return null
  }
}

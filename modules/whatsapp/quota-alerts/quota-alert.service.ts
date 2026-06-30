import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/queue/email"

const QUOTA_THRESHOLDS = [50, 80, 90, 100] as const

export type QuotaThreshold = (typeof QUOTA_THRESHOLDS)[number]

export type QuotaAlertResult = {
  deviceId: string
  threshold: QuotaThreshold
  sent: boolean
}

/**
 * Get billing contact emails with low balance notifications enabled.
 */
async function getBillingContactEmails(
  organizationId: string
): Promise<string[]> {
  const contacts = await prisma.billingContact.findMany({
    where: {
      billingAccount: { organizationId },
      isActive: true,
      notifyOnLowBalance: true,
    },
    select: { email: true },
  })
  return contacts.map((c) => c.email)
}

/**
 * Check if alert was already sent for this threshold.
 */
async function wasAlertSent(
  organizationId: string,
  deviceId: string,
  threshold: QuotaThreshold
): Promise<boolean> {
  const existing = await prisma.whatsappQuotaAlert.findUnique({
    where: {
      organizationId_whatsappDeviceId_threshold: {
        organizationId,
        whatsappDeviceId: deviceId,
        threshold,
      },
    },
  })
  return !!existing
}

/**
 * Record that an alert was sent.
 */
async function recordAlertSent(
  organizationId: string,
  deviceId: string,
  threshold: QuotaThreshold
): Promise<void> {
  await prisma.whatsappQuotaAlert.upsert({
    where: {
      organizationId_whatsappDeviceId_threshold: {
        organizationId,
        whatsappDeviceId: deviceId,
        threshold,
      },
    },
    create: { organizationId, whatsappDeviceId: deviceId, threshold },
    update: {},
  })
}

/**
 * Build email HTML for quota alert.
 */
function buildAlertEmailHtml(
  phoneNumber: string,
  threshold: QuotaThreshold,
  used: number,
  total: number,
  projectedCost: number,
  currency: string
): string {
  const isLastChance = threshold === 100
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: ${isLastChance ? "#dc2626" : "#d97706"};">
    WhatsApp Quota ${isLastChance ? "Final" : "Warning"}: ${threshold}%
  </h2>
  <p>Your WhatsApp device <strong>${phoneNumber}</strong> has reached <strong>${threshold}%</strong> of its monthly quota.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 8px; border: 1px solid #eee;">Used</td><td style="padding: 8px; border: 1px solid #eee;">${used.toLocaleString()}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #eee;">Quota</td><td style="padding: 8px; border: 1px solid #eee;">${total.toLocaleString()}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #eee;">Projected Cost</td><td style="padding: 8px; border: 1px solid #eee;">${currency} ${projectedCost.toLocaleString()}</td></tr>
  </table>
  ${isLastChance ? "<p><strong>Messages will stop sending when quota is exhausted.</strong></p>" : ""}
  <p><a href="${process.env.APP_URL ?? "https://app.example.com"}/console/whatsapp/usage">View Usage Details</a></p>
</body>
</html>`
}

/**
 * Check quota thresholds and send alerts if needed.
 * Returns list of alerts that were sent.
 */
export async function checkAndSendQuotaAlerts(
  organizationId: string,
  deviceId: string,
  used: number,
  total: number,
  projectedCost: number,
  currency: string = "IDR"
): Promise<QuotaAlertResult[]> {
  if (total <= 0) return []

  const percent = (used / total) * 100
  const results: QuotaAlertResult[] = []

  const device = await prisma.whatsappDevice.findUnique({
    where: { id: deviceId },
    select: { phoneNumber: true },
  })
  const phoneNumber = device?.phoneNumber ?? deviceId

  for (const threshold of QUOTA_THRESHOLDS) {
    if (percent >= threshold) {
      const alreadySent = await wasAlertSent(organizationId, deviceId, threshold)
      if (!alreadySent) {
        const emails = await getBillingContactEmails(organizationId)
        for (const email of emails) {
          await sendEmail({
            to: email,
            subject: `WhatsApp Quota ${threshold}% - ${phoneNumber}`,
            html: buildAlertEmailHtml(phoneNumber, threshold, used, total, projectedCost, currency),
          })
        }
        await recordAlertSent(organizationId, deviceId, threshold)
        results.push({ deviceId, threshold, sent: true })
      } else {
        results.push({ deviceId, threshold, sent: false })
      }
    }
  }

  return results
}

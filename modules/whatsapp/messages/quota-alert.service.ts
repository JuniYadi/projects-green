/**
 * WhatsApp Quota Alert Service
 *
 * Sends email alerts at quota thresholds (50%, 80%, 90%, 100%).
 * Tracks sent alerts in WhatsappQuotaAlert table to prevent duplicate sends.
 */

import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/queue/email"

export const QUOTA_THRESHOLDS = [50, 80, 90, 100] as const
export type QuotaThreshold = (typeof QUOTA_THRESHOLDS)[number]

export type QuotaAlertService = {
  checkAndSendAlerts(
    organizationId: string,
    deviceId: string,
    currentPercent: number,
    currentCost: number,
    quotaBase: number
  ): Promise<void>
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount)
}

export const quotaAlertService: QuotaAlertService = {
  /**
   * Check current quota percent against thresholds and send alerts for any
   * newly crossed thresholds. Only sends once per threshold level per device.
   */
  async checkAndSendAlerts(
    organizationId: string,
    deviceId: string,
    currentPercent: number,
    currentCost: number,
    quotaBase: number
  ) {
    const billingContacts = await prisma.billingContact.findMany({
      where: {
        billingAccount: { organizationId },
        notifyOnLowBalance: true,
        isActive: true,
      },
      select: { email: true },
    })
    const emails = billingContacts.map((c) => c.email).filter(Boolean)

    if (emails.length === 0) return

    // ponytail: org name lookup requires WorkOS API call — use static name for now
    const orgName = "Your Organization"

    // Get device phone for display
    const device = await prisma.whatsappDevice.findUnique({
      where: { id: deviceId },
      select: { phoneNumber: true },
    })

    const phoneDisplay = device?.phoneNumber ?? deviceId

    const existingAlerts = await prisma.whatsappQuotaAlert.findMany({
      where: { organizationId, whatsappDeviceId: deviceId },
      select: { threshold: true },
    })
    const sentThresholds = new Set(existingAlerts.map((a) => a.threshold))
    const crossedThresholds = QUOTA_THRESHOLDS.filter(
      (threshold) => currentPercent >= threshold && !sentThresholds.has(threshold)
    )

    await Promise.allSettled(
      crossedThresholds.map(async (threshold) => {
        try {
          await prisma.whatsappQuotaAlert.create({
            data: { organizationId, whatsappDeviceId: deviceId, threshold },
          })
        } catch {
          return
        }

        await Promise.allSettled(
          emails.map((to) =>
            sendQuotaEmail({
              to,
              orgName,
              devicePhone: phoneDisplay,
              threshold,
              currentPercent,
              currentCost,
              quotaBase,
            })
          )
        )
      })
    )
  },
}

type QuotaEmailParams = {
  to: string
  orgName: string
  devicePhone: string
  threshold: number
  currentPercent: number
  currentCost: number
  quotaBase: number
}

async function sendQuotaEmail(params: QuotaEmailParams): Promise<void> {
  const { to, orgName, devicePhone, threshold, currentPercent, currentCost, quotaBase } = params

  const subject =
    threshold === 100
      ? `[Action Required] WhatsApp quota exhausted on ${devicePhone}`
      : `⚠️ WhatsApp usage alert: ${threshold}% quota reached`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert { padding: 16px; border-radius: 8px; margin: 16px 0; }
    .alert-warning { background: #fef3cd; border: 1px solid #ffc107; }
    .alert-danger { background: #f8d7da; border: 1px solid #dc3545; }
    .progress-bar { height: 20px; background: #e9ecef; border-radius: 4px; overflow: hidden; margin: 16px 0; }
    .progress-fill { height: 100%; background: ${threshold === 100 ? '#dc3545' : threshold >= 80 ? '#ffc107' : '#28a745'}; }
    .footer { color: #6c757d; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>WhatsApp Quota Alert</h2>
    <p>Hello,</p>
    <p>Your WhatsApp usage for <strong>${orgName}</strong> (Device: ${devicePhone}) has reached <strong>${currentPercent}%</strong> of the monthly quota.</p>

    <div class="alert ${threshold === 100 ? 'alert-danger' : 'alert-warning'}">
      <p><strong>${threshold === 100 ? '⚠️ QUOTA EXHAUSTED' : `⚠️ ${threshold}% Quota Reached`}</strong></p>
      <ul>
        <li>Current usage: ${formatCurrency(currentCost)}</li>
        <li>Quota base: ${formatCurrency(Number(quotaBase))}</li>
        <li>Usage: ${currentPercent}%</li>
      </ul>
    </div>

    ${threshold === 100 ? `
    <p><strong>⚡ Action Required:</strong> Messages will stop sending once your balance is exhausted. Please top up your balance immediately to avoid service interruption.</p>
    ` : `
    <p>Consider topping up your balance or reviewing usage patterns to avoid unexpected costs.</p>
    `}

    <div class="progress-bar">
      <div class="progress-fill" style="width: ${Math.min(currentPercent, 100)}%"></div>
    </div>

    <p>View usage details: <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'}/console/whatsapp/usage">WhatsApp Usage Dashboard</a></p>

    <div class="footer">
      <p>This is an automated alert from your billing system.</p>
    </div>
  </div>
</body>
</html>
  `

  await sendEmail({ to, subject, html })
}

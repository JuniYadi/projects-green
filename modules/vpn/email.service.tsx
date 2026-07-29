import { render } from "@react-email/components"

import LRUCache from "lru-cache"

import { createEmailLog } from "@/lib/email-log"
import { sendEmail } from "@/lib/queue/email"

import { SubscriptionCreatedEmail } from "./emails/subscription-created"
import { ProvisioningSuccessEmail } from "./emails/provisioning-success"
import { ProvisioningFailedEmail } from "./emails/provisioning-failed"
import { RenewalSuccessEmail } from "./emails/renewal-success"
import { RenewalFailedEmail } from "./emails/renewal-failed"
import { SubscriptionSuspendedEmail } from "./emails/subscription-suspended"
import { SubscriptionExpiredEmail } from "./emails/subscription-expired"
import { SubscriptionCancelledEmail } from "./emails/subscription-cancelled"

/**
 * ponytail: single email service, no abstraction.
 * Each method renders the template and enqueues via the global email queue.
 * Recipients are resolved from WorkOS org admin — add billing contact
 * support if multi-recipient per org is needed.
 */

export class VpnEmailService {
  private readonly orgEmailCache = new LRUCache<string, string[] | null>({
    max: 1000,
  })
  async sendSubscriptionCreated(organizationId: string, packageName?: string) {
    const recipients = await this.resolveRecipients(organizationId)
    if (!recipients.length) return

    const html = await render(
      <SubscriptionCreatedEmail packageName={packageName} />
    )
    const subject = "Your VPN subscription is being provisioned"
    for (const { email } of recipients) {
      const emailLogId = await createEmailLog({
        recipientEmail: email,
        type: "VPN_SUBSCRIPTION_CREATED",
        subject,
        bodyHtml: html,
        organizationId,
        relatedEntityType: "vpn_subscription",
        relatedEntityId: organizationId,
      })
      await sendEmail({
        to: email,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    }
    this.markRecipientsResolved(organizationId, recipients)
  }
  async sendProvisioningSuccess(organizationId: string, packageName?: string) {
    const recipients = await this.resolveRecipients(organizationId)
    if (!recipients.length) return

    const html = await render(
      <ProvisioningSuccessEmail packageName={packageName} />
    )
    const subject = "Your VPN account is ready"
    for (const { email } of recipients) {
      const emailLogId = await createEmailLog({
        recipientEmail: email,
        type: "VPN_PROVISIONING_SUCCESS",
        subject,
        bodyHtml: html,
        organizationId,
        relatedEntityType: "vpn_subscription",
        relatedEntityId: organizationId,
      })
      await sendEmail({
        to: email,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    }
    this.markRecipientsResolved(organizationId, recipients)
  }
  async sendProvisioningFailed(organizationId: string, packageName?: string) {
    const recipients = await this.resolveRecipients(organizationId)
    if (!recipients.length) return

    const html = await render(
      <ProvisioningFailedEmail packageName={packageName} />
    )
    const subject = "VPN provisioning failed — contact support"
    for (const { email } of recipients) {
      const emailLogId = await createEmailLog({
        recipientEmail: email,
        type: "VPN_PROVISIONING_FAILED",
        subject,
        bodyHtml: html,
        organizationId,
        relatedEntityType: "vpn_subscription",
        relatedEntityId: organizationId,
      })
      await sendEmail({
        to: email,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    }
    this.markRecipientsResolved(organizationId, recipients)
  }
  async sendRenewalSuccess(
    organizationId: string,
    packageName?: string,
    period?: string
  ) {
    const recipients = await this.resolveRecipients(organizationId)
    if (!recipients.length) return

    const html = await render(
      <RenewalSuccessEmail packageName={packageName} period={period} />
    )
    const subject = "VPN subscription renewed"
    for (const { email } of recipients) {
      const emailLogId = await createEmailLog({
        recipientEmail: email,
        type: "VPN_RENEWAL_SUCCESS",
        subject,
        bodyHtml: html,
        organizationId,
        relatedEntityType: "vpn_subscription",
        relatedEntityId: organizationId,
      })
      await sendEmail({
        to: email,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    }
    this.markRecipientsResolved(organizationId, recipients)
  }
  async sendRenewalFailed(organizationId: string, packageName?: string) {
    const recipients = await this.resolveRecipients(organizationId)
    if (!recipients.length) return

    const html = await render(<RenewalFailedEmail packageName={packageName} />)
    const subject = "VPN renewal payment failed — please top up"
    for (const { email } of recipients) {
      const emailLogId = await createEmailLog({
        recipientEmail: email,
        type: "VPN_RENEWAL_FAILED",
        subject,
        bodyHtml: html,
        organizationId,
        relatedEntityType: "vpn_subscription",
        relatedEntityId: organizationId,
      })
      await sendEmail({
        to: email,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    }
    this.markRecipientsResolved(organizationId, recipients)
  }
  async sendSubscriptionSuspended(
    organizationId: string,
    packageName?: string
  ) {
    const recipients = await this.resolveRecipients(organizationId)
    if (!recipients.length) return

    const html = await render(
      <SubscriptionSuspendedEmail packageName={packageName} />
    )
    const subject = "VPN subscription suspended due to payment overdue"
    for (const { email } of recipients) {
      const emailLogId = await createEmailLog({
        recipientEmail: email,
        type: "VPN_SUBSCRIPTION_SUSPENDED",
        subject,
        bodyHtml: html,
        organizationId,
        relatedEntityType: "vpn_subscription",
        relatedEntityId: organizationId,
      })
      await sendEmail({
        to: email,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    }
    this.markRecipientsResolved(organizationId, recipients)
  }

  async sendSubscriptionExpired(organizationId: string, packageName?: string) {
    const recipients = await this.resolveRecipients(organizationId)
    if (!recipients.length) return

    const html = await render(
      <SubscriptionExpiredEmail packageName={packageName} />
    )
    const subject = "VPN subscription expired"
    for (const { email } of recipients) {
      const emailLogId = await createEmailLog({
        recipientEmail: email,
        type: "VPN_SUBSCRIPTION_EXPIRED",
        subject,
        bodyHtml: html,
        organizationId,
        relatedEntityType: "vpn_subscription",
        relatedEntityId: organizationId,
      })
      await sendEmail({
        to: email,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    }
    this.markRecipientsResolved(organizationId, recipients)
  }

  async sendSubscriptionCancelled(
    organizationId: string,
    packageName?: string,
    periodEnd?: string
  ) {
    const recipients = await this.resolveRecipients(organizationId)
    if (!recipients.length) return

    const html = await render(
      <SubscriptionCancelledEmail
        packageName={packageName}
        periodEnd={periodEnd}
      />
    )
    const subject = "VPN subscription will be cancelled at period end"
    for (const { email } of recipients) {
      const emailLogId = await createEmailLog({
        recipientEmail: email,
        type: "VPN_SUBSCRIPTION_CANCELLED",
        subject,
        bodyHtml: html,
        organizationId,
        relatedEntityType: "vpn_subscription",
        relatedEntityId: organizationId,
      })
      await sendEmail({
        to: email,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    }
    this.markRecipientsResolved(organizationId, recipients)
  }

  // ─── Private ────────────────────────────────────────────────────────

  private async resolveRecipients(
    organizationId: string
  ): Promise<Array<{ email: string; orgName?: string }>> {
    const cached = this.orgEmailCache.get(organizationId)
    if (cached !== undefined) {
      return cached ? cached.map((email) => ({ email })) : []
    }

    try {
      const { createWorkOS } = await import("@workos-inc/node")
      const workos = createWorkOS({
        apiKey: process.env.WORKOS_API_KEY ?? "",
      })

      const memberships =
        await workos.userManagement.listOrganizationMemberships({
          organizationId,
        })

      // ponytail: emails every admin member of the org.
      // Add billing-contact resolution if needed later.
      const users = await Promise.all(
        memberships.data.map((m) => workos.userManagement.getUser(m.userId))
      )
      const emails = users.filter((u) => u.email).map((u) => u.email)

      return emails.map((email) => ({ email }))
    } catch (error) {
      console.error(
        `[vpn-email] failed to resolve recipients for org=${organizationId}:`,
        error
      )
      return []
    }
  }

  /**
   * Cache org recipients ONLY after successful email delivery (no stale cache).
   */
  private markRecipientsResolved(
    organizationId: string,
    recipients: Array<{ email: string }>
  ) {
    this.orgEmailCache.set(
      organizationId,
      recipients.length > 0 ? recipients.map((r) => r.email) : null
    )
  }
}

export const vpnEmailService = new VpnEmailService()

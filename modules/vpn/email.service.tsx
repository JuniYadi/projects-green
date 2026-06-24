import { render } from "@react-email/components"

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
  private readonly orgEmailCache = new Map<string, string | null>()

  async sendSubscriptionCreated(organizationId: string, packageName?: string) {
    const recipients = await this.resolveRecipients(organizationId)
    if (!recipients.length) return

    const html = await render(
      <SubscriptionCreatedEmail packageName={packageName} />
    )
    for (const { email } of recipients) {
      sendEmail({
        to: email,
        subject: "Your VPN subscription is being provisioned",
        html,
      })
    }
  }

  async sendProvisioningSuccess(organizationId: string, packageName?: string) {
    const recipients = await this.resolveRecipients(organizationId)
    if (!recipients.length) return

    const html = await render(
      <ProvisioningSuccessEmail packageName={packageName} />
    )
    for (const { email } of recipients) {
      sendEmail({
        to: email,
        subject: "Your VPN account is ready",
        html,
      })
    }
  }

  async sendProvisioningFailed(organizationId: string, packageName?: string) {
    const recipients = await this.resolveRecipients(organizationId)
    if (!recipients.length) return

    const html = await render(
      <ProvisioningFailedEmail packageName={packageName} />
    )
    for (const { email } of recipients) {
      sendEmail({
        to: email,
        subject: "VPN provisioning failed — contact support",
        html,
      })
    }
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
    for (const { email } of recipients) {
      sendEmail({
        to: email,
        subject: "VPN subscription renewed",
        html,
      })
    }
  }

  async sendRenewalFailed(organizationId: string, packageName?: string) {
    const recipients = await this.resolveRecipients(organizationId)
    if (!recipients.length) return

    const html = await render(
      <RenewalFailedEmail packageName={packageName} />
    )
    for (const { email } of recipients) {
      sendEmail({
        to: email,
        subject: "VPN renewal payment failed — please top up",
        html,
      })
    }
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
    for (const { email } of recipients) {
      sendEmail({
        to: email,
        subject: "VPN subscription suspended due to payment overdue",
        html,
      })
    }
  }

  async sendSubscriptionExpired(organizationId: string, packageName?: string) {
    const recipients = await this.resolveRecipients(organizationId)
    if (!recipients.length) return

    const html = await render(
      <SubscriptionExpiredEmail packageName={packageName} />
    )
    for (const { email } of recipients) {
      sendEmail({
        to: email,
        subject: "VPN subscription expired",
        html,
      })
    }
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
    for (const { email } of recipients) {
      sendEmail({
        to: email,
        subject: "VPN subscription will be cancelled at period end",
        html,
      })
    }
  }

  // ─── Private ────────────────────────────────────────────────────────

  private async resolveRecipients(
    organizationId: string
  ): Promise<Array<{ email: string; orgName?: string }>> {
    if (this.orgEmailCache.has(organizationId)) {
      const email = this.orgEmailCache.get(organizationId)
      return email ? [{ email }] : []
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
      const emails: string[] = []
      for (const membership of memberships.data) {
        const user = await workos.userManagement.getUser(membership.userId)
        if (user.email) emails.push(user.email)
      }

      this.orgEmailCache.set(organizationId, emails[0] ?? null)
      return emails[0] ? [{ email: emails[0] }] : []
    } catch (error) {
      console.error(
        `[vpn-email] failed to resolve recipients for org=${organizationId}:`,
        error
      )
      return []
    }
  }
}

export const vpnEmailService = new VpnEmailService()

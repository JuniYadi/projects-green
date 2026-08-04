# vpn/email.service.tsx

> 71 nodes · cohesion 0.05

## Key Concepts

- **vpn/email.service.tsx** (24 connections) — `modules/vpn/email.service.tsx`
- **VpnEmailService** (19 connections) — `modules/vpn/email.service.tsx`
- **sendEmail()** (17 connections) — `lib/queue/email.ts`
- **createEmailLog()** (14 connections) — `lib/email-log.ts`
- **vpn-renewal.service.ts** (13 connections) — `modules/vpn/billing/vpn-renewal.service.ts`
- **VpnRenewalService** (12 connections) — `modules/vpn/billing/vpn-renewal.service.ts`
- **email-log.ts** (10 connections) — `lib/email-log.ts`
- **.markRecipientsResolved()** (9 connections) — `modules/vpn/email.service.tsx`
- **.resolveRecipients()** (9 connections) — `modules/vpn/email.service.tsx`
- **vpn-renewal.service.test.ts** (8 connections) — `modules/vpn/billing/vpn-renewal.service.test.ts`
- **.renewOne()** (7 connections) — `modules/vpn/billing/vpn-renewal.service.ts`
- **email-log.test.ts** (6 connections) — `lib/email-log.test.ts`
- **.sendRenewalFailed()** (6 connections) — `modules/vpn/email.service.tsx`
- **.sendRenewalSuccess()** (6 connections) — `modules/vpn/email.service.tsx`
- **.sendSubscriptionExpired()** (6 connections) — `modules/vpn/email.service.tsx`
- **.sendSubscriptionSuspended()** (6 connections) — `modules/vpn/email.service.tsx`
- **vpn-renewal-worker.ts** (6 connections) — `scripts/vpn-renewal-worker.ts`
- **.applyGrace()** (5 connections) — `modules/vpn/billing/vpn-renewal.service.ts`
- **.sendProvisioningFailed()** (5 connections) — `modules/vpn/email.service.tsx`
- **.sendProvisioningSuccess()** (5 connections) — `modules/vpn/email.service.tsx`
- **.sendSubscriptionCancelled()** (5 connections) — `modules/vpn/email.service.tsx`
- **.sendSubscriptionCreated()** (5 connections) — `modules/vpn/email.service.tsx`
- **provisioning-failed.tsx** (4 connections) — `modules/vpn/emails/provisioning-failed.tsx`
- **provisioning-success.tsx** (4 connections) — `modules/vpn/emails/provisioning-success.tsx`
- **renewal-failed.tsx** (4 connections) — `modules/vpn/emails/renewal-failed.tsx`
- *... and 46 more nodes in this community*

## Relationships

- [BillingTransactionService](BillingTransactionService.md) (7 shared connections)
- [vpn-subscriptions.route.ts](vpn-subscriptions.route.ts.md) (6 shared connections)
- [workers.ts](workers.ts.md) (5 shared connections)
- [invoices/email.service.tsx](invoices-email.service.tsx.md) (3 shared connections)
- [support-ticket.types.ts](support-ticket.types.ts.md) (3 shared connections)
- [SshTarget](SshTarget.md) (3 shared connections)
- [resolveLocaleOrDefault](resolveLocaleOrDefault.md) (2 shared connections)
- [prisma.ts](prisma.ts.md) (2 shared connections)
- [TestDecimal](TestDecimal.md) (2 shared connections)
- [whatsapp-health.tsx](whatsapp-health.tsx.md) (2 shared connections)
- [messages/quota-alert.service.ts](messages-quota-alert.service.ts.md) (2 shared connections)

## Source Files

- `lib/email-log.test.ts`
- `lib/email-log.ts`
- `lib/queue/email.ts`
- `modules/vpn/billing/vpn-renewal.service.test.ts`
- `modules/vpn/billing/vpn-renewal.service.ts`
- `modules/vpn/email.service.tsx`
- `modules/vpn/emails/provisioning-failed.tsx`
- `modules/vpn/emails/provisioning-success.tsx`
- `modules/vpn/emails/renewal-failed.tsx`
- `modules/vpn/emails/renewal-success.tsx`
- `modules/vpn/emails/subscription-cancelled.tsx`
- `modules/vpn/emails/subscription-created.tsx`
- `modules/vpn/emails/subscription-expired.tsx`
- `modules/vpn/emails/subscription-suspended.tsx`
- `scripts/vpn-renewal-worker.ts`

## Audit Trail

- EXTRACTED: 295 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
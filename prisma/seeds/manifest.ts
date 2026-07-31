/**
 * Tables to dump/restore, in FK-safe order (parent tables first).
 * Use ACTUAL database table names — query them with:
 *   psql "$DATABASE_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
 *
 * Rules:
 * - Child tables come AFTER their parent tables.
 * - Junction/join tables come AFTER both their parent tables.
 * - Omit system-seeded tables (Currency, Plan, Meter, etc.)
 *   — they are recreated by their own seeders on every run.
 */

export const SEED_TABLES = [
  // Auth / identity
  "User",
  "PlatformUserRole",
  "ApiKey",

  // Github
  "GithubInstallStateNonce",
  "GithubInstallation",
  "GithubRepositoryConnection",
  "GithubWebhookEvent",

  // App hosting
  "AppHostingCluster",
  "AppHostingClusterIntegration",

  // Detector
  "DetectorRule",
  "RuntimeMapping",
  "InspectionLog",

  // Application stacks & deployments
  "ApplicationStack",
  "Deployment",
  "DeployEvent",
  "DeploymentLog",

  // Caching
  "CacheEntry",

  // App credentials
  "AppCredential",

  // Support tickets
  "SupportTicket",
  "SupportTicketReply",
  "SupportTicketAttachmentUploadSession",

  // Billing — order matters (UsageLedger last)
  "BillingAccount",
  "BillingContact",
  "BillingSubscription",
  "SubscriptionVersion",
  "BillingRun",
  "UsageEvent",
  "RatedUsage",
  "Invoice",
  "InvoiceLine",
  "InvoiceLineSource",
  "BillingAdjustment",
  "BillingAuditLog",
  "UsageLedger",

  // VPN / service subscriptions — order matters
  "Subscription",
  "VpnSubscription",
  "VpnClient",
  "VpnServerAccount",
  "VpnMobileDevice",
  "VpnMobileSession",
  "VpnPairingToken",
  "VpnAuditLog",

  // Payments
  "PaymentGateway",
  "BankAccount",
  "PaymentConfirmation",
  "PaymentAuditLog",

  // Vouchers
  "Voucher",
  "VoucherClaim",

  // Email
  "EmailLog",

  // WhatsApp
  "WhatsappDevice",
  "WhatsappContactGroup",
  "WhatsappContact",
  "WhatsappTemplate",
  "WhatsappTemplateLanguage",
  "WhatsappBroadcastCampaign",
  "WhatsappBroadcastRecipient",
  "WhatsappConversation",
  "WhatsappConversationLabel",
  "WhatsappConversationLabelOnConversation",
  "WhatsappMessage",
  "WhatsappMessageStatus",
  "WhatsappMedia",
  "WhatsappDailyCount",
  "WhatsappHourlyCount",
  "WhatsappMonthlyCount",
  "WhatsappQuotaSession",
  "WhatsappQuotaCreditRate",
  "WhatsappBillingLedger",
  "WhatsappApiCall",
  "WhatsappAttachment",
  "WhatsappBroadcastRateState",
  "WhatsappApiKey",
  "WhatsappWebhook",
  "WhatsappWebhookDeliveryLog",
  "WhatsappWebhookEvent",
  "WhatsappWebhookDeadLetter",
  "WhatsappQuotaAlert",
  "WhatsappAuditLog",
  "WhatsappCatalog",
  "WhatsappCatalogProduct",
] as const

export type SeedTable = (typeof SEED_TABLES)[number]

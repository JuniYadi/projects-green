/**
 * Seeders Barrel Export
 *
 * Central entry point for the seeder infrastructure.
 * Import from "@/lib/seeders" in your seeders and runner.
 */

export {
  BaseSeeder,
  type SeedClassification,
  type SeedResult,
  type SeederConfig,
} from "./base-seeder"

export {
  registerSeeder,
  discoverSeeders,
  getSeeders,
  getSeeder,
  listSeeders,
  clearRegistry,
  type SeederClass,
} from "./registry"

export {
  faker,
  fakerId,
  fakerRecentDate,
  fakerAmount,
  fakerDateRange,
  fakerBillingAccount,
  fakerBillingSubscription,
  fakerInvoiceNumber,
  fakerInvoice,
  fakerInvoiceLine,
  fakerTicketNumber,
  fakerSupportTicket,
  fakerSupportTicketReply,
  fakerVpnClient,
  fakerPhoneNumber,
  fakerWhatsappDevice,
  fakerWhatsappContactGroup,
  fakerWhatsappContact,
  fakerWhatsappMessage,
  fakerKnowledgeDocument,
  fakerArray,
  fakerPick,
  fakerSlug,
} from "./faker-helpers"

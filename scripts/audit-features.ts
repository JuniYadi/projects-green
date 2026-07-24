// Heuristic ceiling: 100% implemented is a first-pass heuristic, not ground truth.
// - Most rules check file presence (matchGlob) plus a substring match (fileContains).
// - ~180/241 rules are file-presence only. A stub file with the right name passes.
// - The "missing" features with empty evidence are real holes — the rule found nothing.
// - "partial" features have evidence but a guard check failed.
// - For full signal: pair this report with manual review of `evidence` paths.
// ponytail: full AST/export verification is a follow-up. Add when coverage stabilizes.
import { readFileSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { Glob } from "bun"
import {
  AuditReportSchema,
  type AuditReport,
  type FeatureEntry,
  type ModuleCategory,
} from "./audit-features.schema"

const REPO_ROOT = resolve(import.meta.dir, "..")
const AUDITS_DIR = resolve(REPO_ROOT, "audits")
const OUTPUT_PATH = resolve(AUDITS_DIR, "feature-audit.json")

const SCAN_GLOBS = [
  "modules/**/*.ts",
  "modules/**/*.tsx",
  "app/**/*.tsx",
  "app/api/**/*.ts",
]

type RuleResult = Pick<FeatureEntry, "codeStatus" | "evidence">

export type Rule = {
  id: string
  label: string
  module: string
  category: ModuleCategory
  check: (files: string[]) => RuleResult
}

const matchGlob = (files: string[], pattern: string): string[] => {
  const glob = new Glob(pattern)
  const set = new Set<string>()
  for (const f of files) {
    if (glob.match(f)) set.add(f)
  }
  return [...set].sort()
}

// Substring search, NOT an AST export check. A real export verifier would parse
// the file; this is a first-pass heuristic. False positives are possible (the
// string could appear in a comment or string literal). Keep that ceiling in mind.
const fileContains = (file: string, needle: string): boolean => {
  try {
    const text = readFileSync(resolve(REPO_ROOT, file), "utf8")
    return text.includes(needle)
  } catch {
    return false
  }
}

// ─── WhatsApp rules (existing 7 + new) ──────────────────────────────────────

export const RULES: Rule[] = [
  // ── whatsapp (original 7) ──
  {
    id: "wa.webhook.hmac",
    label: "Webhook HMAC signature verification",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/webhooks/services/webhook-hmac*.ts"
      )
      if (found.length === 0) return { codeStatus: "missing", evidence: [] }
      const hasVerify = found.some((f) => fileContains(f, "verify"))
      return {
        codeStatus: hasVerify ? "implemented" : "partial",
        evidence: found,
      }
    },
  },
  {
    id: "wa.webhook.retry",
    label: "Webhook retry job",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/webhooks/jobs/webhook-retry*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "wa.webhook.dead_letter",
    label: "Webhook dead-letter service + replay API",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/whatsapp/webhooks/services/webhook-dead-letter*.ts"
      )
      const api = matchGlob(
        files,
        "modules/whatsapp/webhooks/api/webhook-dead-letter*.ts"
      )
      const all = [...svc, ...api]
      if (all.length === 0) return { codeStatus: "missing", evidence: [] }
      const both = svc.length > 0 && api.length > 0
      return {
        codeStatus: both ? "implemented" : "partial",
        evidence: all,
      }
    },
  },
  {
    id: "wa.broadcast.scheduling",
    label: "Broadcast scheduling service",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/broadcasts/broadcast-schedule*.ts"
      )
      if (found.length === 0) return { codeStatus: "missing", evidence: [] }
      const hasTest = found.some((f) => /\.test\.ts$/.test(f))
      return {
        codeStatus: hasTest ? "implemented" : "partial",
        evidence: found,
      }
    },
  },
  {
    id: "wa.messages.delivery_status_ui",
    label: "Message delivery status badge in UI",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/messages/ui/message-status-badge.tsx"
      )
      if (found.length === 0) return { codeStatus: "missing", evidence: [] }
      const ok =
        fileContains(found[0], "SENT") &&
        fileContains(found[0], "DELIVERED") &&
        fileContains(found[0], "READ") &&
        fileContains(found[0], "FAILED")
      return {
        codeStatus: ok ? "implemented" : "partial",
        evidence: found,
      }
    },
  },
  {
    id: "wa.templates.reject_reason_ui",
    label: "Template rejection reason surfaced to UI",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const dto = matchGlob(
        files,
        "modules/whatsapp/templates/templates.dto.ts"
      )
      const hasDtoField =
        dto.length > 0 && dto.some((f) => fileContains(f, "rejectReason"))
      const uiConsumers = files.filter(
        (f) =>
          /\.tsx$/.test(f) &&
          f.includes("whatsapp/templates") &&
          fileContains(f, "rejectReason")
      )
      if (!hasDtoField) {
        return {
          codeStatus: "missing",
          evidence: [...dto, ...uiConsumers],
        }
      }
      if (uiConsumers.length === 0) {
        return { codeStatus: "partial", evidence: dto }
      }
      return {
        codeStatus: "implemented",
        evidence: [...dto, ...uiConsumers],
      }
    },
  },
  {
    id: "wa.tokens.refresh",
    label: "WhatsApp token refresh service",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/whatsapp/tokens/services/*refresh*.ts"
      )
      const route = matchGlob(files, "modules/whatsapp/tokens/api/*refresh*.ts")
      const all = [...svc, ...route]
      return {
        codeStatus: all.length > 0 ? "implemented" : "missing",
        evidence: all,
      }
    },
  },

  // ── whatsapp (new) ──
  {
    id: "wa.webhooks.dispatcher",
    label: "Webhook dispatcher service",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/webhooks/webhook-dispatcher*.ts"
      )
      if (found.length === 0) return { codeStatus: "missing", evidence: [] }
      const ok = found.some((f) => fileContains(f, "dispatch"))
      return {
        codeStatus: ok ? "implemented" : "partial",
        evidence: found,
      }
    },
  },
  {
    id: "wa.webhooks.admin",
    label: "Admin webhook management routes",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/webhooks/api/admin-webhooks*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "wa.messages.service",
    label: "Messages service (send, list, status)",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/whatsapp/messages/messages.service*.ts"
      )
      const route = matchGlob(
        files,
        "modules/whatsapp/messages/api/messages.route*.ts"
      )
      const all = [...svc, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "wa.messages.quota",
    label: "Quota alert service",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/messages/quota-alert*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "wa.messages.composer",
    label: "Interactive message composer UI",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/messages/ui/interactive-composer*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "wa.templates.service",
    label: "Template management service + API",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const route = matchGlob(
        files,
        "modules/whatsapp/templates/api/templates.route*.ts"
      )
      const hooks = matchGlob(
        files,
        "modules/whatsapp/templates/api/templates.hooks*.ts"
      )
      const all = [...route, ...hooks]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "wa.templates.preview",
    label: "Template preview UI",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/templates/ui/template-preview*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "wa.templates.form",
    label: "Template create/edit form UI",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/templates/ui/template-form*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "wa.usage.service",
    label: "Usage tracking service",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const svc = matchGlob(files, "modules/whatsapp/usage/usage.service*.ts")
      const dto = matchGlob(files, "modules/whatsapp/usage/usage.dto*.ts")
      const all = [...svc, ...dto]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "wa.usage.api",
    label: "Usage API routes",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/usage/api/usage.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "wa.media.service",
    label: "Media upload/download service",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const svc = matchGlob(files, "modules/whatsapp/media/media.service*.ts")
      const route = matchGlob(
        files,
        "modules/whatsapp/media/api/media.route*.ts"
      )
      const all = [...svc, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "wa.devices.service",
    label: "Device management service + business profile",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/whatsapp/devices/devices.service*.ts"
      )
      const bp = matchGlob(
        files,
        "modules/whatsapp/devices/business-profile.service*.ts"
      )
      const route = matchGlob(
        files,
        "modules/whatsapp/devices/api/devices.route*.ts"
      )
      const all = [...svc, ...bp, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "wa.devices.ui",
    label: "Device health badge UI",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/ui/device-health-badge*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "wa.conversations.service",
    label: "Conversations API routes",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/conversations/api/conversations.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "wa.contacts.service",
    label: "Contacts API routes",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/contacts/api/contacts.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "wa.catalogs.service",
    label: "Catalog management service + API",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/whatsapp/catalogs/catalogs.service*.ts"
      )
      const route = matchGlob(
        files,
        "modules/whatsapp/catalogs/api/catalogs.route*.ts"
      )
      const all = [...svc, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "wa.audit.service",
    label: "WhatsApp audit trail UI + API",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const ui = matchGlob(
        files,
        "modules/whatsapp/audit/ui/whatsapp-audit-table*.tsx"
      )
      const route = matchGlob(
        files,
        "modules/whatsapp/audit/api/whatsapp-audit.route*.ts"
      )
      const all = [...ui, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "wa.analytics.service",
    label: "Analytics service + API",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/whatsapp/analytics/analytics.service*.ts"
      )
      const route = matchGlob(
        files,
        "modules/whatsapp/analytics/api/analytics.route*.ts"
      )
      const all = [...svc, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "wa.emails.disconnected",
    label: "Device disconnected email template",
    module: "whatsapp",
    category: "whatsapp",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/whatsapp/emails/device-disconnected*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },

  // ── billing ──
  {
    id: "billing.accounts",
    label: "Billing account management service",
    module: "billing",
    category: "billing",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/billing/billing-account.service*.ts"
      )
      return {
        codeStatus: svc.length > 0 ? "implemented" : "missing",
        evidence: svc,
      }
    },
  },
  {
    id: "billing.cycles",
    label: "Billing cycle service",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/billing/billing-cycle.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.transactions",
    label: "Billing transaction service",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/billing/billing-transaction.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.balance_gate",
    label: "Balance gate (prevents overdraw)",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(files, "modules/billing/balance-gate.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.quota_gate",
    label: "Quota gate (enforces limits)",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(files, "modules/billing/quota-gate.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.costing",
    label: "Costing / price calculation service",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(files, "modules/billing/costing.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.currency",
    label: "Currency management service + DTO",
    module: "billing",
    category: "billing",
    check: (files) => {
      const svc = matchGlob(files, "modules/billing/currency.service*.ts")
      const dto = matchGlob(files, "modules/billing/currency.dto*.ts")
      const all = [...svc, ...dto]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "billing.message_cost",
    label: "Per-message cost calculation service",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(files, "modules/billing/message-cost.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.usage_ledger",
    label: "Usage ledger service",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(files, "modules/billing/usage-ledger.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.invoices",
    label: "Invoice status management + API",
    module: "billing",
    category: "billing",
    check: (files) => {
      const svc = matchGlob(files, "modules/billing/invoice-status.service*.ts")
      const route = matchGlob(files, "modules/billing/api/invoices.route*.ts")
      const all = [...svc, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "billing.subscriptions",
    label: "Subscription management + API",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/billing/api/subscriptions.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.topup",
    label: "Topup / recharge API",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(files, "modules/billing/api/topup.route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.contacts",
    label: "Billing contacts management",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/billing/billing-contact.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.user_labels",
    label: "User label management",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(files, "modules/billing/user-labels*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.admin.orgs",
    label: "Admin organization management",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(files, "modules/billing/api/admin/orgs*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.admin.adjustments",
    label: "Balance adjustments API",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/billing/api/admin/adjustments*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.admin.invoices",
    label: "Admin invoice management",
    module: "billing",
    category: "billing",
    check: (files) => {
      const inv = matchGlob(files, "modules/billing/api/admin/invoice*.ts")
      const list = matchGlob(
        files,
        "modules/billing/api/admin/invoices-list*.ts"
      )
      const all = [...inv, ...list]
      return {
        codeStatus: all.length > 0 ? "implemented" : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "billing.admin.stats",
    label: "Admin billing stats API",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(files, "modules/billing/api/admin/stats*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.admin.topup",
    label: "Admin topup API",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(files, "modules/billing/api/admin/topup*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.admin.usage",
    label: "Admin usage reporting API",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(files, "modules/billing/api/admin/usage*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "billing.audit",
    label: "Billing audit service",
    module: "billing",
    category: "billing",
    check: (files) => {
      const found = matchGlob(files, "modules/billing/audit/audit.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },

  // ── vpn ──
  {
    id: "vpn.subscriptions",
    label: "VPN subscription service + DTO",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/vpn/subscriptions/vpn-subscription.service*.ts"
      )
      const dto = matchGlob(
        files,
        "modules/vpn/subscriptions/vpn-subscription.dto*.ts"
      )
      const all = [...svc, ...dto]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "vpn.subscriptions.api",
    label: "Subscription API routes",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const user = matchGlob(
        files,
        "modules/vpn/subscriptions/api/vpn-subscriptions.route*.ts"
      )
      const admin = matchGlob(
        files,
        "modules/vpn/subscriptions/api/vpn-admin-subscriptions.route*.ts"
      )
      const all = [...user, ...admin]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "vpn.sessions.mobile",
    label: "Mobile session service + route",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/vpn/sessions/vpn-mobile-session.service*.ts"
      )
      const route = matchGlob(
        files,
        "modules/vpn/sessions/vpn-mobile-session.route*.ts"
      )
      const all = [...svc, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "vpn.provisioning.server_sync",
    label: "VPN server sync service",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/vpn/provisioning/vpn-server-sync.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "vpn.provisioning.ssh",
    label: "VPN server SSH executor",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/vpn/provisioning/vpn-server-ssh-executor*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "vpn.provisioning.reconciliation",
    label: "Provisioning reconciliation service",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/vpn/provisioning/vpn-reconciliation.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "vpn.provisioning.core",
    label: "Core provisioning service",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/vpn/provisioning/vpn-provisioning.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "vpn.openvpn.ssh",
    label: "OpenVPN SSH adapter",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/vpn/openvpn/openvpn-ssh-adapter*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "vpn.mobile.pairing",
    label: "Mobile pairing token + device + auth",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const token = matchGlob(
        files,
        "modules/vpn/mobile/vpn-pairing-token.service*.ts"
      )
      const device = matchGlob(
        files,
        "modules/vpn/mobile/vpn-mobile-device.service*.ts"
      )
      const auth = matchGlob(
        files,
        "modules/vpn/mobile/api/mobile-auth.route*.ts"
      )
      const all = [...token, ...device, ...auth]
      return {
        codeStatus:
          all.length >= 3
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "vpn.mobile.session_lib",
    label: "VPN session library",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/vpn/mobile/lib/vpn-session.lib*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "vpn.mobile.api",
    label: "Mobile profiles + pairing + device API routes",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const profiles = matchGlob(
        files,
        "modules/vpn/mobile/api/mobile-profiles.route*.ts"
      )
      const pairing = matchGlob(
        files,
        "modules/vpn/mobile/api/mobile-pairing.route*.ts"
      )
      const device = matchGlob(
        files,
        "modules/vpn/mobile/api/mobile-device.route*.ts"
      )
      const all = [...profiles, ...pairing, ...device]
      return {
        codeStatus:
          all.length >= 3
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "vpn.billing.renewal",
    label: "VPN renewal service",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/vpn/billing/vpn-renewal.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "vpn.billing.pricing",
    label: "VPN pricing rules",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const found = matchGlob(files, "modules/vpn/billing/vpn-pricing*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "vpn.emails",
    label: "VPN email templates",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const suspended = matchGlob(
        files,
        "modules/vpn/emails/subscription-suspended*.tsx"
      )
      const renewal = matchGlob(files, "modules/vpn/emails/renewal-*.tsx")
      const prov = matchGlob(
        files,
        "modules/vpn/emails/provisioning-failed*.tsx"
      )
      const all = [...suspended, ...renewal, ...prov]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "vpn.admin.servers",
    label: "VPN server admin routes",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/vpn/admin/api/vpn-servers.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "vpn.admin.audit",
    label: "VPN audit admin routes + DTO",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const route = matchGlob(
        files,
        "modules/vpn/api/admin-vpn-audit.route*.ts"
      )
      const dto = matchGlob(files, "modules/vpn/api/admin-vpn-audit.dto*.ts")
      const all = [...route, ...dto]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "vpn.ui.pairing_qr",
    label: "VPN pairing QR modal UI",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/vpn/_components/vpn-pairing-qr-modal*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "vpn.wireguard",
    label: "WireGuard service + types",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const svc = matchGlob(files, "modules/wireguard/wireguard.service*.ts")
      const types = matchGlob(files, "modules/wireguard/wireguard.types*.ts")
      const route = matchGlob(
        files,
        "modules/wireguard/api/wireguard.route*.ts"
      )
      const all = [...svc, ...types, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "vpn.api.main",
    label: "VPN main API route",
    module: "vpn",
    category: "vpn",
    check: (files) => {
      const found = matchGlob(files, "modules/vpn/api/vpn.route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },

  // ── deploy ──
  {
    id: "deploy.pipeline",
    label: "Deploy pipeline service",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const svc = matchGlob(files, "modules/deploy/deploy-pipeline.service*.ts")
      const route = matchGlob(
        files,
        "modules/deploy/api/routes/deploy-pipeline.route*.ts"
      )
      const all = [...svc, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "deploy.builder",
    label: "Deploy builder service",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/deploy/deploy-builder.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.detection",
    label: "Deploy detection service",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/deploy/deploy-detection.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.event",
    label: "Deploy event service",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(files, "modules/deploy/deploy-event.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.store",
    label: "Deploy store (state management)",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(files, "modules/deploy/deploy.store*.tsx")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.rollback",
    label: "Deploy rollback service",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/deploy/deploy-rollback.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.pricing",
    label: "Deploy pricing calculator",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(files, "modules/deploy/deploy-pricing*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.helm",
    label: "Helm chart generation",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(files, "modules/deploy/deploy.helm*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.environment_vars",
    label: "Environment variables management",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(files, "modules/deploy/environment-vars*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.monitoring",
    label: "Deploy monitor service + DTO",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const svc = matchGlob(files, "modules/deploy/deploy-monitor.service*.ts")
      const dto = matchGlob(files, "modules/deploy/deploy-monitor.dto*.ts")
      const all = [...svc, ...dto]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "deploy.recommendation",
    label: "Deploy recommendation engine",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(files, "modules/deploy/deploy-recommendation*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.logic",
    label: "Deploy business logic",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(files, "modules/deploy/deploy.logic*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.ui.wizard",
    label: "Deploy wizard UI (v1 + v2)",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const v1 = matchGlob(files, "modules/deploy/ui/deploy-wizard.tsx")
      const v2 = matchGlob(files, "modules/deploy/ui/deploy-wizard-v2.tsx")
      const all = [...v1, ...v2]
      return {
        codeStatus: all.length >= 1 ? "implemented" : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "deploy.ui.stepper",
    label: "Deploy stepper UI",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(files, "modules/deploy/ui/deploy-stepper*.tsx")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.ui.timeline",
    label: "Deploy timeline UI",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const v1 = matchGlob(files, "modules/deploy/ui/deploy-timeline.tsx")
      const v2 = matchGlob(files, "modules/deploy/ui/deploy-timeline-v2.tsx")
      const all = [...v1, ...v2]
      return {
        codeStatus: all.length >= 1 ? "implemented" : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "deploy.ui.logs",
    label: "Deploy logs panel UI",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(files, "modules/deploy/ui/logs-panel*.tsx")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.ui.env_editor",
    label: "Environment editor UI",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(files, "modules/deploy/ui/env-vars-editor*.tsx")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.ui.operate",
    label: "Operate tabs UI (domains, env, events, logs, scaling)",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const tabs = matchGlob(files, "modules/deploy/ui/operate/tab-*.tsx")
      return {
        codeStatus:
          tabs.length >= 3
            ? "implemented"
            : tabs.length > 0
              ? "partial"
              : "missing",
        evidence: tabs,
      }
    },
  },
  {
    id: "deploy.ui.traffic_flow",
    label: "Traffic flow canvas UI",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/deploy/ui/operate/traffic-flow-canvas*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.api.submit",
    label: "Deploy submit + trigger API routes",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const submit = matchGlob(
        files,
        "modules/deploy/api/routes/deploy-submit.route*.ts"
      )
      const trigger = matchGlob(
        files,
        "modules/deploy/api/routes/deploy-trigger.route*.ts"
      )
      const all = [...submit, ...trigger]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "deploy.api.billing_gate",
    label: "Billing gate API route",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/deploy/api/routes/billing-gate.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.api.app_stacks",
    label: "App stacks API route",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/deploy/api/routes/app-stacks.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.billing.hosting",
    label: "App hosting billing service",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/deploy/billing/app-hosting-billing.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.billing.alerts",
    label: "App hosting alerts service",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/deploy/billing/app-hosting-alerts.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.opensearch.index",
    label: "OpenSearch indexing service",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/deploy/opensearch/opensearch-index.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.opensearch.logs",
    label: "OpenSearch log service",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/deploy/opensearch/opensearch-log.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "deploy.jenkins",
    label: "Jenkins API + DSL + sync + webhook handler",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const api = matchGlob(files, "modules/jenkins/jenkins-api*.ts")
      const dsl = matchGlob(files, "modules/jenkins/jenkins-dsl*.ts")
      const sync = matchGlob(files, "modules/jenkins/jenkins-sync.service*.ts")
      const handler = matchGlob(
        files,
        "modules/jenkins/jenkins-webhook.handler*.ts"
      )
      const all = [...api, ...dsl, ...sync, ...handler]
      return {
        codeStatus:
          all.length >= 3
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "deploy.framework_detection",
    label: "Framework detection service + API",
    module: "deploy",
    category: "deploy",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/framework-detection/framework-detection.service*.ts"
      )
      const route = matchGlob(
        files,
        "modules/framework-detection/api/framework-detection.route*.ts"
      )
      const all = [...svc, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },

  // ── auth ──
  {
    id: "auth.service",
    label: "Core auth service (login, session)",
    module: "auth",
    category: "auth",
    check: (files) => {
      const found = matchGlob(files, "modules/auth/auth.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "auth.api",
    label: "Auth API routes",
    module: "auth",
    category: "auth",
    check: (files) => {
      const route = matchGlob(files, "modules/auth/api/auth.route*.ts")
      return {
        codeStatus: route.length > 0 ? "implemented" : "missing",
        evidence: route,
      }
    },
  },
  {
    id: "auth.whoami",
    label: "Whoami (current user) API route",
    module: "auth",
    category: "auth",
    check: (files) => {
      const found = matchGlob(files, "modules/auth/api/auth-whoami.route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "auth.session",
    label: "Session API route (app/api/auth/session)",
    module: "auth",
    category: "auth",
    check: (files) => {
      const found = matchGlob(files, "app/api/auth/session/route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "auth.platform_role",
    label: "Platform role API route",
    module: "auth",
    category: "auth",
    check: (files) => {
      const found = matchGlob(files, "app/api/auth/platform-role/route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "auth.invite_cookie",
    label: "Invite cookie handling",
    module: "auth",
    category: "auth",
    check: (files) => {
      const found = matchGlob(files, "modules/auth/invite-cookie*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },

  // ── tenant ──
  {
    id: "tenant.organizations",
    label: "Organization CRUD + listing",
    module: "tenant",
    category: "tenant",
    check: (files) => {
      const orgs = matchGlob(
        files,
        "modules/tenants/api/routes/tenants-organizations.route*.ts"
      )
      const org = matchGlob(
        files,
        "modules/tenants/api/routes/tenants-organization.route*.ts"
      )
      const all = [...orgs, ...org]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "tenant.memberships",
    label: "Membership management",
    module: "tenant",
    category: "tenant",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/tenants/api/routes/tenants-memberships.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "tenant.invitations",
    label: "Invitation flow",
    module: "tenant",
    category: "tenant",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/tenants/api/routes/tenants-invitations.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "tenant.ownership",
    label: "Organization ownership",
    module: "tenant",
    category: "tenant",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/tenants/api/routes/tenants-ownership.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "tenant.bootstrap",
    label: "Tenant bootstrap API",
    module: "tenant",
    category: "tenant",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/tenants/api/routes/tenants-bootstrap.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "tenant.authorization",
    label: "Tenant authorization",
    module: "tenant",
    category: "tenant",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/tenants/api/routes/tenants-authorization.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "tenant.policy",
    label: "Tenant policy engine",
    module: "tenant",
    category: "tenant",
    check: (files) => {
      const found = matchGlob(files, "modules/tenants/tenant-policy*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "tenant.workos",
    label: "WorkOS integration service",
    module: "tenant",
    category: "tenant",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/tenants/services/tenant-workos.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "tenant.ownership_lock",
    label: "Ownership lock service",
    module: "tenant",
    category: "tenant",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/tenants/services/tenant-ownership-lock*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "tenant.ui.onboarding",
    label: "Organization onboarding UI",
    module: "tenant",
    category: "tenant",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/tenants/ui/organization-onboarding*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "tenant.ui.admin_surface",
    label: "Organization admin surface UI",
    module: "tenant",
    category: "tenant",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/tenants/ui/organization-admin-surface*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "tenant.ui.settings",
    label: "Tenant settings header UI",
    module: "tenant",
    category: "tenant",
    check: (files) => {
      const found = matchGlob(files, "modules/tenants/ui/settings-header*.tsx")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "tenant.ui.member_discovery",
    label: "Member discovery UI",
    module: "tenant",
    category: "tenant",
    check: (files) => {
      const found = matchGlob(files, "modules/tenants/ui/member-discovery*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "tenant.workos_directory",
    label: "WorkOS directory API route",
    module: "workos-directory",
    category: "workos-directory",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/workos-directory/api/workos-directory.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },

  // ── infra ──
  {
    id: "infra.admin",
    label: "Admin service + guards + routes",
    module: "admin",
    category: "admin",
    check: (files) => {
      const svc = matchGlob(files, "modules/admin/admin.service*.ts")
      const guards = matchGlob(files, "modules/admin/admin.guards*.ts")
      const route = matchGlob(files, "modules/admin/api/admin.route*.ts")
      const all = [...svc, ...guards, ...route]
      return {
        codeStatus:
          all.length >= 3
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.github.webhook",
    label: "GitHub webhook handling + dispatch",
    module: "github",
    category: "github",
    check: (files) => {
      const webhook = matchGlob(files, "modules/github/github.webhook*.ts")
      const dispatch = matchGlob(
        files,
        "modules/github/github.webhook-dispatch*.ts"
      )
      const all = [...webhook, ...dispatch]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.github.service",
    label: "GitHub service (install, events)",
    module: "github",
    category: "github",
    check: (files) => {
      const svc = matchGlob(files, "modules/github/github.service*.ts")
      const install = matchGlob(
        files,
        "modules/github/github-install-state*.ts"
      )
      const all = [...svc, ...install]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.github.event_log",
    label: "GitHub event log service + API",
    module: "github",
    category: "github",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/github/github-event-log.service*.ts"
      )
      const route = matchGlob(
        files,
        "modules/github/api/github-event-log.route*.ts"
      )
      const all = [...svc, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.github.push",
    label: "GitHub push dispatcher",
    module: "github",
    category: "github",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/github/github-push-dispatcher*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "infra.health",
    label: "Health check service + API",
    module: "health",
    category: "health",
    check: (files) => {
      const svc = matchGlob(files, "modules/health/health.service*.ts")
      const route = matchGlob(files, "modules/health/api/health.route*.ts")
      const metrics = matchGlob(
        files,
        "modules/health/webhook-metrics.service*.ts"
      )
      const all = [...svc, ...route, ...metrics]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.users",
    label: "User management service + API",
    module: "users",
    category: "users",
    check: (files) => {
      const svc = matchGlob(files, "modules/users/users.service*.ts")
      const route = matchGlob(files, "modules/users/api/users.route*.ts")
      const all = [...svc, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.docs",
    label: "Documentation service + knowledge API",
    module: "docs",
    category: "docs",
    check: (files) => {
      const svc = matchGlob(files, "modules/docs/docs.service*.ts")
      const route = matchGlob(files, "modules/docs/api/docs.route*.ts")
      const knowledge = matchGlob(files, "modules/docs/api/knowledge.route*.ts")
      const all = [...svc, ...route, ...knowledge]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.gitops",
    label: "GitOps service + Helm template generation",
    module: "gitops",
    category: "gitops",
    check: (files) => {
      const svc = matchGlob(files, "modules/gitops/gitops.service*.ts")
      const helm = matchGlob(files, "modules/gitops/helm-template*.ts")
      const stack = matchGlob(files, "modules/gitops/stack-sync.service*.ts")
      const all = [...svc, ...helm, ...stack]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.gitops.builders",
    label: "K8s manifest builders (deployment, configmap, secret, hpa)",
    module: "gitops",
    category: "gitops",
    check: (files) => {
      const builders = matchGlob(files, "modules/gitops/builders/*.ts")
      return {
        codeStatus:
          builders.length >= 4
            ? "implemented"
            : builders.length > 0
              ? "partial"
              : "missing",
        evidence: builders,
      }
    },
  },
  {
    id: "infra.opensearch",
    label: "OpenSearch client + service",
    module: "opensearch",
    category: "opensearch",
    check: (files) => {
      const client = matchGlob(
        files,
        "modules/opensearch/opensearch.client*.ts"
      )
      const svc = matchGlob(files, "modules/opensearch/opensearch.service*.ts")
      const all = [...client, ...svc]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.vouchers",
    label: "Voucher management service + API",
    module: "infra",
    category: "infra",
    check: (files) => {
      const svc = matchGlob(files, "modules/vouchers/vouchers.service*.ts")
      const route = matchGlob(
        files,
        "modules/vouchers/api/portal-vouchers.route*.ts"
      )
      const all = [...svc, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.payment.gateway",
    label: "Payment gateway service (PayPal, Duitku)",
    module: "payment",
    category: "payment",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/payment/services/gateway.service*.ts"
      )
      const duitku = matchGlob(
        files,
        "modules/payment/services/duitku.service*.ts"
      )
      const paypal = matchGlob(
        files,
        "modules/payment/providers/paypal.provider*.ts"
      )
      const all = [...svc, ...duitku, ...paypal]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.payment.confirmation",
    label: "Payment confirmation service",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/payment/services/confirmation.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "infra.payment.bank_account",
    label: "Bank account service",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/payment/services/bank-account.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "infra.payment.encryption",
    label: "Payment encryption service",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/payment/services/encryption.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "infra.payment.topup",
    label: "Payment topup routes",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(files, "modules/payment/api/topup.route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "infra.invoices.service",
    label: "Invoice service + PDF generation",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const svc = matchGlob(files, "modules/invoices/invoices.service*.ts")
      const pdf = matchGlob(files, "modules/invoices/invoice-pdf*.tsx")
      const route = matchGlob(files, "modules/invoices/api/invoices.route*.ts")
      const all = [...svc, ...pdf, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.invoices.ui",
    label: "Invoice detail/payment/download UI",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const detail = matchGlob(
        files,
        "modules/invoices/ui/invoice-detail-screen*.tsx"
      )
      const payment = matchGlob(
        files,
        "modules/invoices/ui/invoice-payment-section*.tsx"
      )
      const download = matchGlob(
        files,
        "modules/invoices/ui/invoice-download-pdf-action*.tsx"
      )
      const all = [...detail, ...payment, ...download]
      return {
        codeStatus:
          all.length >= 3
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.support_tickets",
    label: "Support ticket service + repo + attachments + cipher",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/support-tickets/support-ticket.service*.ts"
      )
      const repo = matchGlob(
        files,
        "modules/support-tickets/support-ticket.repository*.ts"
      )
      const attach = matchGlob(
        files,
        "modules/support-tickets/support-ticket-attachment.service*.ts"
      )
      const cipher = matchGlob(
        files,
        "modules/support-tickets/support-ticket-content-cipher*.ts"
      )
      const all = [...svc, ...repo, ...attach, ...cipher]
      return {
        codeStatus:
          all.length >= 3
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.support_tickets.emails",
    label: "Support ticket email templates",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const emails = matchGlob(files, "modules/support-tickets/emails/*.tsx")
      return {
        codeStatus:
          emails.length >= 2
            ? "implemented"
            : emails.length > 0
              ? "partial"
              : "missing",
        evidence: emails,
      }
    },
  },
  {
    id: "infra.email_templates",
    label: "Email template management API",
    module: "email-templates",
    category: "email-templates",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/email-templates/api/email-templates.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "infra.credentials",
    label: "App credential management + type registry",
    module: "credentials",
    category: "credentials",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/credentials/app-credential.service*.ts"
      )
      const reg = matchGlob(
        files,
        "modules/credentials/credential-type-registry*.ts"
      )
      const route = matchGlob(
        files,
        "modules/credentials/api/credentials.route*.ts"
      )
      const all = [...svc, ...reg, ...route]
      return {
        codeStatus:
          all.length >= 2
            ? "implemented"
            : all.length > 0
              ? "partial"
              : "missing",
        evidence: all,
      }
    },
  },
  {
    id: "infra.payment.webhook",
    label: "Payment webhook route",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(files, "modules/payment/api/webhook.route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  // ── framework-detection ──
  {
    id: "framework-detection.detect",
    label: "Framework detection service",
    module: "framework-detection",
    category: "framework-detection",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/framework-detection/framework-detection.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "framework-detection.rules",
    label: "Detector rules CRUD",
    module: "framework-detection",
    category: "framework-detection",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/framework-detection/detector-admin.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "framework-detection.inspection_logs",
    label: "Inspection logs",
    module: "framework-detection",
    category: "framework-detection",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/framework-detection/inspection-log*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "framework-detection.api",
    label: "Framework detection API route",
    module: "framework-detection",
    category: "framework-detection",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/framework-detection/api/framework-detection.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "framework-detection.recommendations",
    label: "AI rule recommendations",
    module: "framework-detection",
    category: "framework-detection",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/framework-detection/detector-admin.service*.ts"
      )
      const hasRec = svc.filter((f) =>
        fileContains(f, "generateRuleRecommendations")
      )
      return {
        codeStatus: hasRec.length > 0 ? "implemented" : "missing",
        evidence: hasRec,
      }
    },
  },
  // ── github ──
  {
    id: "github.service",
    label: "GitHub service (install, repos)",
    module: "github",
    category: "github",
    check: (files) => {
      const found = matchGlob(files, "modules/github/github.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "github.installation",
    label: "GitHub installation state tracking",
    module: "github",
    category: "github",
    check: (files) => {
      const found = matchGlob(files, "modules/github/github-install-state*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "github.webhook.receive",
    label: "GitHub webhook receiver",
    module: "github",
    category: "github",
    check: (files) => {
      const found = matchGlob(files, "modules/github/github.webhook*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "github.webhook.dispatch",
    label: "GitHub webhook dispatcher",
    module: "github",
    category: "github",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/github/github.webhook-dispatch*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "github.webhook.push",
    label: "GitHub push webhook route",
    module: "github",
    category: "github",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/github/api/github-push-webhook.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "github.event.log",
    label: "GitHub event log service",
    module: "github",
    category: "github",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/github/github-event-log.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "github.event.classify",
    label: "GitHub event classifier",
    module: "github",
    category: "github",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/github/github-event-classifier*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "github.event.normalize",
    label: "GitHub event normalizer",
    module: "github",
    category: "github",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/github/github-event-normalizer*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "github.deploy",
    label: "GitHub deploy trigger",
    module: "github",
    category: "github",
    check: (files) => {
      const found = matchGlob(files, "modules/github/github-deploy*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "github.repo.commit",
    label: "GitHub commit to repo",
    module: "github",
    category: "github",
    check: (files) => {
      const svc = matchGlob(files, "modules/github/github.service*.ts")
      const hasCommit = svc.filter((f) => fileContains(f, "commitFileToRepo"))
      return {
        codeStatus: hasCommit.length > 0 ? "implemented" : "missing",
        evidence: hasCommit,
      }
    },
  },
  {
    id: "github.api",
    label: "GitHub API routes",
    module: "github",
    category: "github",
    check: (files) => {
      const routes = matchGlob(files, "modules/github/api/*.route*.ts")
      return {
        codeStatus:
          routes.length >= 2
            ? "implemented"
            : routes.length >= 1
              ? "partial"
              : "missing",
        evidence: routes,
      }
    },
  },
  // ── gitops ──
  {
    id: "gitops.manifest.generate",
    label: "K8s manifest generation (stack sync)",
    module: "gitops",
    category: "gitops",
    check: (files) => {
      const found = matchGlob(files, "modules/gitops/stack-sync.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "gitops.manifest.commit",
    label: "Manifest commit to GitOps repo",
    module: "gitops",
    category: "gitops",
    check: (files) => {
      const found = matchGlob(files, "modules/gitops/gitops.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "gitops.manifest.yaml",
    label: "YAML manifest serialization",
    module: "gitops",
    category: "gitops",
    check: (files) => {
      const found = matchGlob(files, "modules/gitops/yaml-manifest.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "gitops.builder.deployment",
    label: "Deployment manifest builder",
    module: "gitops",
    category: "gitops",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/gitops/builders/deployment.builder*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "gitops.builder.configmap",
    label: "ConfigMap manifest builder",
    module: "gitops",
    category: "gitops",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/gitops/builders/configmap.builder*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "gitops.builder.env",
    label: "Environment variable builder",
    module: "gitops",
    category: "gitops",
    check: (files) => {
      const found = matchGlob(files, "modules/gitops/builders/env.builder*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "gitops.builder.hpa",
    label: "HPA manifest builder",
    module: "gitops",
    category: "gitops",
    check: (files) => {
      const found = matchGlob(files, "modules/gitops/builders/hpa.builder*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "gitops.builder.manifest",
    label: "Composite manifest builder",
    module: "gitops",
    category: "gitops",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/gitops/builders/manifest.builder*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  // ── jenkins ──
  {
    id: "jenkins.pipeline.sync",
    label: "Jenkins pipeline sync service",
    module: "jenkins",
    category: "jenkins",
    check: (files) => {
      const found = matchGlob(files, "modules/jenkins/jenkins-sync.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "jenkins.dsl",
    label: "Jenkins DSL generator",
    module: "jenkins",
    category: "jenkins",
    check: (files) => {
      const found = matchGlob(files, "modules/jenkins/jenkins-dsl*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "jenkins.api.trigger",
    label: "Jenkins job trigger API",
    module: "jenkins",
    category: "jenkins",
    check: (files) => {
      const found = matchGlob(files, "modules/jenkins/jenkins.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "jenkins.webhook.handle",
    label: "Jenkins webhook handler",
    module: "jenkins",
    category: "jenkins",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/jenkins/jenkins-webhook.handler*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "jenkins.credentials",
    label: "Jenkins credential store",
    module: "jenkins",
    category: "jenkins",
    check: (files) => {
      const found = matchGlob(files, "modules/jenkins/jenkins-credentials*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "jenkins.api.route",
    label: "Jenkins API route",
    module: "jenkins",
    category: "jenkins",
    check: (files) => {
      const found = matchGlob(files, "modules/jenkins/api/jenkins.route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "jenkins.dsl.generate_php",
    label: "PHP Laravel DSL generation",
    module: "jenkins",
    category: "jenkins",
    check: (files) => {
      const dsl = matchGlob(files, "modules/jenkins/jenkins-dsl*.ts")
      const hasPhp = dsl.filter((f) => fileContains(f, "generatePhpDsl"))
      return {
        codeStatus: hasPhp.length > 0 ? "implemented" : "missing",
        evidence: hasPhp,
      }
    },
  },
  {
    id: "jenkins.dsl.generate_node",
    label: "Node.js DSL generation",
    module: "jenkins",
    category: "jenkins",
    check: (files) => {
      const dsl = matchGlob(files, "modules/jenkins/jenkins-dsl*.ts")
      const hasNode = dsl.filter((f) => fileContains(f, "generateNodeDsl"))
      return {
        codeStatus: hasNode.length > 0 ? "implemented" : "missing",
        evidence: hasNode,
      }
    },
  },
  // ── credentials ──
  {
    id: "credentials.service",
    label: "Credential management service",
    module: "credentials",
    category: "credentials",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/credentials/app-credential.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "credentials.type_registry",
    label: "Credential type registry",
    module: "credentials",
    category: "credentials",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/credentials/credential-type-registry*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "credentials.api",
    label: "Credential API route",
    module: "credentials",
    category: "credentials",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/credentials/api/credentials.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "credentials.create",
    label: "Create credential",
    module: "credentials",
    category: "credentials",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/credentials/app-credential.service*.ts"
      )
      const hasCreate = svc.filter((f) => fileContains(f, "createCredential"))
      return {
        codeStatus: hasCreate.length > 0 ? "implemented" : "missing",
        evidence: hasCreate,
      }
    },
  },
  {
    id: "credentials.revoke",
    label: "Revoke credential",
    module: "credentials",
    category: "credentials",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/credentials/app-credential.service*.ts"
      )
      const hasRevoke = svc.filter((f) => fileContains(f, "revokeCredential"))
      return {
        codeStatus: hasRevoke.length > 0 ? "implemented" : "missing",
        evidence: hasRevoke,
      }
    },
  },
  {
    id: "credentials.delete",
    label: "Delete credential",
    module: "credentials",
    category: "credentials",
    check: (files) => {
      const svc = matchGlob(
        files,
        "modules/credentials/app-credential.service*.ts"
      )
      const hasDelete = svc.filter((f) => fileContains(f, "deleteCredential"))
      return {
        codeStatus: hasDelete.length > 0 ? "implemented" : "missing",
        evidence: hasDelete,
      }
    },
  },
  // ── invoices ──
  {
    id: "invoices.service",
    label: "Invoice management service",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const found = matchGlob(files, "modules/invoices/invoices.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "invoices.policy",
    label: "Invoice access policy",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const found = matchGlob(files, "modules/invoices/invoices.policy*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "invoices.pdf",
    label: "Invoice PDF generation",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const found = matchGlob(files, "modules/invoices/invoice-pdf*.tsx")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "invoices.emails",
    label: "Invoice email templates",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const emails = matchGlob(files, "modules/invoices/emails/*.tsx")
      return {
        codeStatus:
          emails.length >= 3
            ? "implemented"
            : emails.length >= 1
              ? "partial"
              : "missing",
        evidence: emails,
      }
    },
  },
  {
    id: "invoices.ui.detail",
    label: "Invoice detail screen UI",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/invoices/ui/invoice-detail-screen*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "invoices.ui.payment",
    label: "Invoice payment section UI",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/invoices/ui/invoice-payment-section*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "invoices.ui.download",
    label: "Invoice PDF download action UI",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/invoices/ui/invoice-download-pdf-action*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "invoices.ui.mark_paid",
    label: "Mark invoice paid dialog UI",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/invoices/ui/mark-paid-dialog*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "invoices.api.list",
    label: "Invoice list API route",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/invoices/api/invoices-list.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "invoices.api.detail",
    label: "Invoice detail API route",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/invoices/api/invoices-detail.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "invoices.email.created",
    label: "Invoice created email template",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/invoices/emails/invoice-created*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "invoices.email.overdue",
    label: "Invoice overdue email template",
    module: "invoices",
    category: "invoices",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/invoices/emails/invoice-overdue*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  // ── payment ──
  {
    id: "payment.service",
    label: "Payment service (topup, credit)",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/payment/services/payment.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "payment.gateway",
    label: "Payment gateway resolver",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/payment/services/gateway.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "payment.confirmation",
    label: "Payment confirmation service",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/payment/services/confirmation.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "payment.bank_account",
    label: "Bank account service",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/payment/services/bank-account.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "payment.encryption",
    label: "Payment encryption service",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/payment/services/encryption.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "payment.invoice_expiration",
    label: "Invoice auto-expiration service",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/payment/services/invoice-expiration.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "payment.api.topup",
    label: "Topup API route",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(files, "modules/payment/api/topup.route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "payment.api.webhook",
    label: "Payment webhook route",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(files, "modules/payment/api/webhook.route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "payment.api.confirm",
    label: "Payment confirm route",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(files, "modules/payment/api/confirm.route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "payment.api.admin_gateway",
    label: "Admin gateway management route",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/payment/api/admin-gateway.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "payment.api.admin_bank",
    label: "Admin bank account route",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(files, "modules/payment/api/admin-bank.route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "payment.api.admin_settings",
    label: "Admin payment settings route",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/payment/api/admin-settings.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "payment.api.admin_currency",
    label: "Admin currency route",
    module: "payment",
    category: "payment",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/payment/api/admin-currency.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  // ── support-tickets ──
  {
    id: "support-tickets.service",
    label: "Support ticket core service",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/support-tickets/support-ticket.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.attachment.service",
    label: "Ticket attachment service",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/support-tickets/support-ticket-attachment.service*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.attachment.validation",
    label: "Attachment validation",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/support-tickets/support-ticket-attachment.validation*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.attachment.storage",
    label: "Attachment storage",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/support-tickets/support-ticket-attachment.storage*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.content.cipher",
    label: "Content encryption cipher",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/support-tickets/support-ticket-content-cipher*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.policy",
    label: "Ticket access policy",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/support-tickets/support-ticket.policy*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.emails",
    label: "Support ticket email templates",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const emails = matchGlob(files, "modules/support-tickets/emails/*.tsx")
      return {
        codeStatus:
          emails.length >= 3
            ? "implemented"
            : emails.length >= 1
              ? "partial"
              : "missing",
        evidence: emails,
      }
    },
  },
  {
    id: "support-tickets.email.created",
    label: "Ticket created email",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/support-tickets/emails/ticket-created*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.email.admin_alert",
    label: "New ticket admin alert email",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/support-tickets/emails/ticket-new-admin-alert*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.email.replied",
    label: "Ticket replied email",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/support-tickets/emails/ticket-replied*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.email.closed",
    label: "Ticket closed email",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/support-tickets/emails/ticket-closed*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.ui.create",
    label: "Ticket creation screen UI",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "app/**/support-tickets/support-ticket-create-screen*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.ui.detail",
    label: "Ticket detail screen UI",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "app/**/support-tickets/support-ticket-detail-screen*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.ui.portal",
    label: "Ticket portal listing UI",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "app/**/portal/support-tickets/support-tickets-portal*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.ui.portal_detail",
    label: "Ticket portal admin detail UI",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "app/**/portal/support-tickets/support-ticket-admin-detail-screen*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "support-tickets.api.attachments",
    label: "Ticket attachments API route",
    module: "support-tickets",
    category: "support-tickets",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/support-tickets/api/support-ticket-attachments.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  // ── vouchers ──
  {
    id: "vouchers.service",
    label: "Voucher management service",
    module: "vouchers",
    category: "vouchers",
    check: (files) => {
      const found = matchGlob(files, "modules/vouchers/vouchers.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "vouchers.code",
    label: "Voucher code generator",
    module: "vouchers",
    category: "vouchers",
    check: (files) => {
      const found = matchGlob(files, "modules/vouchers/voucher-code*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "vouchers.create",
    label: "Create voucher",
    module: "vouchers",
    category: "vouchers",
    check: (files) => {
      const svc = matchGlob(files, "modules/vouchers/vouchers.service*.ts")
      const hasCreate = svc.filter((f) => fileContains(f, "createVoucher"))
      return {
        codeStatus: hasCreate.length > 0 ? "implemented" : "missing",
        evidence: hasCreate,
      }
    },
  },
  {
    id: "vouchers.redeem",
    label: "Redeem voucher",
    module: "vouchers",
    category: "vouchers",
    check: (files) => {
      const svc = matchGlob(files, "modules/vouchers/vouchers.service*.ts")
      const hasRedeem = svc.filter((f) => fileContains(f, "redeemVoucher"))
      return {
        codeStatus: hasRedeem.length > 0 ? "implemented" : "missing",
        evidence: hasRedeem,
      }
    },
  },
  {
    id: "vouchers.list",
    label: "List vouchers",
    module: "vouchers",
    category: "vouchers",
    check: (files) => {
      const svc = matchGlob(files, "modules/vouchers/vouchers.service*.ts")
      const hasList = svc.filter((f) => fileContains(f, "listVouchers"))
      return {
        codeStatus: hasList.length > 0 ? "implemented" : "missing",
        evidence: hasList,
      }
    },
  },
  {
    id: "vouchers.update",
    label: "Update voucher",
    module: "vouchers",
    category: "vouchers",
    check: (files) => {
      const svc = matchGlob(files, "modules/vouchers/vouchers.service*.ts")
      const hasUpdate = svc.filter((f) => fileContains(f, "updateVoucher"))
      return {
        codeStatus: hasUpdate.length > 0 ? "implemented" : "missing",
        evidence: hasUpdate,
      }
    },
  },
  {
    id: "vouchers.disable",
    label: "Disable voucher",
    module: "vouchers",
    category: "vouchers",
    check: (files) => {
      const svc = matchGlob(files, "modules/vouchers/vouchers.service*.ts")
      const hasDisable = svc.filter((f) => fileContains(f, "disableVoucher"))
      return {
        codeStatus: hasDisable.length > 0 ? "implemented" : "missing",
        evidence: hasDisable,
      }
    },
  },
  {
    id: "vouchers.claims",
    label: "Get voucher claims",
    module: "vouchers",
    category: "vouchers",
    check: (files) => {
      const svc = matchGlob(files, "modules/vouchers/vouchers.service*.ts")
      const hasClaims = svc.filter((f) => fileContains(f, "getVoucherClaims"))
      return {
        codeStatus: hasClaims.length > 0 ? "implemented" : "missing",
        evidence: hasClaims,
      }
    },
  },
  {
    id: "vouchers.ui.list",
    label: "Voucher management table UI",
    module: "vouchers",
    category: "vouchers",
    check: (files) => {
      const found = matchGlob(
        files,
        "app/**/voucher/voucher-management-table*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "vouchers.ui.detail",
    label: "Voucher detail UI",
    module: "vouchers",
    category: "vouchers",
    check: (files) => {
      const found = matchGlob(files, "app/**/voucher/[id]/*.tsx")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  // ── users ──
  {
    id: "users.service",
    label: "User management service",
    module: "users",
    category: "users",
    check: (files) => {
      const found = matchGlob(files, "modules/users/users.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "users.api",
    label: "User API routes",
    module: "users",
    category: "users",
    check: (files) => {
      const found = matchGlob(files, "modules/users/api/users.route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "users.create",
    label: "Create user record",
    module: "users",
    category: "users",
    check: (files) => {
      const svc = matchGlob(files, "modules/users/users.service*.ts")
      const hasCreate = svc.filter((f) => fileContains(f, "createUser"))
      return {
        codeStatus: hasCreate.length > 0 ? "implemented" : "missing",
        evidence: hasCreate,
      }
    },
  },
  // ── email-templates ──
  {
    id: "email-templates.api",
    label: "Email template API route",
    module: "email-templates",
    category: "email-templates",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/email-templates/api/email-templates.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "email-templates.preview",
    label: "Email template preview",
    module: "email-templates",
    category: "email-templates",
    check: (files) => {
      const routes = matchGlob(
        files,
        "modules/email-templates/api/email-templates.route*.ts"
      )
      const hasPreview = routes.filter((f) => fileContains(f, "preview"))
      return {
        codeStatus: hasPreview.length > 0 ? "implemented" : "missing",
        evidence: hasPreview,
      }
    },
  },
  // ── wireguard ──
  {
    id: "wireguard.service",
    label: "WireGuard management service",
    module: "wireguard",
    category: "wireguard",
    check: (files) => {
      const found = matchGlob(files, "modules/wireguard/wireguard.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "wireguard.types",
    label: "WireGuard type definitions",
    module: "wireguard",
    category: "wireguard",
    check: (files) => {
      const found = matchGlob(files, "modules/wireguard/wireguard.types*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "wireguard.api",
    label: "WireGuard API route",
    module: "wireguard",
    category: "wireguard",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/wireguard/api/wireguard.route*.ts"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "wireguard.peer.list",
    label: "List WireGuard peers",
    module: "wireguard",
    category: "wireguard",
    check: (files) => {
      const svc = matchGlob(files, "modules/wireguard/wireguard.service*.ts")
      const hasList = svc.filter((f) => fileContains(f, "listPeers"))
      return {
        codeStatus: hasList.length > 0 ? "implemented" : "missing",
        evidence: hasList,
      }
    },
  },
  {
    id: "wireguard.peer.qr",
    label: "WireGuard QR code generation",
    module: "wireguard",
    category: "wireguard",
    check: (files) => {
      const svc = matchGlob(files, "modules/wireguard/wireguard.service*.ts")
      const hasQr = svc.filter((f) => fileContains(f, "getQr"))
      return {
        codeStatus: hasQr.length > 0 ? "implemented" : "missing",
        evidence: hasQr,
      }
    },
  },
  // ── docs ──
  {
    id: "docs.service",
    label: "Documentation service",
    module: "docs",
    category: "docs",
    check: (files) => {
      const found = matchGlob(files, "modules/docs/docs.service*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "docs.api.console",
    label: "Docs console API route",
    module: "docs",
    category: "docs",
    check: (files) => {
      const found = matchGlob(files, "modules/docs/api/docs-console.route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "docs.api.knowledge",
    label: "Knowledge base API route",
    module: "docs",
    category: "docs",
    check: (files) => {
      const found = matchGlob(files, "modules/docs/api/knowledge.route*.ts")
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
  {
    id: "docs.ui.thunder",
    label: "Thunder AI help drawer UI",
    module: "docs",
    category: "docs",
    check: (files) => {
      const found = matchGlob(
        files,
        "modules/docs/ui/thunder-ai-help-drawer*.tsx"
      )
      return {
        codeStatus: found.length > 0 ? "implemented" : "missing",
        evidence: found,
      }
    },
  },
]

export const collectFiles = async (): Promise<string[]> => {
  const all: string[] = []
  for (const pattern of SCAN_GLOBS) {
    const glob = new Glob(pattern)
    for await (const f of glob.scan({ cwd: REPO_ROOT })) all.push(f)
  }
  return all.sort()
}

export const groupByModule = (rules: Rule[]): Map<string, Rule[]> => {
  const groups = new Map<string, Rule[]>()
  for (const rule of rules) {
    const key = rule.module
    const arr = groups.get(key) ?? []
    arr.push(rule)
    groups.set(key, arr)
  }
  return groups
}

export const runModuleAudit = (
  rules: Rule[],
  files: string[],
  moduleName: string,
  category: ModuleCategory,
  now: Date
): AuditReport => {
  const ts = now.toISOString()
  const features: FeatureEntry[] = rules.map((rule) => {
    const { codeStatus, evidence } = rule.check(files)
    return {
      id: rule.id,
      label: rule.label,
      codeStatus,
      evidence,
      lastVerified: ts,
    }
  })
  const summary = {
    total: features.length,
    implemented: features.filter((f) => f.codeStatus === "implemented").length,
    partial: features.filter((f) => f.codeStatus === "partial").length,
    missing: features.filter((f) => f.codeStatus === "missing").length,
  }
  return AuditReportSchema.parse({
    generatedAt: ts,
    module: moduleName,
    category,
    features,
    summary,
  })
}

// Back-compat: original runAudit produces the combined whatsapp report
export const runAudit = (files: string[], now: Date): AuditReport => {
  const waRules = RULES.filter((r) => r.module === "whatsapp")
  return runModuleAudit(waRules, files, "whatsapp", "whatsapp", now)
}

export const printSummary = (report: AuditReport): void => {
  const line =
    `${report.module} audit: ${report.summary.implemented} implemented, ` +
    `${report.summary.partial} partial, ${report.summary.missing} missing ` +
    `(verified ${report.generatedAt})`
  console.log(line)
}

if (import.meta.main) {
  mkdirSync(AUDITS_DIR, { recursive: true })

  const files = await collectFiles()
  const now = new Date()
  const groups = groupByModule(RULES)

  const allFeatures: FeatureEntry[] = []

  for (const [mod, rules] of groups) {
    const cat = (rules[0]?.category ?? "other") as ModuleCategory
    const report = runModuleAudit(rules, files, mod, cat, now)
    allFeatures.push(...report.features)

    const modulePath = resolve(AUDITS_DIR, `${mod}.audit.json`)
    await Bun.write(modulePath, JSON.stringify(report, null, 2) + "\n")
    printSummary(report)
  }

  // Combined report (back-compat)
  const summary = {
    total: allFeatures.length,
    implemented: allFeatures.filter((f) => f.codeStatus === "implemented")
      .length,
    partial: allFeatures.filter((f) => f.codeStatus === "partial").length,
    missing: allFeatures.filter((f) => f.codeStatus === "missing").length,
  }
  const combined = AuditReportSchema.parse({
    generatedAt: now.toISOString(),
    module: "combined",
    features: allFeatures,
    summary,
  })
  await Bun.write(OUTPUT_PATH, JSON.stringify(combined, null, 2) + "\n")

  console.log(
    `\nCombined: ${summary.total} features — ${summary.implemented} implemented, ${summary.partial} partial, ${summary.missing} missing`
  )
}

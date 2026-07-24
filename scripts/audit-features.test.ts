import { describe, expect, test } from "bun:test"
import {
  RULES,
  collectFiles,
  runAudit,
  runModuleAudit,
  groupByModule,
  type Rule,
} from "./audit-features"
import type { AuditReport, ModuleCategory } from "./audit-features.schema"

const ALL_IMPLEMENTED = [
  "modules/whatsapp/webhooks/services/webhook-hmac.service.ts",
  "modules/whatsapp/webhooks/jobs/webhook-retry.job.ts",
  "modules/whatsapp/webhooks/services/webhook-dead-letter.service.ts",
  "modules/whatsapp/webhooks/api/webhook-dead-letter.route.ts",
  "modules/whatsapp/broadcasts/broadcast-schedule.service.ts",
  "modules/whatsapp/broadcasts/broadcast-schedule.service.test.ts",
  "modules/whatsapp/messages/ui/message-status-badge.tsx",
  "modules/whatsapp/templates/templates.dto.ts",
  "modules/whatsapp/tokens/services/token-refresh.service.ts",
]

const findRule = (id: string): Rule => {
  const rule = RULES.find((r) => r.id === id)
  if (!rule) throw new Error(`rule ${id} not found`)
  return rule
}

// ─── Original 7 whatsapp rules (must not regress) ─────────────────────────

describe("wa.webhook.hmac", () => {
  test("implemented when service exists with verify export", () => {
    const r = findRule("wa.webhook.hmac").check(ALL_IMPLEMENTED)
    expect(r.codeStatus).toBe("implemented")
    expect(r.evidence[0]).toBe(
      "modules/whatsapp/webhooks/services/webhook-hmac.service.ts"
    )
  })
  test("missing when no matching file", () => {
    const r = findRule("wa.webhook.hmac").check([])
    expect(r.codeStatus).toBe("missing")
  })
})

describe("wa.webhook.retry", () => {
  test("implemented when retry job exists", () => {
    const r = findRule("wa.webhook.retry").check(ALL_IMPLEMENTED)
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("wa.webhook.dead_letter", () => {
  test("implemented when both service and route exist", () => {
    const r = findRule("wa.webhook.dead_letter").check(ALL_IMPLEMENTED)
    expect(r.codeStatus).toBe("implemented")
    expect(r.evidence).toHaveLength(2)
  })
  test("partial when only service exists", () => {
    const r = findRule("wa.webhook.dead_letter").check([
      "modules/whatsapp/webhooks/services/webhook-dead-letter.service.ts",
    ])
    expect(r.codeStatus).toBe("partial")
  })
})

describe("wa.broadcast.scheduling", () => {
  test("implemented when service and test exist", () => {
    const r = findRule("wa.broadcast.scheduling").check(ALL_IMPLEMENTED)
    expect(r.codeStatus).toBe("implemented")
    expect(r.evidence.some((e) => e.endsWith(".test.ts"))).toBe(true)
  })
  test("partial when service has no test", () => {
    const r = findRule("wa.broadcast.scheduling").check([
      "modules/whatsapp/broadcasts/broadcast-schedule.service.ts",
    ])
    expect(r.codeStatus).toBe("partial")
  })
})

describe("wa.messages.delivery_status_ui", () => {
  test("implemented when badge has all 4 states", () => {
    const r = findRule("wa.messages.delivery_status_ui").check(ALL_IMPLEMENTED)
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("wa.templates.reject_reason_ui", () => {
  test("partial when DTO exists but no UI consumer", () => {
    const r = findRule("wa.templates.reject_reason_ui").check([
      "modules/whatsapp/templates/templates.dto.ts",
    ])
    expect(r.codeStatus).toBe("partial")
  })
  test("missing when neither DTO field nor UI", () => {
    const r = findRule("wa.templates.reject_reason_ui").check([])
    expect(r.codeStatus).toBe("missing")
  })
})

describe("wa.tokens.refresh", () => {
  test("implemented when token service files exist", () => {
    const r = findRule("wa.tokens.refresh").check(ALL_IMPLEMENTED)
    expect(r.codeStatus).toBe("implemented")
  })
})

// ─── New whatsapp rules ──────────────────────────────────────────────────

describe("wa.webhooks.dispatcher", () => {
  test("implemented when dispatcher exists", () => {
    const r = findRule("wa.webhooks.dispatcher").check([
      "modules/whatsapp/webhooks/webhook-dispatcher.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("missing when no file", () => {
    const r = findRule("wa.webhooks.dispatcher").check([])
    expect(r.codeStatus).toBe("missing")
  })
})

describe("wa.messages.service", () => {
  test("implemented when service and route exist", () => {
    const r = findRule("wa.messages.service").check([
      "modules/whatsapp/messages/messages.service.ts",
      "modules/whatsapp/messages/api/messages.route.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("partial when only service exists", () => {
    const r = findRule("wa.messages.service").check([
      "modules/whatsapp/messages/messages.service.ts",
    ])
    expect(r.codeStatus).toBe("partial")
  })
})

describe("wa.analytics.service", () => {
  test("implemented when service and route exist", () => {
    const r = findRule("wa.analytics.service").check([
      "modules/whatsapp/analytics/analytics.service.ts",
      "modules/whatsapp/analytics/api/analytics.route.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

// ─── Billing rules ───────────────────────────────────────────────────────

describe("billing.accounts", () => {
  test("implemented when service exists", () => {
    const r = findRule("billing.accounts").check([
      "modules/billing/billing-account.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("missing when no file", () => {
    const r = findRule("billing.accounts").check([])
    expect(r.codeStatus).toBe("missing")
  })
})

describe("billing.balance_gate", () => {
  test("implemented when service exists", () => {
    const r = findRule("billing.balance_gate").check([
      "modules/billing/balance-gate.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("billing.invoices", () => {
  test("implemented when service and route exist", () => {
    const r = findRule("billing.invoices").check([
      "modules/billing/invoice-status.service.ts",
      "modules/billing/api/invoices.route.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("partial when only service exists", () => {
    const r = findRule("billing.invoices").check([
      "modules/billing/invoice-status.service.ts",
    ])
    expect(r.codeStatus).toBe("partial")
  })
})

// ─── VPN rules ───────────────────────────────────────────────────────────

describe("vpn.subscriptions", () => {
  test("implemented when service and dto exist", () => {
    const r = findRule("vpn.subscriptions").check([
      "modules/vpn/subscriptions/vpn-subscription.service.ts",
      "modules/vpn/subscriptions/vpn-subscription.dto.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("missing when no files", () => {
    const r = findRule("vpn.subscriptions").check([])
    expect(r.codeStatus).toBe("missing")
  })
})

describe("vpn.provisioning.core", () => {
  test("implemented when service exists", () => {
    const r = findRule("vpn.provisioning.core").check([
      "modules/vpn/provisioning/vpn-provisioning.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("vpn.mobile.pairing", () => {
  test("implemented when token + device + auth exist", () => {
    const r = findRule("vpn.mobile.pairing").check([
      "modules/vpn/mobile/vpn-pairing-token.service.ts",
      "modules/vpn/mobile/vpn-mobile-device.service.ts",
      "modules/vpn/mobile/api/mobile-auth.route.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("partial when only some files exist", () => {
    const r = findRule("vpn.mobile.pairing").check([
      "modules/vpn/mobile/vpn-pairing-token.service.ts",
    ])
    expect(r.codeStatus).toBe("partial")
  })
})

// ─── Deploy rules ────────────────────────────────────────────────────────

describe("deploy.pipeline", () => {
  test("implemented when service and route exist", () => {
    const r = findRule("deploy.pipeline").check([
      "modules/deploy/deploy-pipeline.service.ts",
      "modules/deploy/api/routes/deploy-pipeline.route.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("partial when only service exists", () => {
    const r = findRule("deploy.pipeline").check([
      "modules/deploy/deploy-pipeline.service.ts",
    ])
    expect(r.codeStatus).toBe("partial")
  })
})

describe("deploy.builder", () => {
  test("implemented when service exists", () => {
    const r = findRule("deploy.builder").check([
      "modules/deploy/deploy-builder.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("deploy.ui.operate", () => {
  test("implemented when 3+ operate tabs exist", () => {
    const r = findRule("deploy.ui.operate").check([
      "modules/deploy/ui/operate/tab-domains.tsx",
      "modules/deploy/ui/operate/tab-env.tsx",
      "modules/deploy/ui/operate/tab-events.tsx",
      "modules/deploy/ui/operate/tab-logs.tsx",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("partial when only 1 tab exists", () => {
    const r = findRule("deploy.ui.operate").check([
      "modules/deploy/ui/operate/tab-logs.tsx",
    ])
    expect(r.codeStatus).toBe("partial")
  })
})

// ─── Auth rules ──────────────────────────────────────────────────────────

describe("auth.service", () => {
  test("implemented when service file exists", () => {
    const r = findRule("auth.service").check(["modules/auth/auth.service.ts"])
    expect(r.codeStatus).toBe("implemented")
  })
  test("missing when no file", () => {
    const r = findRule("auth.service").check([])
    expect(r.codeStatus).toBe("missing")
  })
})

describe("auth.session", () => {
  test("implemented when route exists", () => {
    const r = findRule("auth.session").check(["app/api/auth/session/route.ts"])
    expect(r.codeStatus).toBe("implemented")
  })
})

// ─── Tenant rules ────────────────────────────────────────────────────────

describe("tenant.policy", () => {
  test("implemented when policy file exists", () => {
    const r = findRule("tenant.policy").check([
      "modules/tenants/tenant-policy.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("missing when no file", () => {
    const r = findRule("tenant.policy").check([])
    expect(r.codeStatus).toBe("missing")
  })
})

describe("tenant.memberships", () => {
  test("implemented when route exists", () => {
    const r = findRule("tenant.memberships").check([
      "modules/tenants/api/routes/tenants-memberships.route.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

// ─── Infra rules ─────────────────────────────────────────────────────────

describe("infra.admin", () => {
  test("implemented when service + guards + route exist", () => {
    const r = findRule("infra.admin").check([
      "modules/admin/admin.service.ts",
      "modules/admin/admin.guards.ts",
      "modules/admin/api/admin.route.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("partial when only some files exist", () => {
    const r = findRule("infra.admin").check(["modules/admin/admin.service.ts"])
    expect(r.codeStatus).toBe("partial")
  })
})

describe("infra.support_tickets", () => {
  test("implemented when service + repo + attach + cipher exist", () => {
    const r = findRule("infra.support_tickets").check([
      "modules/support-tickets/support-ticket.service.ts",
      "modules/support-tickets/support-ticket.repository.ts",
      "modules/support-tickets/support-ticket-attachment.service.ts",
      "modules/support-tickets/support-ticket-content-cipher.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("partial when only some exist", () => {
    const r = findRule("infra.support_tickets").check([
      "modules/support-tickets/support-ticket.service.ts",
    ])
    expect(r.codeStatus).toBe("partial")
  })
})

describe("infra.payment.gateway", () => {
  test("implemented when gateway + duitku exist", () => {
    const r = findRule("infra.payment.gateway").check([
      "modules/payment/services/gateway.service.ts",
      "modules/payment/services/duitku.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

// ─── New module rules (reclassified from infra) ──────────────────────────

describe("infra.health", () => {
  test("implemented when health service and route exist", () => {
    const r = findRule("infra.health").check([
      "modules/health/health.service.ts",
      "modules/health/api/health.route.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("partial when only some files exist", () => {
    const r = findRule("infra.health").check([
      "modules/health/health.service.ts",
    ])
    expect(r.codeStatus).toBe("partial")
  })
  test("missing when no files", () => {
    const r = findRule("infra.health").check([])
    expect(r.codeStatus).toBe("missing")
  })
})

describe("infra.opensearch", () => {
  test("implemented when client and service exist", () => {
    const r = findRule("infra.opensearch").check([
      "modules/opensearch/opensearch.client.ts",
      "modules/opensearch/opensearch.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("tenant.workos_directory", () => {
  test("implemented when route exists", () => {
    const r = findRule("tenant.workos_directory").check([
      "modules/workos-directory/api/workos-directory.route.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

// ─── New module rules (fresh) ─────────────────────────────────────────────

describe("users.service", () => {
  test("implemented when service exists", () => {
    const r = findRule("users.service").check([
      "modules/users/users.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("missing when no files", () => {
    const r = findRule("users.service").check([])
    expect(r.codeStatus).toBe("missing")
  })
})

describe("users.api", () => {
  test("implemented when route exists", () => {
    const r = findRule("users.api").check(["modules/users/api/users.route.ts"])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("docs.service", () => {
  test("implemented when service exists", () => {
    const r = findRule("docs.service").check(["modules/docs/docs.service.ts"])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("docs.api.knowledge", () => {
  test("implemented when knowledge route exists", () => {
    const r = findRule("docs.api.knowledge").check([
      "modules/docs/api/knowledge.route.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("gitops.manifest.generate", () => {
  test("implemented when stack-sync exists", () => {
    const r = findRule("gitops.manifest.generate").check([
      "modules/gitops/stack-sync.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("gitops.builder.deployment", () => {
  test("implemented when deployment builder exists", () => {
    const r = findRule("gitops.builder.deployment").check([
      "modules/gitops/builders/deployment.builder.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("github.service", () => {
  test("implemented when service exists", () => {
    const r = findRule("github.service").check([
      "modules/github/github.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("github.webhook.receive", () => {
  test("implemented when webhook file exists", () => {
    const r = findRule("github.webhook.receive").check([
      "modules/github/github.webhook.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("github.event.classify", () => {
  test("implemented when classifier exists", () => {
    const r = findRule("github.event.classify").check([
      "modules/github/github-event-classifier.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("github.api", () => {
  test("implemented when 2+ routes exist", () => {
    const r = findRule("github.api").check([
      "modules/github/api/github-event-log.route.ts",
      "modules/github/api/github-push-webhook.route.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("partial when 1 route exists", () => {
    const r = findRule("github.api").check([
      "modules/github/api/github-event-log.route.ts",
    ])
    expect(r.codeStatus).toBe("partial")
  })
})

describe("jenkins.pipeline.sync", () => {
  test("implemented when sync service exists", () => {
    const r = findRule("jenkins.pipeline.sync").check([
      "modules/jenkins/jenkins-sync.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("jenkins.dsl", () => {
  test("implemented when DSL generator exists", () => {
    const r = findRule("jenkins.dsl").check(["modules/jenkins/jenkins-dsl.ts"])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("jenkins.api.route", () => {
  test("implemented when route exists", () => {
    const r = findRule("jenkins.api.route").check([
      "modules/jenkins/api/jenkins.route.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("credentials.service", () => {
  test("implemented when service exists", () => {
    const r = findRule("credentials.service").check([
      "modules/credentials/app-credential.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("credentials.type_registry", () => {
  test("implemented when registry exists", () => {
    const r = findRule("credentials.type_registry").check([
      "modules/credentials/credential-type-registry.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("email-templates.api", () => {
  test("implemented when route exists", () => {
    const r = findRule("email-templates.api").check([
      "modules/email-templates/api/email-templates.route.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("framework-detection.detect", () => {
  test("implemented when detection service exists", () => {
    const r = findRule("framework-detection.detect").check([
      "modules/framework-detection/framework-detection.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("framework-detection.rules", () => {
  test("implemented when detector-admin exists", () => {
    const r = findRule("framework-detection.rules").check([
      "modules/framework-detection/detector-admin.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("wireguard.service", () => {
  test("implemented when service exists", () => {
    const r = findRule("wireguard.service").check([
      "modules/wireguard/wireguard.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("invoices.service", () => {
  test("implemented when service exists", () => {
    const r = findRule("invoices.service").check([
      "modules/invoices/invoices.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("missing when no files", () => {
    const r = findRule("invoices.service").check([])
    expect(r.codeStatus).toBe("missing")
  })
})

describe("invoices.policy", () => {
  test("implemented when policy exists", () => {
    const r = findRule("invoices.policy").check([
      "modules/invoices/invoices.policy.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("invoices.emails", () => {
  test("implemented when 3+ emails exist", () => {
    const r = findRule("invoices.emails").check([
      "modules/invoices/emails/invoice-created.tsx",
      "modules/invoices/emails/invoice-overdue.tsx",
      "modules/invoices/emails/invoice-paid.tsx",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
  test("partial when only 1 email exists", () => {
    const r = findRule("invoices.emails").check([
      "modules/invoices/emails/invoice-created.tsx",
    ])
    expect(r.codeStatus).toBe("partial")
  })
})

describe("payment.service", () => {
  test("implemented when service exists", () => {
    const r = findRule("payment.service").check([
      "modules/payment/services/payment.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("payment.gateway", () => {
  test("implemented when gateway resolver exists", () => {
    const r = findRule("payment.gateway").check([
      "modules/payment/services/gateway.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("payment.encryption", () => {
  test("implemented when encryption service exists", () => {
    const r = findRule("payment.encryption").check([
      "modules/payment/services/encryption.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("vouchers.service", () => {
  test("implemented when service exists", () => {
    const r = findRule("vouchers.service").check([
      "modules/vouchers/vouchers.service.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("vouchers.code", () => {
  test("implemented when code generator exists", () => {
    const r = findRule("vouchers.code").check([
      "modules/vouchers/voucher-code.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

describe("support-tickets.policy", () => {
  test("implemented when policy exists", () => {
    const r = findRule("support-tickets.policy").check([
      "modules/support-tickets/support-ticket.policy.ts",
    ])
    expect(r.codeStatus).toBe("implemented")
  })
})

// ─── Module grouping ─────────────────────────────────────────────────────

describe("groupByModule", () => {
  test("groups rules by module", () => {
    const groups = groupByModule(RULES)
    expect(groups.size).toBeGreaterThanOrEqual(23)
    expect(groups.has("whatsapp")).toBe(true)
    expect(groups.has("billing")).toBe(true)
    expect(groups.has("vpn")).toBe(true)
    expect(groups.has("deploy")).toBe(true)
    expect(groups.has("auth")).toBe(true)
    expect(groups.has("tenant")).toBe(true)
    expect(groups.has("infra")).toBe(true)
    expect(groups.has("admin")).toBe(true)
    expect(groups.has("health")).toBe(true)
    expect(groups.has("opensearch")).toBe(true)
    expect(groups.has("github")).toBe(true)
    expect(groups.has("gitops")).toBe(true)
    expect(groups.has("jenkins")).toBe(true)
    expect(groups.has("credentials")).toBe(true)
    expect(groups.has("invoices")).toBe(true)
    expect(groups.has("payment")).toBe(true)
    expect(groups.has("support-tickets")).toBe(true)
    expect(groups.has("vouchers")).toBe(true)
    expect(groups.has("users")).toBe(true)
    expect(groups.has("docs")).toBe(true)
    expect(groups.has("wireguard")).toBe(true)
    expect(groups.has("email-templates")).toBe(true)
    expect(groups.has("framework-detection")).toBe(true)
    expect(groups.has("workos-directory")).toBe(true)
  })
})

describe("runModuleAudit", () => {
  test("produces valid per-module report", async () => {
    const files = await collectFiles()
    const groups = groupByModule(RULES)
    const waRules = groups.get("whatsapp")!
    const report = runModuleAudit(
      waRules,
      files,
      "whatsapp",
      "whatsapp",
      new Date("2026-07-24T00:00:00Z")
    )
    expect(report.module).toBe("whatsapp")
    expect(report.category).toBe("whatsapp")
    expect(report.features).toHaveLength(waRules.length)
    expect(report.summary.total).toBe(waRules.length)
    expect(
      report.summary.implemented +
        report.summary.partial +
        report.summary.missing
    ).toBe(waRules.length)
  })
})

// ─── Combined (back-compat) ─────────────────────────────────────────────

describe("runAudit (back-compat)", () => {
  test("produces a valid whatsapp-only report", async () => {
    const files = await collectFiles()
    const report: AuditReport = runAudit(
      files,
      new Date("2026-07-24T00:00:00Z")
    )
    expect(report.module).toBe("whatsapp")
    expect(report.features.length).toBeGreaterThanOrEqual(7)
    expect(
      report.summary.implemented +
        report.summary.partial +
        report.summary.missing
    ).toBe(report.features.length)
  })
  test("evidence entries are file:line strings or relative paths", async () => {
    const files = await collectFiles()
    const report = runAudit(files, new Date("2026-07-24T00:00:00Z"))
    for (const f of report.features) {
      for (const ev of f.evidence) {
        expect(ev).toMatch(/^(modules|app)\//)
      }
    }
  })
  test("lastVerified is ISO timestamp", async () => {
    const files = await collectFiles()
    const report = runAudit(files, new Date("2026-07-24T00:00:00.000Z"))
    for (const f of report.features) {
      expect(f.lastVerified).toBe("2026-07-24T00:00:00.000Z")
    }
  })
})

// ─── Per-module live audits ──────────────────────────────────────────────

describe("live per-module audits", () => {
  test("all modules produce valid reports", async () => {
    const files = await collectFiles()
    const now = new Date("2026-07-24T00:00:00Z")
    const groups = groupByModule(RULES)

    expect(groups.size).toBeGreaterThanOrEqual(23)

    for (const [mod, rules] of groups) {
      const cat = (rules[0]?.category ?? "other") as ModuleCategory
      const report = runModuleAudit(rules, files, mod, cat, now)
      expect(report.module).toBe(mod)
      expect(report.features).toHaveLength(rules.length)
      expect(report.summary.total).toBe(rules.length)
      expect(
        report.summary.implemented +
          report.summary.partial +
          report.summary.missing
      ).toBe(rules.length)
      for (const f of report.features) {
        for (const ev of f.evidence) {
          expect(ev).toMatch(/^(modules|app)\//)
        }
      }
    }
  })
})

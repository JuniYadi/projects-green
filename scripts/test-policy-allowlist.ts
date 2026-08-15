export const TEST_POLICY_ALLOWLIST = [
  {
    path: "lib/auth/session.test.ts",
    token: "it.skip",
    owner: "@JuniYadi",
    reason: "Conditional compatibility branch for Bun versions",
    reviewAfter: "2026-10-30",
  },
  {
    path: "modules/tenants/services/tenant-workos.service.test.ts",
    token: "describe.skip",
    owner: "@JuniYadi",
    reason: "Conditional WorkOS SDK compatibility branch",
    reviewAfter: "2026-10-30",
  },
  {
    path: "e2e/smoke/portal/vpn-package-catalog-sync.spec.ts",
    token: "test.skip",
    owner: "@JuniYadi",
    reason:
      "Conditional skip when the authenticated functional-test server mode isn't configured",
    reviewAfter: "2026-10-30",
  },
] as const

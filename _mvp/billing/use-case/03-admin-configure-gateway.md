# Admin Configure Payment Gateway

## Codebase Status

✅ **Real.** `admin-gateway.route.ts` + `gateway.service.ts` (AES-256-GCM encryption); `getActiveConfig()` resolves at runtime. UI at `/portal/payments` Gateways tab.

## Entry Point

`/portal/payments` → Gateway tab

## Actor

Billing Admin / Super admin

## Goal

Set up and activate Duitku merchant credentials so the customer top-up money path works.

## Preconditions

- Admin resolves to `super_admin`.
- Duitku merchant credentials available (merchant code, API key, sandbox/prod URLs).

## Happy Path

1. Admin opens `/portal/payments` → Gateway tab.
2. Admin clicks **Add Gateway**, fills name, type, merchant code, API key, URLs.
3. Config saved encrypted via `gateway.service.ts` (AES-256-GCM).
4. Admin toggles gateway active.
5. `duitkuService.getActiveConfig()` resolves this config at runtime for top-ups.

## Edge / Error Paths

- **No active gateway:** customer top-up (UC-01) returns 400; must use manual transfer.
- **Invalid credentials:** payments fail at Duitku; admin sees gateway errors in confirmations/audit.
- **Multiple gateways:** only one active config resolved; document the selection rule.

## Backend / API Surfaces

- `modules/payment/api/admin-gateway.route.ts`
- `modules/payment/services/gateway.service.ts`, `encryption.service.ts`
- `modules/payment/services/duitku.service.ts` — `getActiveConfig()`

## Console Surface

- None (admin-only).

## Portal Surface

- `/portal/payments` → Gateways tab; also Bank Accounts + Settings tabs.

## Done Criteria

- Gateway stored encrypted; active gateway resolved at runtime; top-up money path functional.

## Client-Facing Notes

Internal admin operation. Credentials are encrypted at rest; never expose API keys in UI responses.

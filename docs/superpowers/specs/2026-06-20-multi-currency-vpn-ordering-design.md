# Multi-Currency VPN Ordering

## Problem

VPN packages can be priced in USD or IDR. Billing accounts have a currency (default IDR). When an IDR customer orders a USD package, `VpnSubscriptionService.purchase()` charges `pkg.currency` directly — no conversion. This causes a currency mismatch failure in `debitServiceBalance()`.

The legacy route (`POST /api/vpn/subscriptions`) uses a hardcoded `IDR_USD_FIXED_RATE = 16000` instead of the `PaymentCurrency` table rates.

## Goal

Enable cross-currency VPN package purchases. USD packages can be ordered by IDR billing accounts (and vice versa). Price is converted at purchase time using `PaymentCurrency` table rates and locked for the subscription lifecycle.

## Design Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Price locking | Lock at purchase time | Stable renewals, customer-friendly |
| Display | Converted as primary, original as reference | Customer sees what they'll pay |
| Rate source | `PaymentCurrency` table via `CurrencyService` | Admin-updatable, already seeded |
| Scope | Both new and legacy paths | Consistency |

## Data Model Changes

### `VpnSubscription` — 3 new columns

| Column | Type | Purpose |
|---|---|---|
| `originalPrice` | `Decimal(12,2)` | Package price in its original currency |
| `originalCurrency` | `String` | Package's original currency code |
| `exchangeRate` | `Decimal(18,6)` | Rate used at purchase time (audit) |

**Existing columns (unchanged):**
- `priceLocked` — holds converted amount in billing account currency
- `currency` — holds billing account currency code

**Migration:** Add 3 nullable columns. Backfill existing rows: `originalPrice = priceLocked`, `originalCurrency = currency`, `exchangeRate = 1`.

## Purchase Flow (New Path)

`VpnSubscriptionService.purchase()`:

```
1. Fetch package → pkg
2. Fetch billing account → account
3. accountCurrency = account.currency
4. If pkg.currency === accountCurrency:
     chargePrice = pkg.price
     exchangeRate = 1
5. Else:
     chargePrice = CurrencyService.convert(pkg.price, pkg.currency, accountCurrency)
     exchangeRate = fromCurrency.ratePerBase / toCurrency.ratePerBase
6. Debit: debitServiceBalance({ amount: chargePrice, currency: accountCurrency })
7. Create VpnSubscription:
     priceLocked = chargePrice
     currency = accountCurrency
     originalPrice = pkg.price
     originalCurrency = pkg.currency
     exchangeRate = exchangeRate
```

**Error handling:** If `CurrencyService.convert()` fails (currency not found, inactive), return `CURRENCY_NOT_SUPPORTED`.

**Renewal (`vpn-renewal.service.ts`):** No changes — already uses `priceLocked` and `currency`.

## Legacy Route Fix

`POST /api/vpn/subscriptions` (`vpn.route.ts`):

1. Replace hardcoded `IDR_USD_FIXED_RATE = 16000` with `CurrencyService.convert()`
2. Use `PaymentCurrency` table rates from `CurrencyService`
3. Store original price in subscription metadata for audit

The static catalog (`vpn-pricing.ts`) keeps IDR prices as base. USD conversion uses dynamic rate.

## Public DTO & UI Display

### `VpnPublicPackageDTO` additions

```typescript
{
  // existing
  price: string,
  currency: string,

  // new
  convertedPrice?: string,
  convertedCurrency?: string,
  exchangeRate?: number,
}
```

### Catalog route logic

1. Fetch user's billing account (if authenticated)
2. For each package where `pkg.currency !== account.currency`:
   - Compute `convertedPrice` via `CurrencyService.convert()`
   - Include `convertedCurrency` and `exchangeRate`
3. If same currency or no billing account: `convertedPrice` is null

### UI (`vpn-packages.tsx`)

- Primary: `convertedPrice ?? price` with `convertedCurrency ?? currency`
- Secondary (smaller): if converted, show `"(≈ $0.50 USD)"` as reference
- Error: if conversion fails, show original price with warning

## Testing Strategy

### Unit tests

- `VpnSubscriptionService.purchase()`: same-currency (no conversion), cross-currency (USD→IDR), unsupported currency error
- `resolveVpnMonthlyPrice()`: dynamic rate from `PaymentCurrency` table
- Conversion edge cases: zero price, small amounts (0.50 USD), rounding

### Integration tests

- Full flow: create USD package → create IDR billing account → purchase → verify `priceLocked` is IDR, `originalPrice` is USD, `exchangeRate` matches

### Manual verification

- VPN packages page shows converted price for IDR users
- Purchase succeeds for cross-currency packages
- Renewal charges correct converted amount

## Files to Modify

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add 3 columns to `VpnSubscription` |
| `prisma/migrations/` | New migration |
| `modules/vpn/subscriptions/vpn-subscription.service.ts` | Add conversion logic in `purchase()` |
| `modules/vpn/subscriptions/vpn-subscription.dto.ts` | Add `originalPrice`, `originalCurrency`, `exchangeRate` |
| `modules/vpn/subscriptions/api/vpn-packages-catalog.route.ts` | Add `convertedPrice` computation |
| `modules/vpn/subscriptions/vpn-package-public.dto.ts` | Add converted fields |
| `modules/vpn/api/vpn.route.ts` | Replace hardcoded rate with `CurrencyService` |
| `modules/vpn/billing/vpn-pricing.ts` | Accept `CurrencyService` or use dynamic rate |
| `app/[lang]/console/vpn/_components/vpn-packages.tsx` | Display converted price as primary |
| Tests: `vpn-subscription.service.test.ts` | Cross-currency purchase tests |
| Tests: `vpn-pricing.test.ts` | Dynamic rate tests |

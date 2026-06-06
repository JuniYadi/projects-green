import { Prisma } from "@prisma/client"

// ─── Static catalog (MVP) ──────────────────────────────────────────────
//
// VPN pricing is intentionally in-code for the sellable MVP because:
//   1) There is no mature `modules/vpn` pricing service yet.
//   2) Only Indonesia is provisioned in MVP (per use-case H).
//   3) Pricing is small and stable — moving to DB is a later task
//      and is out of scope for the monthly billing gate.
//
// Amounts are in the smallest unit of the catalog currency (IDR has no
// minor unit; USD is stored at 4 decimal places to match Prisma's
// Decimal(10,4) precision used elsewhere in billing).

export const IDR_USD_FIXED_RATE = new Prisma.Decimal("16000")

type PlanCode = "STANDARD" | "PROFESSIONAL"
type RegionCode = "INDONESIA"

const CATALOG: Record<RegionCode, Record<PlanCode, Prisma.Decimal>> = {
  INDONESIA: {
    STANDARD: new Prisma.Decimal("25000"),
    PROFESSIONAL: new Prisma.Decimal("50000"),
  },
}

export type VpnResolvedPrice = {
  amount: Prisma.Decimal
  currency: "IDR" | "USD"
}

export class VpnPriceNotConfiguredError extends Error {
  constructor(
    public readonly regionCode: string,
    public readonly planCode: string,
  ) {
    super(
      `VPN price not configured for region=${regionCode} plan=${planCode}`,
    )
    this.name = "VpnPriceNotConfiguredError"
  }
}

export type ResolveVpnMonthlyPriceInput = {
  regionCode: string
  planCode: string
  /**
   * Account currency. Defaults to IDR for backward compatibility.
   * When USD, the IDR amount is converted using a fixed FX rate.
   */
  currency?: "IDR" | "USD"
}

/**
 * Resolve the monthly VPN price for a (region, plan) combination.
 * Throws `VpnPriceNotConfiguredError` when the combination is missing
 * from the catalog so the route layer can surface a 422 to the UI.
 */
export function resolveVpnMonthlyPrice(
  input: ResolveVpnMonthlyPriceInput,
): VpnResolvedPrice {
  const region = CATALOG[input.regionCode as RegionCode]
  if (!region) {
    throw new VpnPriceNotConfiguredError(input.regionCode, input.planCode)
  }
  const idrAmount = region[input.planCode as PlanCode]
  if (!idrAmount) {
    throw new VpnPriceNotConfiguredError(input.regionCode, input.planCode)
  }

  if (input.currency === "USD") {
    return {
      amount: idrAmount.div(IDR_USD_FIXED_RATE),
      currency: "USD",
    }
  }
  return { amount: idrAmount, currency: "IDR" }
}

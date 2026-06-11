import type { Prisma } from "@prisma/client"

/**
 * DTO — stable client contract for a billing currency. Decimals are serialized
 * to numbers/strings at the boundary so the client never deals with Prisma's
 * Decimal instances.
 */
export type CurrencyDTO = {
  id: string
  code: string
  name: string
  symbol: string
  isBase: boolean
  /** Units of this currency per 1 unit of the base currency. */
  ratePerBase: number
  minTopup: number
  maxTopup: number
  isActive: boolean
  sortOrder: number
}

type CurrencyRecord = Prisma.PaymentCurrencyGetPayload<object>

export function toCurrencyDTO(currency: CurrencyRecord): CurrencyDTO {
  return {
    id: currency.id,
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
    isBase: currency.isBase,
    ratePerBase: currency.ratePerBase.toNumber(),
    minTopup: currency.minTopup.toNumber(),
    maxTopup: currency.maxTopup.toNumber(),
    isActive: currency.isActive,
    sortOrder: currency.sortOrder,
  }
}

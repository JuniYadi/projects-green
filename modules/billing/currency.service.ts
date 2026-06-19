import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { toCurrencyDTO, type CurrencyDTO } from "./currency.dto"

type CurrencyRecord = Prisma.PaymentCurrencyGetPayload<object>
type CurrencyDb = typeof prisma

export class CurrencyNotFoundError extends Error {
  constructor(code: string) {
    super(`Currency not found: ${code}`)
    this.name = "CurrencyNotFoundError"
  }
}

export class BaseCurrencyMissingError extends Error {
  constructor() {
    super("No base currency configured")
    this.name = "BaseCurrencyMissingError"
  }
}

/**
 * Single source of truth for currency conversion. Prices are authored in the
 * base currency (USD); every other currency is derived via `ratePerBase`
 * (units of that currency per 1 base unit). All arithmetic uses Decimal to
 * avoid floating-point drift in a financial context.
 */
export class CurrencyService {
  private db: CurrencyDb

  constructor(client?: CurrencyDb) {
    this.db = client ?? prisma
  }

  async list(includeInactive = false): Promise<CurrencyRecord[]> {
    const where: Prisma.PaymentCurrencyWhereInput = includeInactive
      ? {}
      : { isActive: true }
    return this.db.paymentCurrency.findMany({
      where,
      orderBy: [{ isBase: "desc" }, { sortOrder: "asc" }, { code: "asc" }],
    })
  }

  async listDTO(includeInactive = false): Promise<CurrencyDTO[]> {
    const currencies = await this.list(includeInactive)
    return currencies.map(toCurrencyDTO)
  }

  async findByCode(code: string): Promise<CurrencyRecord | null> {
    return this.db.paymentCurrency.findUnique({ where: { code } })
  }

  async getByCode(code: string): Promise<CurrencyRecord> {
    const currency = await this.findByCode(code)
    if (!currency) throw new CurrencyNotFoundError(code)
    return currency
  }

  async getBase(): Promise<CurrencyRecord> {
    const base = await this.db.paymentCurrency.findFirst({
      where: { isBase: true },
    })
    if (!base) throw new BaseCurrencyMissingError()
    return base
  }

  /** Rate = units of `code` per 1 base unit. */
  async getRate(code: string): Promise<Prisma.Decimal> {
    const currency = await this.getByCode(code)
    return currency.ratePerBase
  }

  /**
   * Convert an amount between two currencies via the base currency.
   * `amount` is expressed in `from`; the result is expressed in `to`.
   */
  async convert(
    amount: Prisma.Decimal | number,
    from: string,
    to: string
  ): Promise<Prisma.Decimal> {
    const value =
      amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount)
    if (from === to) return value

    const [fromCurrency, toCurrency] = await Promise.all([
      this.getByCode(from),
      this.getByCode(to),
    ])

    // amount_to = amount_from / rate(from) * rate(to)
    return value.div(fromCurrency.ratePerBase).mul(toCurrency.ratePerBase)
  }

  /** Convert an amount expressed in `code` into the base currency. */
  async toBase(
    amount: Prisma.Decimal | number,
    code: string
  ): Promise<Prisma.Decimal> {
    const value =
      amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount)
    const currency = await this.getByCode(code)
    return value.div(currency.ratePerBase)
  }

  /** Convert an amount expressed in the base currency into `code`. */
  async fromBase(
    amount: Prisma.Decimal | number,
    code: string
  ): Promise<Prisma.Decimal> {
    const value =
      amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount)
    const currency = await this.getByCode(code)
    return value.mul(currency.ratePerBase)
  }

  async create(input: {
    code: string
    name: string
    symbol: string
    isBase?: boolean
    ratePerBase: number
    minTopup: number
    maxTopup: number
    sortOrder?: number
  }): Promise<CurrencyRecord> {
    const isBase = input.isBase ?? false
    return this.db.$transaction(async (tx) => {
      if (isBase) {
        await tx.paymentCurrency.updateMany({
          where: { isBase: true },
          data: { isBase: false },
        })
      }
      return tx.paymentCurrency.create({
        data: {
          code: input.code.toUpperCase(),
          name: input.name,
          symbol: input.symbol,
          isBase,
          // Base currency always has a rate of exactly 1 against itself.
          ratePerBase: isBase
            ? new Prisma.Decimal(1)
            : new Prisma.Decimal(input.ratePerBase),
          minTopup: new Prisma.Decimal(input.minTopup),
          maxTopup: new Prisma.Decimal(input.maxTopup),
          sortOrder: input.sortOrder ?? 0,
        },
      })
    })
  }

  async update(
    id: string,
    input: {
      name?: string
      symbol?: string
      isBase?: boolean
      ratePerBase?: number
      minTopup?: number
      maxTopup?: number
      isActive?: boolean
      sortOrder?: number
    }
  ): Promise<CurrencyRecord> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.paymentCurrency.findUnique({ where: { id } })
      if (!existing) throw new CurrencyNotFoundError(id)

      const promotingToBase = input.isBase === true && !existing.isBase
      if (promotingToBase) {
        await tx.paymentCurrency.updateMany({
          where: { isBase: true, id: { not: id } },
          data: { isBase: false },
        })
      }

      const data: Prisma.PaymentCurrencyUpdateInput = {}
      if (input.name !== undefined) data.name = input.name
      if (input.symbol !== undefined) data.symbol = input.symbol
      if (input.isBase !== undefined) data.isBase = input.isBase
      if (input.isActive !== undefined) data.isActive = input.isActive
      if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder
      if (input.minTopup !== undefined)
        data.minTopup = new Prisma.Decimal(input.minTopup)
      if (input.maxTopup !== undefined)
        data.maxTopup = new Prisma.Decimal(input.maxTopup)

      // The base currency is pinned to a rate of 1; ignore rate edits on it.
      const willBeBase = input.isBase ?? existing.isBase
      if (willBeBase) {
        data.ratePerBase = new Prisma.Decimal(1)
      } else if (input.ratePerBase !== undefined) {
        data.ratePerBase = new Prisma.Decimal(input.ratePerBase)
      }

      return tx.paymentCurrency.update({ where: { id }, data })
    })
  }

  async toggle(id: string): Promise<CurrencyRecord> {
    const existing = await this.db.paymentCurrency.findUnique({ where: { id } })
    if (!existing) throw new CurrencyNotFoundError(id)
    return this.db.paymentCurrency.update({
      where: { id },
      data: { isActive: !existing.isActive },
    })
  }
}

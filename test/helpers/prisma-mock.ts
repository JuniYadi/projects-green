/**
 * Shared Prisma mock factory — DRY + KISS
 *
 * Usage:
 *   import { createMockPrisma } from "@/test/helpers/prisma-mock"
 *
 *   const { prisma, mock } = createMockPrisma({
 *     billingAccount: ["findUnique", "update"],
 *     billingAdjustment: ["create"],
 *   })
 *
 *   mock.module("@/lib/prisma", () => ({ prisma }))
 *
 * In tests: mock.billingAccount.findUnique.mockResolvedValue(...)
 */

import { mock } from "bun:test"

// ── Types ──────────────────────────────────────────────

type ModelMethod = Record<string, ReturnType<typeof mock> | ((...args: unknown[]) => unknown)>
type ModelConfig = Record<string, string[]>

// ── Simple Decimal polyfill for test fixtures ──────────
// Avoids importing @prisma/client just for Prisma.Decimal
export class TestDecimal {
  #value: number

  constructor(value: number | string | TestDecimal) {
    this.#value =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseFloat(value)
          : value.#value
  }

  toString() {
    return this.#value.toFixed(2)
  }

  toNumber() {
    return this.#value
  }

  toFixed(digits?: number) {
    return this.#value.toFixed(digits)
  }

  // Prisma Decimal.js-compatible duck typing
  toJSON() {
    return this.#value
  }

  get s() {
    return Math.sign(this.#value)
  }

  get e() {
    return this.#value === 0 ? 0 : Math.floor(Math.log10(Math.abs(this.#value)))
  }

  get c() {
    return Array.from(String(Math.abs(this.#value)).replace(".", ""), Number)
  }

  plus(value: number | string | TestDecimal) {
    const other = value instanceof TestDecimal ? value.#value : Number(value)
    return new TestDecimal(this.#value + other)
  }

  minus(value: number | string | TestDecimal) {
    const other = value instanceof TestDecimal ? value.#value : Number(value)
    return new TestDecimal(this.#value - other)
  }

  gt(value: number | string | TestDecimal) {
    const other = value instanceof TestDecimal ? value.#value : Number(value)
    return this.#value > other
  }

  gte(value: number | string | TestDecimal) {
    const other = value instanceof TestDecimal ? value.#value : Number(value)
    return this.#value >= other
  }

  lt(value: number | string | TestDecimal) {
    const other = value instanceof TestDecimal ? value.#value : Number(value)
    return this.#value < other
  }

  lte(value: number | string | TestDecimal) {
    const other = value instanceof TestDecimal ? value.#value : Number(value)
    return this.#value <= other
  }

  // Prisma Decimal (decimal.js) aliases
  add(value: number | string | TestDecimal) {
    return this.plus(value)
  }

  sub(value: number | string | TestDecimal) {
    return this.minus(value)
  }
}

// ── Factory ─────────────────────────────────────────────

export type MockModelMethods = {
  [K in keyof ModelMethod]: ReturnType<typeof mock>
}

export type MockPrismaResult = {
  prisma: {
    [model: string]: {
      [method: string]: ReturnType<typeof mock>
    }
  }
  /** Shortcut map: mock.billingAccount.findUnique etc. */
  mock: { [model: string]: { [method: string]: ReturnType<typeof mock> } }
}

/**
 * Create a mock Prisma client with methods for the specified models.
 *
 * @example
 *   const { prisma, mock } = createMockPrisma({
 *     billingAccount: ["findUnique", "update"],
 *     billingAdjustment: ["create"],
 *   })
 *   mock.billingAccount.findUnique.mockResolvedValue(someAccount)
 *   mock.module("@/lib/prisma", () => ({ prisma }))
 */
export function createMockPrisma(
  modelMethods: Record<string, string[]>,
): MockPrismaResult {
  const mocks: Record<string, Record<string, ReturnType<typeof mock>>> = {}
  const prisma: Record<string, Record<string, ReturnType<typeof mock>>> = {}

  for (const [model, methods] of Object.entries(modelMethods)) {
    const modelMocks: Record<string, ReturnType<typeof mock>> = {}
    const modelPrisma: Record<string, ReturnType<typeof mock>> = {}

    for (const method of methods) {
      const fn = mock()
      modelMocks[method] = fn
      modelPrisma[method] = fn
    }

    mocks[model] = modelMocks
    prisma[model] = modelPrisma
  }

  return { prisma, mock: mocks }
}

/**
 * Shortcut for the common billing pattern.
 * Creates a prisma mock with:
 *   - billingAccount: findUnique, update
 *   - billingAdjustment: create
 *   - $transaction
 */
export function createBillingMockPrisma() {
  const { prisma, mock: m } = createMockPrisma({
    billingAccount: ["findUnique", "update"],
    billingAdjustment: ["create"],
  })

  const $transaction = mock()

  return {
    prisma: {
      ...prisma,
      $transaction,
    },
    mock: {
      ...m,
      $transaction,
    },
  }
}

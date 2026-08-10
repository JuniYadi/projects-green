export type AddonPriceCell = {
  billingPeriod: string
  currency: string
}

type AddonPrice = {
  billingPeriod: string
  currency: string
  amount?: string | number | null
  isActive?: boolean
}

export function isValidAddonPriceAmount(
  amount: string | number | null | undefined
): boolean {
  return (
    amount !== null &&
    amount !== undefined &&
    String(amount).trim() !== "" &&
    Number(amount) > 0
  )
}

export function getMissingAddonPriceCells(
  prices: AddonPrice[],
  enabledBillingPeriods: readonly string[],
  currencies: readonly string[] = [
    ...new Set(prices.map((price) => price.currency)),
  ]
): AddonPriceCell[] {
  return enabledBillingPeriods.flatMap((billingPeriod) =>
    currencies.flatMap((currency) => {
      const price = prices.find(
        (candidate) =>
          candidate.billingPeriod === billingPeriod &&
          candidate.currency === currency
      )
      const filled =
        price?.isActive !== false && isValidAddonPriceAmount(price?.amount)

      return filled ? [] : [{ billingPeriod, currency }]
    })
  )
}

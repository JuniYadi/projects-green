export function formatBillingMoney(
  amount: number | string,
  currency: string
): string {
  const num = typeof amount === "number" ? amount : Number(amount)
  const safe = Number.isFinite(num) ? num : 0
  const locale = currency === "USD" ? "en-US" : "id-ID"

  return `${currency} ${safe.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export class VoucherNotFoundError extends Error {
  readonly code = "VOUCHER_NOT_FOUND"
  constructor(idOrCode: string) {
    super(`Voucher not found: ${idOrCode}`)
    this.name = "VoucherNotFoundError"
  }
}

export class VoucherExpiredError extends Error {
  readonly code = "VOUCHER_EXPIRED"
  constructor(code: string) {
    super(`Voucher has expired: ${code}`)
    this.name = "VoucherExpiredError"
  }
}

export class VoucherDepletedError extends Error {
  readonly code = "VOUCHER_DEPLETED"
  constructor(code: string) {
    super(`Voucher has reached maximum claims: ${code}`)
    this.name = "VoucherDepletedError"
  }
}

export class VoucherDisabledError extends Error {
  readonly code = "VOUCHER_DISABLED"
  constructor(code: string) {
    super(`Voucher is disabled: ${code}`)
    this.name = "VoucherDisabledError"
  }
}

export class VoucherAlreadyClaimedError extends Error {
  readonly code = "VOUCHER_ALREADY_CLAIMED"
  constructor(voucherCode: string, workosUserId: string) {
    super(`Voucher ${voucherCode} already claimed by user ${workosUserId}`)
    this.name = "VoucherAlreadyClaimedError"
  }
}

export class VoucherTargetUserMismatchError extends Error {
  readonly code = "VOUCHER_TARGET_USER_MISMATCH"
  constructor(voucherCode: string) {
    super(`Voucher ${voucherCode} is not valid for this user`)
    this.name = "VoucherTargetUserMismatchError"
  }
}

export class VoucherTargetOrgMismatchError extends Error {
  readonly code = "VOUCHER_TARGET_ORG_MISMATCH"
  constructor(voucherCode: string) {
    super(`Voucher ${voucherCode} is not valid for this organization`)
    this.name = "VoucherTargetOrgMismatchError"
  }
}

export class BillingCurrencyMismatchError extends Error {
  readonly code = "BILLING_CURRENCY_MISMATCH"
  constructor(voucherCurrency: string, accountCurrency: string) {
    super(
      `Voucher currency (${voucherCurrency}) does not match your billing account currency (${accountCurrency}).`
    )
    this.name = "BillingCurrencyMismatchError"
  }
}

export class VoucherCollisionRetryExhaustedError extends Error {
  readonly code = "VOUCHER_COLLISION_RETRY_EXHAUSTED"
  constructor() {
    super("Failed to generate a unique voucher code after maximum retries")
    this.name = "VoucherCollisionRetryExhaustedError"
  }
}
export class VoucherCodeAlreadyExistsError extends Error {
  readonly code = "VOUCHER_CODE_ALREADY_EXISTS"
  constructor(code: string) {
    super(`Voucher code already exists: ${code}`)
    this.name = "VoucherCodeAlreadyExistsError"
  }
}

// ─── Promotion domain errors ──────────────────────────────────────────────────

export class VoucherNotPublishableError extends Error {
  readonly code = "VOUCHER_NOT_PUBLISHABLE"
  constructor(voucherCode: string, reason: string) {
    super(`Voucher ${voucherCode} cannot be published: ${reason}`)
    this.name = "VoucherNotPublishableError"
  }
}

export class VoucherAlreadyDisabledError extends Error {
  readonly code = "VOUCHER_ALREADY_DISABLED"
  constructor(voucherCode: string) {
    super(`Voucher ${voucherCode} is already disabled`)
    this.name = "VoucherAlreadyDisabledError"
  }
}

export class VoucherAlreadyPublishedError extends Error {
  readonly code = "VOUCHER_ALREADY_PUBLISHED"
  constructor(voucherCode: string) {
    super(`Voucher ${voucherCode} is already published (ACTIVE)`)
    this.name = "VoucherAlreadyPublishedError"
  }
}

export class VoucherNotAPromotionError extends Error {
  readonly code = "VOUCHER_NOT_A_PROMOTION"
  constructor(voucherCode: string) {
    super(`Voucher ${voucherCode} is not a PRODUCT_PROMOTION voucher`)
    this.name = "VoucherNotAPromotionError"
  }
}

export class VoucherDiscountConfigurationError extends Error {
  readonly code = "VOUCHER_DISCOUNT_CONFIG_ERROR"
  constructor(message: string) {
    super(message)
    this.name = "VoucherDiscountConfigurationError"
  }
}

export class VoucherKindFieldMismatchError extends Error {
  readonly code = "VOUCHER_KIND_FIELD_MISMATCH"
  readonly invalidFields: string[]
  constructor(kind: string, invalidFields: string[]) {
    super(
      `Fields [${invalidFields.join(", ")}] are not applicable to a ${kind} voucher.`
    )
    this.name = "VoucherKindFieldMismatchError"
    this.invalidFields = invalidFields
  }
}

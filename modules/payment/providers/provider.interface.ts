/**
 * Configuration field definition for a payment gateway provider.
 * Used to dynamically render the gateway setup form in the UI.
 */
export interface ConfigFieldDef {
  /** Unique key for this field (used as the form input name). */
  key: string
  /** Input type for the UI form. */
  type: "string" | "password" | "url" | "select" | "number"
  /** Human-readable label. */
  label: string
  /** Placeholder text for the input. */
  placeholder?: string
  /** Whether this field is required. */
  required: boolean
  /** Default value if not specified. */
  defaultValue?: string
  /** Options for "select" type fields. */
  options?: { label: string; value: string }[]
}

/**
 * Result returned by a provider after initiating a payment.
 */
export interface PaymentResult {
  /** Where to redirect the user (for redirect-based gateways like PayPal). */
  redirectUrl?: string
  /** Payment URL for embedded/QRIS payment pages. */
  paymentUrl?: string
  /** Virtual account number (for VA-based gateways like Duitku). */
  vaNumber?: string
  /** Provider reference / transaction ID. */
  reference: string
}

/**
 * Request parameters for creating a payment.
 */
export interface PaymentRequest {
  invoiceId: string
  amount: number
  currency: string
  email: string
  customerName: string
  productDetails: string
  /** Provider-specific payment method code (e.g. "VC", "QR", "paypal"). */
  paymentMethod: string
  /** Callback/webhook URL the provider should notify on completion. */
  callbackUrl: string
  /** Return URL the user is sent to after payment. */
  returnUrl: string
}

/**
 * Contract every payment gateway provider must implement.
 */
export interface PaymentProvider {
  /** Unique identifier (e.g. "duitku", "paypal", "stripe"). */
  id: string
  /** Human-readable display name (e.g. "Duitku", "PayPal"). */
  name: string
  /** ISO currency codes this provider can settle (e.g. ["IDR"], ["USD"], or both). */
  supportedCurrencies: string[]
  /** Payment method codes this provider offers (e.g. ["VA", "QR", "REDIRECT"]). */
  paymentMethods: string[]
  /** Configuration field definitions for the UI setup form. */
  configFields: ConfigFieldDef[]

  /**
   * Initiate a payment with this provider.
   * @returns PaymentResult with URLs / reference for the next step.
   */
  createPayment(
    request: PaymentRequest,
    config: Record<string, string>
  ): Promise<PaymentResult>

  /**
   * Verify an incoming webhook/callback signature from this provider.
   * @returns true if the payload is authentic.
   */
  verifyCallback?(
    payload: Record<string, unknown>,
    config: Record<string, string>
  ): Promise<boolean>
}

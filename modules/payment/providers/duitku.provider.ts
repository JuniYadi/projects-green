import crypto from "crypto"
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  ConfigFieldDef,
  CheckoutMode,
  WebhookResult,
} from "./provider.interface"
import type {
  DuitkuInquiryRequest,
  DuitkuInquiryResponse,
} from "../types/payment.types"

export const DUITKU_ENDPOINTS = {
  sandbox: {
    pop: "https://api-sandbox.duitku.com/api/merchant/createInvoice",
    legacy: "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry",
    script: "https://app-sandbox.duitku.com/lib/js/duitku.js",
  },
  production: {
    pop: "https://api-prod.duitku.com/api/merchant/createInvoice",
    legacy: "https://passport.duitku.com/webapi/api/merchant/v2/inquiry",
    script: "https://app-prod.duitku.com/lib/js/duitku.js",
  },
} as const

export function resolveIsSandbox(config: Record<string, string>): boolean {
  if (config.environment) {
    return config.environment.toLowerCase() === "sandbox"
  }
  if (config.merchantCode?.toUpperCase().startsWith("DS")) {
    return true
  }
  if (process.env.DUITKU_SANDBOX === "true") {
    return true
  }
  if (config.sandboxUrl && !config.productionUrl) {
    return true
  }
  return false
}

const CONFIG_FIELDS: ConfigFieldDef[] = [
  {
    key: "merchantCode",
    type: "string",
    label: "Merchant Code",
    placeholder: "e.g. DS35800 or M12345",
    required: true,
  },
  {
    key: "apiKey",
    type: "password",
    label: "API Key",
    placeholder: "Your Duitku API key",
    required: true,
  },
  {
    key: "environment",
    type: "select",
    label: "Environment",
    required: true,
    defaultValue: "sandbox",
    options: [
      {
        label: "Sandbox (Testing)",
        value: "sandbox",
      },
      {
        label: "Production (Live)",
        value: "production",
      },
    ],
  },
  {
    key: "checkoutMode",
    type: "select",
    label: "Checkout Mode",
    required: true,
    defaultValue: "POP",
    options: [
      {
        label: "Duitku POP (In-Page Modal Popup)",
        value: "POP",
      },
      {
        label: "Window Redirection (Full-Page Redirect)",
        value: "REDIRECT",
      },
    ],
  },
]

export const duitkuProvider: PaymentProvider = {
  id: "duitku",
  name: "Duitku",
  supportedCurrencies: ["IDR"],
  paymentMethods: ["VC", "QR", "VA", "QRIS"],
  configFields: CONFIG_FIELDS,

  async createPayment(
    request: PaymentRequest,
    config: Record<string, string>
  ): Promise<PaymentResult> {
    const isSandbox = resolveIsSandbox(config)
    const endpoints = isSandbox
      ? DUITKU_ENDPOINTS.sandbox
      : DUITKU_ENDPOINTS.production

    const merchantCode = config.merchantCode || ""
    const apiKey = config.apiKey || ""

    if (!merchantCode || !apiKey) {
      throw new Error(
        "Duitku gateway not configured: missing merchantCode or apiKey"
      )
    }

    // Determine checkout mode (defaults to modern POP)
    const checkoutMode: CheckoutMode =
      request.checkoutMode || (config.checkoutMode as CheckoutMode) || "POP"

    let requestUrl: string
    let headers: Record<string, string>
    let bodyJson: Record<string, unknown>

    if (checkoutMode === "REDIRECT") {
      // Legacy Duitku direct inquiry v2 flow
      const customUrl = isSandbox ? config.sandboxUrl : config.productionUrl
      if (customUrl) {
        const clean = customUrl.replace(/\/+$/, "")
        requestUrl = clean.includes("/merchant/v2/inquiry")
          ? clean
          : `${clean}/merchant/v2/inquiry`
      } else {
        requestUrl = endpoints.legacy
      }

      const legacySig = generateLegacySignature(
        merchantCode,
        request.invoiceId,
        request.amount,
        apiKey
      )

      const body: DuitkuInquiryRequest = {
        merchantCode,
        paymentAmount: request.amount,
        merchantOrderId: request.invoiceId,
        productDetails: request.productDetails,
        email: request.email,
        paymentMethod: request.paymentMethod,
        customerVaName: request.customerName,
        returnUrl: request.returnUrl,
        callbackUrl: request.callbackUrl,
        signature: legacySig,
      }

      headers = { "Content-Type": "application/json" }
      bodyJson = body as unknown as Record<string, unknown>
    } else {
      // Modern Duitku POP / Create Invoice flow
      requestUrl = endpoints.pop

      const timestamp = Date.now().toString()
      const popSignature = generatePopSignature(merchantCode, timestamp, apiKey)

      headers = {
        "Content-Type": "application/json",
        "x-duitku-signature": popSignature,
        "x-duitku-timestamp": timestamp,
        "x-duitku-merchantcode": merchantCode,
      }

      // For POP, VA should not be passed as "VC" (Credit Card); empty string allows choosing any channel
      const effectivePaymentMethod =
        request.paymentMethod === "VA" || request.paymentMethod === "VC"
          ? ""
          : request.paymentMethod || ""

      bodyJson = {
        paymentAmount: request.amount,
        merchantOrderId: request.invoiceId,
        productDetails: request.productDetails,
        email: request.email,
        phoneNumber: "",
        additionalParam: "",
        merchantUserInfo: "",
        customerVaName: request.customerName,
        callbackUrl: request.callbackUrl,
        returnUrl: request.returnUrl,
        expiryPeriod: 1440,
        paymentMethod: effectivePaymentMethod,
      }
    }

    const response = await fetch(requestUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyJson),
    })

    if (!response.ok) {
      const errorText =
        typeof response.text === "function"
          ? await response.text().catch(() => "")
          : ""
      throw new Error(
        `Duitku API error: ${response.status}${errorText ? ` - ${errorText}` : ""}`
      )
    }

    const result = (await response.json()) as DuitkuInquiryResponse

    if (result.statusCode !== "00") {
      throw new Error(`Duitku error: ${result.statusMessage}`)
    }

    const clientScriptUrl = endpoints.script

    return {
      mode: checkoutMode,
      paymentUrl: result.paymentUrl || "",
      redirectUrl: result.paymentUrl || "",
      vaNumber: result.vaNumber,
      reference: result.reference || request.invoiceId,
      clientScriptUrl: checkoutMode === "POP" ? clientScriptUrl : undefined,
      statusCode: result.statusCode,
      statusMessage: result.statusMessage,
    }
  },

  async verifyCallback(
    payload: Record<string, unknown>,
    config: Record<string, string>
  ): Promise<boolean> {
    const apiKey = config.apiKey || ""
    if (!apiKey) {
      throw new Error("Duitku gateway not configured: missing apiKey")
    }

    const merchantCode = String(payload.merchantCode || "")
    const amount = String(payload.amount || "")
    const merchantOrderId = String(payload.merchantOrderId || "")
    const signature = String(payload.signature || "")

    // Order: merchantCode + amount + merchantOrderId (per official Duitku docs)
    const stringToSign = merchantCode + amount + merchantOrderId
    const expectedSignature = crypto
      .createHmac("sha256", apiKey)
      .update(stringToSign)
      .digest("hex")

    return signature === expectedSignature
  },

  async handleWebhook(
    payload: Record<string, unknown>,
    config: Record<string, string>
  ): Promise<WebhookResult> {
    const isValid = await this.verifyCallback!(payload, config)
    const merchantOrderId = String(payload.merchantOrderId || "")
    const amount = String(payload.amount || "")
    const reference = String(payload.reference || "")
    const resultCode = String(payload.resultCode || "")

    const status: "PAID" | "PENDING" | "FAILED" =
      resultCode === "00" ? "PAID" : resultCode === "02" ? "PENDING" : "FAILED"

    return {
      isValid,
      merchantOrderId,
      amount,
      reference,
      resultCode,
      status,
      rawPayload: payload,
    }
  },
}

function generateLegacySignature(
  merchantCode: string,
  merchantOrderId: string,
  paymentAmount: number,
  apiKey: string
): string {
  const stringToSign = merchantCode + merchantOrderId + paymentAmount
  return crypto.createHmac("sha256", apiKey).update(stringToSign).digest("hex")
}

function generatePopSignature(
  merchantCode: string,
  timestamp: string,
  apiKey: string
): string {
  const stringToSign = merchantCode + timestamp
  return crypto.createHmac("sha256", apiKey).update(stringToSign).digest("hex")
}

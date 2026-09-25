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

const CONFIG_FIELDS: ConfigFieldDef[] = [
  {
    key: "merchantCode",
    type: "string",
    label: "Merchant Code",
    placeholder: "M12345",
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
  {
    key: "sandboxUrl",
    type: "url",
    label: "Sandbox URL",
    placeholder: "https://api-sandbox.duitku.com",
    required: false,
    defaultValue: "https://api-sandbox.duitku.com",
  },
  {
    key: "productionUrl",
    type: "url",
    label: "Production URL",
    placeholder: "https://api-prod.duitku.com",
    required: false,
    defaultValue: "https://api-prod.duitku.com",
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
    const isSandbox = process.env.DUITKU_SANDBOX === "true"
    const rawBaseUrl = isSandbox
      ? config.sandboxUrl || "https://api-sandbox.duitku.com"
      : config.productionUrl || "https://api-prod.duitku.com"

    const merchantCode = config.merchantCode || ""
    const apiKey = config.apiKey || ""

    if (!merchantCode || !apiKey) {
      throw new Error(
        "Duitku gateway not configured: missing merchantCode or apiKey"
      )
    }

    // Determine checkout mode
    const checkoutMode: CheckoutMode =
      request.checkoutMode ||
      (config.checkoutMode as CheckoutMode) ||
      (rawBaseUrl.includes("api-sandbox") || rawBaseUrl.includes("api-prod")
        ? "POP"
        : "REDIRECT")

    // Determine whether to use modern POP endpoint or legacy inquiry endpoint
    const isLegacyInquiry =
      checkoutMode === "REDIRECT" &&
      (rawBaseUrl.includes("/merchant/v2/inquiry") ||
        (!rawBaseUrl.includes("api-sandbox") &&
          !rawBaseUrl.includes("api-prod") &&
          !rawBaseUrl.includes("createInvoice")))

    let requestUrl: string
    let headers: Record<string, string>
    let bodyJson: Record<string, unknown>

    if (isLegacyInquiry) {
      // Legacy Duitku direct inquiry v2 flow
      const cleanBase = rawBaseUrl.replace(/\/+$/, "")
      requestUrl = cleanBase.includes("/merchant/v2/inquiry")
        ? cleanBase
        : `${cleanBase}/merchant/v2/inquiry`

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
      const cleanBase = rawBaseUrl.replace(/\/+$/, "")
      requestUrl = cleanBase.includes("createInvoice")
        ? cleanBase
        : `${cleanBase}/api/merchant/createInvoice`

      const timestamp = Date.now().toString()
      const popSignature = generatePopSignature(merchantCode, timestamp, apiKey)

      headers = {
        "Content-Type": "application/json",
        "x-duitku-signature": popSignature,
        "x-duitku-timestamp": timestamp,
        "x-duitku-merchantcode": merchantCode,
      }

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
        paymentMethod: request.paymentMethod || "",
      }
    }

    const response = await fetch(requestUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyJson),
    })

    if (!response.ok) {
      throw new Error(`Duitku API error: ${response.status}`)
    }

    const result = (await response.json()) as DuitkuInquiryResponse

    if (result.statusCode !== "00") {
      throw new Error(`Duitku error: ${result.statusMessage}`)
    }

    const clientScriptUrl = isSandbox
      ? "https://app-sandbox.duitku.com/lib/js/duitku.js"
      : "https://app-prod.duitku.com/lib/js/duitku.js"

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
      resultCode === "00" ? "PAID" : resultCode === "01" ? "PENDING" : "FAILED"

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

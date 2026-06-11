import crypto from "crypto"
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  ConfigFieldDef,
} from "./provider.interface"
import type { DuitkuInquiryRequest, DuitkuInquiryResponse } from "../types/payment.types"

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
    key: "sandboxUrl",
    type: "url",
    label: "Sandbox URL",
    placeholder: "https://sandbox.duitku.com",
    required: false,
    defaultValue: "https://sandbox.duitku.com",
  },
  {
    key: "productionUrl",
    type: "url",
    label: "Production URL",
    placeholder: "https://api.duitku.com",
    required: false,
    defaultValue: "https://api.duitku.com",
  },
]

export const duitkuProvider: PaymentProvider = {
  id: "duitku",
  name: "Duitku",
  supportedCurrencies: ["IDR"],
  paymentMethods: ["VC", "QR"],
  configFields: CONFIG_FIELDS,

  async createPayment(
    request: PaymentRequest,
    config: Record<string, string>
  ): Promise<PaymentResult> {
    const isSandbox = process.env.DUITKU_SANDBOX === "true"
    const baseUrl = config.sandboxUrl || "https://sandbox.duitku.com"
    const effectiveBaseUrl = isSandbox ? baseUrl : config.productionUrl || "https://api.duitku.com"

    const merchantCode = config.merchantCode || ""
    const apiKey = config.apiKey || ""

    if (!merchantCode || !apiKey) {
      throw new Error("Duitku gateway not configured: missing merchantCode or apiKey")
    }

    const signature = generateSignature(merchantCode, request.invoiceId, request.amount, apiKey)

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
      signature,
    }

    const response = await fetch(`${effectiveBaseUrl}/merchant/v2/inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Duitku API error: ${response.status}`)
    }

    const result = (await response.json()) as DuitkuInquiryResponse

    if (result.statusCode !== "00") {
      throw new Error(`Duitku error: ${result.statusMessage}`)
    }

    return {
      paymentUrl: result.paymentUrl || "",
      vaNumber: result.vaNumber,
      reference: result.reference || request.invoiceId,
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

    // Order: merchantCode + amount + merchantOrderId (differs from request signing)
    const stringToSign = merchantCode + amount + merchantOrderId
    const expectedSignature = crypto
      .createHmac("sha256", apiKey)
      .update(stringToSign)
      .digest("hex")

    return signature === expectedSignature
  },
}

function generateSignature(
  merchantCode: string,
  merchantOrderId: string,
  paymentAmount: number,
  apiKey: string
): string {
  const stringToSign = merchantCode + merchantOrderId + paymentAmount
  return crypto
    .createHmac("sha256", apiKey)
    .update(stringToSign)
    .digest("hex")
}

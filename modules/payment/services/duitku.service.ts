import crypto from "crypto"
import { GatewayService } from "./gateway.service"
import type {
  DuitkuConfig,
  DuitkuInquiryRequest,
  DuitkuInquiryResponse,
} from "../types/payment.types"

export class DuitkuService {
  private gatewayService: GatewayService

  constructor() {
    this.gatewayService = new GatewayService()
  }

  async createPayment(input: {
    invoiceId: string
    amount: number
    email: string
    customerName: string
    productDetails: string
    paymentMethod: "VC" | "QR"
  }): Promise<{ paymentUrl: string; vaNumber?: string; reference: string }> {
    const config = await this.getActiveConfig()
    if (!config) {
      throw new Error("Duitku gateway not configured")
    }

    const isSandbox = process.env.NODE_ENV !== "production"
    const baseUrl = isSandbox ? config.sandboxUrl : config.productionUrl

    const merchantOrderId = input.invoiceId
    const signature = this.generateSignature(
      config.merchantCode,
      merchantOrderId,
      input.amount,
      config.apiKey
    )

    const request: DuitkuInquiryRequest = {
      merchantCode: config.merchantCode,
      paymentAmount: input.amount,
      merchantOrderId,
      productDetails: input.productDetails,
      email: input.email,
      paymentMethod: input.paymentMethod,
      customerVaName: input.customerName,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/console/billing/invoices/${input.invoiceId}`,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/duitku/callback`,
      signature,
    }

    const response = await fetch(`${baseUrl}/merchant/v2/inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
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
      reference: result.reference || merchantOrderId,
    }
  }

  async verifyCallback(params: {
    merchantCode: string
    amount: string
    merchantOrderId: string
    signature: string
  }): Promise<boolean> {
    const config = await this.getActiveConfig()
    if (!config) {
      throw new Error("Duitku gateway not configured")
    }

    // Order: merchantCode + amount + merchantOrderId (berbeda dengan request signing)
    const stringToSign =
      params.merchantCode + params.amount + params.merchantOrderId
    const expectedSignature = crypto
      .createHmac("sha256", config.apiKey)
      .update(stringToSign)
      .digest("hex")

    return params.signature === expectedSignature
  }

  private generateSignature(
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

  private async getActiveConfig(): Promise<DuitkuConfig | null> {
    const gateway = await this.gatewayService.findByType("GATEWAY")
    if (!gateway) return null

    return this.gatewayService.getDecryptedConfig(gateway.id)
  }
}

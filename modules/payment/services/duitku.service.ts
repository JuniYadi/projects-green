import { GatewayService } from "./gateway.service"
import { duitkuProvider } from "../providers/duitku.provider"
import type {
  PaymentRequest,
  PaymentResult,
  CheckoutMode,
} from "../providers/provider.interface"
import type { DuitkuConfig } from "../types/payment.types"

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
    paymentMethod: string
    currency?: string
    returnUrl?: string
    callbackUrl?: string
    checkoutMode?: CheckoutMode
  }): Promise<PaymentResult> {
    const config = await this.getActiveConfig()
    if (!config) {
      throw new Error("Duitku gateway not configured")
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
    const paymentRequest: PaymentRequest = {
      invoiceId: input.invoiceId,
      amount: input.amount,
      currency: input.currency || "IDR",
      email: input.email,
      customerName: input.customerName,
      productDetails: input.productDetails,
      paymentMethod: input.paymentMethod,
      returnUrl:
        input.returnUrl ||
        `${appUrl}/console/billing/invoices/${input.invoiceId}`,
      callbackUrl:
        input.callbackUrl || `${appUrl}/api/webhooks/duitku/callback`,
      checkoutMode: input.checkoutMode,
    }

    return duitkuProvider.createPayment(
      paymentRequest,
      config as unknown as Record<string, string>
    )
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

    return duitkuProvider.verifyCallback!(
      params as unknown as Record<string, unknown>,
      config as unknown as Record<string, string>
    )
  }

  private async getActiveConfig(): Promise<DuitkuConfig | null> {
    const gateway = await this.gatewayService.findByType("duitku")
    if (!gateway) return null

    return this.gatewayService.getDecryptedConfig(gateway.id)
  }
}

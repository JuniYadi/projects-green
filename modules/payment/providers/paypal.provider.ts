import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  ConfigFieldDef,
} from "./provider.interface"

const CONFIG_FIELDS: ConfigFieldDef[] = [
  {
    key: "clientId",
    type: "string",
    label: "Client ID",
    placeholder: "Your PayPal REST app Client ID",
    required: true,
  },
  {
    key: "clientSecret",
    type: "password",
    label: "Client Secret",
    placeholder: "Your PayPal REST app Secret",
    required: true,
  },
  {
    key: "environment",
    type: "select",
    label: "Environment",
    required: true,
    defaultValue: "sandbox",
    options: [
      { label: "Sandbox", value: "sandbox" },
      { label: "Production", value: "production" },
    ],
  },
  {
    key: "webhookId",
    type: "string",
    label: "Webhook ID",
    placeholder: "Webhook verification ID from PayPal dashboard",
    required: false,
  },
]

const PAYPAL_API_URLS = {
  sandbox: "https://api-m.sandbox.paypal.com",
  production: "https://api-m.paypal.com",
} as const

export const paypalProvider: PaymentProvider = {
  id: "paypal",
  name: "PayPal",
  supportedCurrencies: ["USD"],
  paymentMethods: ["REDIRECT"],
  configFields: CONFIG_FIELDS,

  async createPayment(
    request: PaymentRequest,
    config: Record<string, string>
  ): Promise<PaymentResult> {
    const clientId = config.clientId || ""
    const clientSecret = config.clientSecret || ""
    const environment = config.environment || "sandbox"

    if (!clientId || !clientSecret) {
      throw new Error(
        "PayPal gateway not configured: missing clientId or clientSecret"
      )
    }

    const baseUrl =
      PAYPAL_API_URLS[environment as keyof typeof PAYPAL_API_URLS] ||
      PAYPAL_API_URLS.sandbox

    // 1. Get access token
    const token = await getAccessToken(baseUrl, clientId, clientSecret)

    // 2. Create an order
    const order = await createOrder(baseUrl, token, request)

    // 3. Find the approval URL from the order's links
    const approveLink = order.links?.find(
      (link: { rel: string; href: string }) => link.rel === "approve"
    )?.href

    if (!approveLink) {
      throw new Error("PayPal: no approval URL returned")
    }

    return {
      redirectUrl: approveLink,
      reference: order.id,
    }
  },

  async verifyCallback(
    payload: Record<string, unknown>,
    config: Record<string, string>
  ): Promise<boolean> {
    const { webhookId, clientId, clientSecret } = config
    if (!webhookId) {
      return false
    }

    const eventType = String(payload.event_type || "")
    if (
      eventType !== "CHECKOUT.ORDER.APPROVED" &&
      eventType !== "PAYMENT.CAPTURE.COMPLETED"
    ) {
      return false
    }

    const headers =
      (payload._headers as Record<string, string> | undefined) || {}
    const authAlgo =
      config.authAlgo ||
      config["paypal-auth-algo"] ||
      headers["paypal-auth-algo"]
    const certUrl =
      config.certUrl || config["paypal-cert-url"] || headers["paypal-cert-url"]
    const transmissionId =
      config.transmissionId ||
      config["paypal-transmission-id"] ||
      headers["paypal-transmission-id"]
    const transmissionSig =
      config.transmissionSig ||
      config["paypal-transmission-sig"] ||
      headers["paypal-transmission-sig"]
    const transmissionTime =
      config.transmissionTime ||
      config["paypal-transmission-time"] ||
      headers["paypal-transmission-time"]

    if (
      !clientId ||
      !clientSecret ||
      !authAlgo ||
      !certUrl ||
      !transmissionId ||
      !transmissionSig ||
      !transmissionTime
    ) {
      return false
    }

    try {
      const environment = config.environment || "sandbox"
      const baseUrl =
        PAYPAL_API_URLS[environment as keyof typeof PAYPAL_API_URLS] ||
        PAYPAL_API_URLS.sandbox
      const accessToken = await getAccessToken(baseUrl, clientId, clientSecret)

      const response = await fetch(
        `${baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            auth_algo: authAlgo,
            cert_url: certUrl,
            transmission_id: transmissionId,
            transmission_sig: transmissionSig,
            transmission_time: transmissionTime,
            webhook_id: webhookId,
            webhook_event: payload,
          }),
        }
      )

      if (!response.ok) {
        return false
      }

      const data = (await response.json()) as { verification_status?: string }
      return data.verification_status === "SUCCESS"
    } catch {
      return false
    }
  },
}

async function getAccessToken(
  baseUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  })

  if (!response.ok) {
    throw new Error(`PayPal auth error: ${response.status}`)
  }

  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

async function createOrder(
  baseUrl: string,
  accessToken: string,
  request: PaymentRequest
): Promise<{ id: string; links: Array<{ rel: string; href: string }> }> {
  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: request.invoiceId,
          description: request.productDetails,
          amount: {
            currency_code: request.currency,
            value: request.amount.toFixed(2),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            landing_page: "LOGIN",
            user_action: "PAY_NOW",
            return_url: request.returnUrl,
            cancel_url: request.returnUrl,
          },
        },
      },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`PayPal order error ${response.status}: ${errorBody}`)
  }

  return response.json() as Promise<{
    id: string
    links: Array<{ rel: string; href: string }>
  }>
}

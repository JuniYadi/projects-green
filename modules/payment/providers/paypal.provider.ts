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
    // PayPal webhook verification uses POST to PayPal with the
    // webhook id + headers. For now, a basic stub is returned.
    // Full implementation will validate headers and call PayPal's
    // verify-webhook-signature endpoint.
    const { webhookId } = config
    if (!webhookId) {
      // If no webhook id configured, accept all callbacks (dev mode)
      return true
    }

    // Stub: real verification requires the CERT_URL header and POST to
    //   /v1/notifications/verify-webhook-signature
    // See: https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature_post
    const eventType = String(payload.event_type || "")
    if (
      eventType === "CHECKOUT.ORDER.APPROVED" ||
      eventType === "PAYMENT.CAPTURE.COMPLETED"
    ) {
      return true
    }

    return false
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

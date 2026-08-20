import WebSocket from "ws"
import * as fs from "fs"
import * as path from "path"

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

class CdpClient {
  private ws: WebSocket
  private id = 0
  private pending = new Map<number, (res: Record<string, unknown>) => void>()

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl)
  }

  async connect(): Promise<void> {
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    this.ws.on("open", () => resolve())
    this.ws.on("error", (err) => reject(err))
    this.ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg.id && this.pending.has(msg.id)) {
          const cb = this.pending.get(msg.id)!
          this.pending.delete(msg.id)
          cb(msg.result || msg)
        }
      } catch (e) {
        console.error("WS error parsing message:", e)
      }
    })
    return promise
  }

  async send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const currentId = ++this.id
    const { promise, resolve } =
      Promise.withResolvers<Record<string, unknown>>()
    this.pending.set(currentId, resolve)
    this.ws.send(JSON.stringify({ id: currentId, method, params }))
    return promise as Promise<T>
  }

  async evaluate<T = unknown>(expression: string): Promise<T> {
    const res = await this.send<{ result?: { value?: T } }>(
      "Runtime.evaluate",
      {
        expression,
        returnByValue: true,
      }
    )
    return res.result?.value as T
  }

  async waitForText(text: string, timeoutMs = 15000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const found = await this.evaluate<boolean>(`
        document.body.innerText.includes(${JSON.stringify(text)})
      `)
      if (found) return
      await delay(200)
    }
    throw new Error(`Timeout waiting for text: "${text}"`)
  }

  close() {
    this.ws.close()
  }
}

async function capture() {
  const outputDir = path.resolve(process.cwd(), "public/kb-assets/billing")
  fs.mkdirSync(outputDir, { recursive: true })

  const listRes = await fetch("http://127.0.0.1:9222/json/list")
  const tabs = (await listRes.json()) as Array<{
    type: string
    url: string
    webSocketDebuggerUrl: string
    title: string
  }>
  const pageTab = tabs.find(
    (t) => t.type === "page" && !t.url.startsWith("chrome://")
  )

  if (!pageTab) throw new Error("No page tab found on port 9222")

  console.log("Connecting CDP to:", pageTab.title)
  const client = new CdpClient(pageTab.webSocketDebuggerUrl)
  await client.connect()

  await client.send("Page.enable")
  await client.send("DOM.enable")
  await client.send("Runtime.enable")
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1360,
    height: 880,
    deviceScaleFactor: 2,
    mobile: false,
  })

  // 1. Capture ID Overview Dashboard
  const targetIdUrl = "https://pfnapp.my.id/id/console/billing"
  console.log("Navigating to:", targetIdUrl)
  await client.send("Page.navigate", { url: targetIdUrl })
  await delay(1500)
  await client.waitForText("Penagihan", 15000)
  await client.waitForText("Saldo", 15000)
  await client.waitForText("Invoice Terbaru", 15000)
  await delay(1000)

  console.log("Capturing 01-billing-overview-id.png...")
  let shot = await client.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
  })
  fs.writeFileSync(
    path.join(outputDir, "01-billing-overview-id.png"),
    Buffer.from(shot.data, "base64")
  )

  // 2. Capture Topup Modal or Page
  const topupUrl = "https://pfnapp.my.id/id/console/billing/topup"
  console.log("Navigating to:", topupUrl)
  await client.send("Page.navigate", { url: topupUrl })
  await delay(1500)
  await delay(800)

  console.log("Capturing 02-billing-topup.png...")
  shot = await client.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
  })
  fs.writeFileSync(
    path.join(outputDir, "02-billing-topup.png"),
    Buffer.from(shot.data, "base64")
  )

  // 3. Capture Invoices List Page
  const invoicesUrl = "https://pfnapp.my.id/id/console/billing/invoices"
  console.log("Navigating to:", invoicesUrl)
  await client.send("Page.navigate", { url: invoicesUrl })
  await delay(1500)
  await delay(800)

  console.log("Capturing 03-billing-invoices-list.png...")
  shot = await client.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
  })
  fs.writeFileSync(
    path.join(outputDir, "03-billing-invoices-list.png"),
    Buffer.from(shot.data, "base64")
  )

  // 4. Capture Subscriptions Page
  const subscriptionsUrl =
    "https://pfnapp.my.id/id/console/billing/subscriptions"
  console.log("Navigating to:", subscriptionsUrl)
  await client.send("Page.navigate", { url: subscriptionsUrl })
  await delay(1500)
  await delay(800)

  console.log("Capturing 04-billing-subscriptions.png...")
  shot = await client.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
  })
  fs.writeFileSync(
    path.join(outputDir, "04-billing-subscriptions.png"),
    Buffer.from(shot.data, "base64")
  )

  // 5. Navigate back to ID console billing
  console.log("Returning to:", targetIdUrl)
  await client.send("Page.navigate", { url: targetIdUrl })
  await delay(1000)

  client.close()
  console.log("Billing screenshots captured successfully!")
}

capture().catch((err) => {
  console.error("Capture failed:", err)
  process.exit(1)
})

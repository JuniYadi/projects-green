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

  async capturePage(
    url: string,
    destPath: string,
    waitMs = 1500
  ): Promise<void> {
    console.log(`Navigating to: ${url}`)
    await this.send("Page.navigate", { url })
    await delay(waitMs)
    const shot = await this.send<{ data: string }>("Page.captureScreenshot", {
      format: "png",
    })
    fs.writeFileSync(destPath, Buffer.from(shot.data, "base64"))
    console.log(`Saved screenshot to: ${destPath}`)
  }

  close() {
    this.ws.close()
  }
}

async function captureAllBilling() {
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

  const pages = [
    {
      url: "https://pfnapp.my.id/id/console/billing/services",
      file: "05-billing-services.png",
    },
    {
      url: "https://pfnapp.my.id/id/console/billing/usage",
      file: "06-billing-usage.png",
    },
    {
      url: "https://pfnapp.my.id/id/console/billing/alerts",
      file: "07-billing-alerts.png",
    },
    {
      url: "https://pfnapp.my.id/id/console/billing/transactions",
      file: "08-billing-transactions.png",
    },
    {
      url: "https://pfnapp.my.id/id/console/billing/vouchers",
      file: "09-billing-vouchers.png",
    },
    {
      url: "https://pfnapp.my.id/id/console/billing/contacts",
      file: "10-billing-contacts.png",
    },
    {
      url: "https://pfnapp.my.id/id/console/billing/settings",
      file: "11-billing-settings.png",
    },
  ]

  for (const p of pages) {
    await client.capturePage(p.url, path.join(outputDir, p.file), 2000)
  }

  client.close()
  console.log("All billing console screenshots captured successfully!")
}

captureAllBilling().catch((err) => {
  console.error("Capture failed:", err)
  process.exit(1)
})

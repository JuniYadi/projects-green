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
        const data = JSON.parse(raw.toString()) as Record<string, unknown>
        if (typeof data.id === "number" && this.pending.has(data.id)) {
          const handler = this.pending.get(data.id)!
          this.pending.delete(data.id)
          handler(data)
        }
      } catch (e) {
        console.error("WS error:", e)
      }
    })
    return promise
  }

  async send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const msgId = ++this.id
    const { promise, resolve, reject } = Promise.withResolvers<T>()
    this.pending.set(msgId, (res: Record<string, unknown>) => {
      if (res.error) reject(new Error(JSON.stringify(res.error)))
      else resolve(res.result as T)
    })
    this.ws.send(JSON.stringify({ id: msgId, method, params }))
    return promise
  }

  async evaluate<T = unknown>(expression: string): Promise<T> {
    const res = await this.send<{ result: { value: T } }>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    return res.result.value
  }

  async waitForText(text: string, timeoutMs = 15000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const found = await this.evaluate<boolean>(
        `document.body.innerText.includes(${JSON.stringify(text)})`
      )
      if (found) return
      await delay(200)
    }
    throw new Error(`Timeout waiting for text: ${text}`)
  }

  async waitForNoSkeleton(timeoutMs = 15000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const hasSkeleton = await this.evaluate<boolean>(
        `!!document.querySelector('[data-slot="skeleton"], .animate-pulse')`
      )
      if (!hasSkeleton) return
      await delay(200)
    }
  }

  async captureScreenshot(destPath: string): Promise<void> {
    const shot = await this.send<{ data: string }>("Page.captureScreenshot", {
      format: "png",
    })
    fs.writeFileSync(destPath, Buffer.from(shot.data, "base64"))
    console.log("Saved:", destPath)
  }

  close(): void {
    this.ws.close()
  }
}

async function capture() {
  const outputDir = path.resolve(
    process.cwd(),
    "public/kb-assets/whatsapp/guides"
  )
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
  if (!pageTab) throw new Error("No tab found on port 9222")

  const client = new CdpClient(pageTab.webSocketDebuggerUrl)
  await client.connect()

  await client.send("Page.enable")
  await client.send("DOM.enable")
  await client.send("Runtime.enable")
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1360,
    height: 840,
    deviceScaleFactor: 2,
    mobile: false,
  })

  // 1. Dashboard
  console.log("1. WhatsApp Dashboard")
  await client.send("Page.navigate", {
    url: "https://pfnapp.my.id/id/console/whatsapp/dashboard",
  })
  await delay(1200)
  await client.waitForNoSkeleton(10000)
  await client.captureScreenshot(
    path.join(outputDir, "01-whatsapp-dashboard.png")
  )

  // 2. Journey 1: Templates List
  console.log("2. Templates List")
  await client.send("Page.navigate", {
    url: "https://pfnapp.my.id/id/console/whatsapp/templates",
  })
  await delay(1200)
  await client.waitForNoSkeleton(10000)
  await client.captureScreenshot(
    path.join(outputDir, "02-journey1-templates-list.png")
  )

  // Click Create Template button
  console.log("3. Create Template Modal / Dialog")
  await client.evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('Buat Template') || b.textContent.includes('Create Template'));
    if (btn) btn.click();
  })()`)
  await delay(1000)
  await client.captureScreenshot(
    path.join(outputDir, "03-journey1-create-template-dialog.png")
  )

  // Close create template dialog
  await client.evaluate(`(() => {
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Batal' || b.textContent.trim() === 'Cancel');
    if (cancelBtn) cancelBtn.click();
  })()`)
  await delay(600)

  // 3. Journey 1: Send Message Page
  console.log("4. Send Message Page (Messages)")
  await client.send("Page.navigate", {
    url: "https://pfnapp.my.id/id/console/whatsapp/messages",
  })
  await delay(1500)
  await client.waitForNoSkeleton(10000)
  await client.captureScreenshot(
    path.join(outputDir, "04-journey1-send-message.png")
  )

  // 4. Journey 1: Webhook Logs (Delivery Tracking)
  console.log("5. Webhook Logs (Track delivery/read statuses)")
  await client.send("Page.navigate", {
    url: "https://pfnapp.my.id/id/console/whatsapp/webhook-logs",
  })
  await delay(1200)
  await client.waitForNoSkeleton(10000)
  await client.captureScreenshot(
    path.join(outputDir, "05-journey1-webhook-logs.png")
  )

  // 5. Journey 1: Audit Logs
  console.log("6. Audit Logs")
  await client.send("Page.navigate", {
    url: "https://pfnapp.my.id/id/console/whatsapp/audit-logs",
  })
  await delay(1200)
  await client.waitForNoSkeleton(10000)
  await client.captureScreenshot(
    path.join(outputDir, "06-journey1-audit-logs.png")
  )

  // 6. Journey 2: API Keys
  console.log("7. API Keys")
  await client.send("Page.navigate", {
    url: "https://pfnapp.my.id/id/console/whatsapp/api-keys",
  })
  await delay(1200)
  await client.waitForNoSkeleton(10000)
  await client.captureScreenshot(
    path.join(outputDir, "07-journey2-api-keys.png")
  )

  // 7. Journey 2: OpenAPI Reference
  console.log("8. OpenAPI Reference")
  await client.send("Page.navigate", {
    url: "https://pfnapp.my.id/api/openapi",
  })
  await delay(3000)
  await client.captureScreenshot(
    path.join(outputDir, "08-journey2-openapi-reference.png")
  )

  // Switch to cURL / Code Example in OpenAPI if available or capture section
  console.log("9. OpenAPI Code Example")
  await client.evaluate(`(() => {
    const el = document.querySelector('.scalar-api-reference') || document.body;
    window.scrollTo({ top: 300, behavior: 'smooth' });
  })()`)
  await delay(1000)
  await client.captureScreenshot(
    path.join(outputDir, "09-journey2-openapi-code-example.png")
  )

  // 8. Other sidebar menus: Devices, Broadcasts, Contacts, Catalogs, Usage, Ledger, Pricing
  const sidebarMenus = [
    {
      name: "10-menu-devices.png",
      url: "https://pfnapp.my.id/id/console/whatsapp/devices",
    },
    {
      name: "11-menu-broadcasts.png",
      url: "https://pfnapp.my.id/id/console/whatsapp/broadcasts",
    },
    {
      name: "12-menu-contacts.png",
      url: "https://pfnapp.my.id/id/console/whatsapp/contacts",
    },
    {
      name: "13-menu-catalogs.png",
      url: "https://pfnapp.my.id/id/console/whatsapp/catalogs",
    },
    {
      name: "14-menu-usage.png",
      url: "https://pfnapp.my.id/id/console/whatsapp/usage",
    },
    {
      name: "15-menu-ledger.png",
      url: "https://pfnapp.my.id/id/console/whatsapp/ledger",
    },
    {
      name: "16-menu-pricing.png",
      url: "https://pfnapp.my.id/id/console/whatsapp/pricing",
    },
  ]

  for (const m of sidebarMenus) {
    console.log("Capturing:", m.name, "->", m.url)
    await client.send("Page.navigate", { url: m.url })
    await delay(1200)
    await client.waitForNoSkeleton(10000)
    await client.captureScreenshot(path.join(outputDir, m.name))
  }

  client.close()
  console.log("All WhatsApp Guide screenshots captured successfully!")
}

capture().catch((err) => {
  console.error("Capture failed:", err)
  process.exit(1)
})

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
      const data = JSON.parse(raw.toString()) as Record<string, unknown>
      if (typeof data.id === "number" && this.pending.has(data.id)) {
        const handler = this.pending.get(data.id)!
        this.pending.delete(data.id)
        handler(data)
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
    this.pending.set(msgId, (response) => {
      if (
        response.error &&
        typeof response.error === "object" &&
        "message" in response.error
      ) {
        reject(new Error(String(response.error.message)))
      } else {
        resolve(response.result as T)
      }
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

  async waitForText(text: string, timeoutMs = 10000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const body = await this.evaluate<string>("document.body.innerText")
      if (body.includes(text)) return
      await delay(200)
    }
    throw new Error(`Timed out waiting for text: "${text}"`)
  }

  async waitForNoText(text: string, timeoutMs = 10000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const body = await this.evaluate<string>("document.body.innerText")
      if (!body.includes(text)) return
      await delay(200)
    }
    throw new Error(`Timed out waiting for text to disappear: "${text}"`)
  }

  close() {
    this.ws.close()
  }
}

async function capture() {
  const outputDir = path.resolve(
    process.cwd(),
    "public/kb-assets/whatsapp/api-keys"
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

  if (!pageTab) throw new Error("No page tab found on port 9222")

  console.log("Connecting CDP to:", pageTab.title)
  const client = new CdpClient(pageTab.webSocketDebuggerUrl)
  await client.connect()

  const targetUrl = "https://pfnapp.my.id/en/console/whatsapp/api-keys"
  console.log("Navigating to:", targetUrl)

  await client.send("Page.enable")
  await client.send("DOM.enable")
  await client.send("Runtime.enable")
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1360,
    height: 840,
    deviceScaleFactor: 2,
    mobile: false,
  })

  // Navigate & wait for page to render real UI
  await client.send("Page.navigate", { url: targetUrl })
  await delay(1000)
  await client.waitForNoText("Loading API key...", 15000)
  await client.waitForText("Generate API key", 10000)
  await client.waitForText("Not generated", 10000)
  await delay(600) // let animations finish

  // 1. Screenshot: Clean Initial Empty State
  console.log("Capturing 01-initial-empty-state.png...")
  let shot = await client.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
  })
  fs.writeFileSync(
    path.join(outputDir, "01-initial-empty-state.png"),
    Buffer.from(shot.data, "base64")
  )

  // 2. Click Generate API key
  console.log("Clicking 'Generate API key'...")
  await client.evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Generate API key'));
      if (btn) btn.click();
    })()
  `)

  // Wait for One-time API secret banner to render
  await client.waitForText("One-time API secret", 15000)
  await client.waitForText("Active", 10000)
  await client.waitForText("Rotate API key", 10000)
  await delay(800)

  // Screenshot: Generated API Key with One-time Secret
  console.log("Capturing 02-key-generated-with-secret.png...")
  shot = await client.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
  })
  fs.writeFileSync(
    path.join(outputDir, "02-key-generated-with-secret.png"),
    Buffer.from(shot.data, "base64")
  )

  // 3. Open Rotate modal
  console.log("Opening Rotate dialog...")
  await client.evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Rotate API key'));
      if (btn) btn.click();
    })()
  `)
  await client.waitForText("Rotate API key?", 5000)
  await delay(500)

  // Screenshot: Rotate Confirmation Dialog
  console.log("Capturing 03-rotate-key-dialog.png...")
  shot = await client.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
  })
  fs.writeFileSync(
    path.join(outputDir, "03-rotate-key-dialog.png"),
    Buffer.from(shot.data, "base64")
  )

  // Cancel Rotate dialog
  await client.evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim() === 'Cancel');
      if (btn) btn.click();
    })()
  `)
  await client.waitForNoText("Rotate API key?", 5000)
  await delay(400)

  // 4. Open Revoke modal
  console.log("Opening Revoke dialog...")
  await client.evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Revoke API key'));
      if (btn) btn.click();
    })()
  `)
  await client.waitForText("Revoke API key?", 5000)
  await delay(500)

  // Screenshot: Revoke Confirmation Dialog
  console.log("Capturing 04-revoke-key-dialog.png...")
  shot = await client.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
  })
  fs.writeFileSync(
    path.join(outputDir, "04-revoke-key-dialog.png"),
    Buffer.from(shot.data, "base64")
  )

  // Cancel Revoke dialog
  await client.evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim() === 'Cancel');
      if (btn) btn.click();
    })()
  `)
  await client.waitForNoText("Revoke API key?", 5000)
  await delay(300)

  client.close()
  console.log("High-quality, verified screenshots captured successfully!")
}

capture().catch((err) => {
  console.error("Capture failed:", err)
  process.exit(1)
})

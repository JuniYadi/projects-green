import WebSocket from "ws"
import * as fs from "fs"
import * as path from "path"

type CdpTab = {
  id: string
  title: string
  url: string
  webSocketDebuggerUrl: string
  type: string
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

class CdpClient {
  private pending = new Map<number, (res: Record<string, unknown>) => void>()
  private id = 0

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl)
  }

  private ws: WebSocket

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
  const tabs = (await listRes.json()) as CdpTab[]
  const pageTab = tabs.find(
    (t) => t.type === "page" && !t.url.startsWith("chrome://")
  )

  if (!pageTab) {
    throw new Error("No open browser page tab found on port 9222")
  }

  console.log(
    "Connecting CDP to tab:",
    pageTab.title,
    pageTab.webSocketDebuggerUrl
  )
  const client = new CdpClient(pageTab.webSocketDebuggerUrl)
  await client.connect()

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "https://pfnapp.my.id"
  const targetUrl = `${baseUrl}/en/console/whatsapp/api-keys`
  console.log("Navigating to:", targetUrl)

  await client.send("Page.enable")
  await client.send("DOM.enable")
  await client.send("Runtime.enable")
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 2,
    mobile: false,
  })

  await client.send("Page.navigate", { url: targetUrl })
  await delay(3000)

  // 1. Screenshot: Initial Empty / Not generated state
  console.log("Capturing 01-initial-empty-state.png...")
  let shot = await client.send("Page.captureScreenshot", { format: "png" })
  fs.writeFileSync(
    path.join(outputDir, "01-initial-empty-state.png"),
    Buffer.from(shot.data, "base64")
  )

  // 2. Click Generate API key
  console.log("Clicking 'Generate API key'...")
  await client.send("Runtime.evaluate", {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const genBtn = btns.find(b => b.textContent.includes('Generate API key'));
        if (genBtn) genBtn.click();
      })()
    `,
  })
  await delay(2500)

  // Screenshot: Generated API Key with One-time secret
  console.log("Capturing 02-key-generated-with-secret.png...")
  shot = await client.send("Page.captureScreenshot", { format: "png" })
  fs.writeFileSync(
    path.join(outputDir, "02-key-generated-with-secret.png"),
    Buffer.from(shot.data, "base64")
  )

  // 3. Click Rotate button
  console.log("Opening Rotate dialog...")
  await client.send("Runtime.evaluate", {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const rotBtn = btns.find(b => b.textContent.includes('Rotate API key'));
        if (rotBtn) rotBtn.click();
      })()
    `,
  })
  await delay(600)

  // Screenshot: Rotate Dialog
  console.log("Capturing 03-rotate-key-dialog.png...")
  shot = await client.send("Page.captureScreenshot", { format: "png" })
  fs.writeFileSync(
    path.join(outputDir, "03-rotate-key-dialog.png"),
    Buffer.from(shot.data, "base64")
  )

  // Cancel Rotate dialog
  await client.send("Runtime.evaluate", {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const cancelBtn = btns.find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `,
  })
  await delay(500)

  // 4. Click Revoke button
  console.log("Opening Revoke dialog...")
  await client.send("Runtime.evaluate", {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const revBtn = btns.find(b => b.textContent.includes('Revoke API key'));
        if (revBtn) revBtn.click();
      })()
    `,
  })
  await delay(600)

  // Screenshot: Revoke Dialog
  console.log("Capturing 04-revoke-key-dialog.png...")
  shot = await client.send("Page.captureScreenshot", { format: "png" })
  fs.writeFileSync(
    path.join(outputDir, "04-revoke-key-dialog.png"),
    Buffer.from(shot.data, "base64")
  )

  // Cancel Revoke dialog
  await client.send("Runtime.evaluate", {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const cancelBtn = btns.find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `,
  })
  await delay(300)

  client.close()
  console.log("Screenshots captured successfully!")
}

capture().catch((e) => {
  console.error("Failed:", e)
  process.exit(1)
})

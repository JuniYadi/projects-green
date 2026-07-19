// Kill any process listening on the given port, then poll until freed.
// Usage: bun run scripts/kill-port.ts <port>
import { $ } from "bun"

const port = process.argv[2]
if (!port) {
  console.error("Usage: kill-port.ts <port>")
  process.exit(1)
}

async function findPids(port: string): Promise<string[]> {
  let raw = ""
  if (process.platform === "darwin") {
    raw = (await $`lsof -ti tcp:${port} -sTCP:LISTEN`.quiet().nothrow())
      .text()
      .trim()
  } else {
    raw = (await $`lsof -ti tcp:${port} -sTCP:LISTEN`.quiet().nothrow())
      .text()
      .trim()
    if (!raw) {
      const out = (await $`ss -tlnpH sport = :${port}`.quiet().nothrow()).text()
      raw = [...out.matchAll(/pid=(\d+)/g)].map((m) => m[1]).join("\n")
    }
  }
  return [
    ...new Set(
      raw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ]
}

const pids = await findPids(port)
for (const pid of pids) {
  await $`kill ${pid}`.quiet().nothrow()
}

// Poll until port is free (TCP shutdown isn't instant)
for (let i = 0; i < 30; i++) {
  const remaining = await findPids(port)
  if (remaining.length === 0) break
  await Bun.sleep(100)
}

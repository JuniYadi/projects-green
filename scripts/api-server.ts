import { app } from "@/lib/api"
import { terminalWsRoute } from "@/modules/deploy/api/routes/terminal-ws.route"

const port = Number(process.env.API_PORT || process.env.PORT || 3301)
const hostname = process.env.HOST || "0.0.0.0"

// Mount terminal WebSocket routes under /ws/deploy/* and start standalone server
const server = app.use(terminalWsRoute).listen({
  port,
  hostname,
})

console.log(
  `🚀 Projects Green API & WebSocket Gateway running at http://${hostname}:${port}`
)

export default server

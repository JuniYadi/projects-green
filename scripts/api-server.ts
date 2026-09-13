import { terminalWsGateway } from "@/modules/deploy/api/terminal-ws-gateway"

const port = Number(process.env.API_PORT || process.env.PORT || 3301)
const hostname = process.env.HOST || "0.0.0.0"

const server = terminalWsGateway.listen({
  port,
  hostname,
})

console.log(
  `🚀 Projects Green WebSocket Gateway running at http://${hostname}:${port}`
)

export default server

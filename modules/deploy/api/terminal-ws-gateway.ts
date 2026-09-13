import { Elysia } from "elysia"
import { terminalWsRoute } from "@/modules/deploy/api/routes/terminal-ws.route"

export const terminalWsGateway = new Elysia()
  .get("/health", () => ({ ok: true }))
  .use(terminalWsRoute)

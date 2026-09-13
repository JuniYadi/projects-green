import { Elysia } from "elysia"
import { terminalWsRoute } from "@/modules/deploy/api/routes/terminal-ws.route"

export const terminalWsGateway = new Elysia()
  .get("/health", () => ({ ok: true }))
  .get("/healthz", () => ({ ok: true }))
  .get("/healthz/live", () => ({ ok: true }))
  .get("/healthz/ready", () => ({ ok: true }))
  .get("/api/health", () => ({ ok: true }))
  .get("/api/health/startup", () => ({ ok: true }))
  .get("/api/healthz/live", () => ({ ok: true }))
  .get("/api/healthz/ready", () => ({ ok: true }))
  .use(terminalWsRoute)

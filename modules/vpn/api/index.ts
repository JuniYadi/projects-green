/**
 * VPN module API assembly.
 *
 * Exposes `vpnRoutes` for mounting in `lib/api.ts`. The single
 * `POST /vpn/subscriptions` endpoint is the monthly billing gate for
 * VPN provisioning. Provider-level VPN internals (OpenVPN SSH, WireGuard
 * REST, etc.) are intentionally out of scope for the monthly billing
 * integration plan and will be added as separate features.
 */

import { Elysia } from "elysia"

import { createVpnRoutes } from "./vpn.route"

export const vpnRoutes = new Elysia({ prefix: "/vpn" }).use(createVpnRoutes())

# VPN Module

projects-green provides a full VPN subscription service with mobile app device pairing, server management, and provisioning across OpenVPN and WireGuard protocols.

## Architecture

The VPN module is organized into several sub-system groups:

```
modules/vpn/
├── admin/         → Server CRUD, packages, regions, SSH keys
├── api/           → User-facing VPN API
├── billing/       → VPN-specific billing integration
├── emails/        → Email templates for VPN
├── integration/   → Full integration test fixtures
├── mobile/        → Mobile app backend (auth, pairing, profiles, devices)
├── openvpn/       → OpenVPN SSH adapter
├── provisioning/  → VPN provisioning pipeline
├── sessions/      → Mobile session tracking (connection state + traffic)
├── subscriptions/ → Subscription CRUD, package catalog
├── wireguard/     → WireGuard SSH adapter
├── _components/   → Shared UI components
├── email.service.tsx → Email notification service
├── vpn-client.service.ts → Client management service
├── vpn-crypto.ts  → Cryptographic utilities
```

## Subscriptions (`modules/vpn/subscriptions/`)

The subscription system manages VPN plan purchases and lifecycle:

- **Package catalog** — listing available VPN packages with region support
- **Subscription CRUD** — create, renew, cancel, change plans
- **Admin subscription management** — billing admin UI
- **Renewal worker** (`scripts/vpn-renewal-worker.ts`) — handles recurring billing
- Key APIs: `vpn-subscriptions.route.ts`, `vpn-package-catalog.route.ts`
- Key source: `modules/vpn/subscriptions/vpn-subscription.service.ts`

### Console Pages
- `/console/vpn/dashboard` — VPN overview dashboard
- `/console/vpn/devices` — Connected devices list
- `/console/vpn/subscriptions` — Subscription management with detail page
- `/console/vpn/my-services` — VPN service list with filtering

## Mobile App Backend (`modules/vpn/mobile/`)

The mobile backend enables native VPN client apps to authenticate, pair, and connect:

### Auth Flow
1. User scans QR code from console → JWT pairing token is generated (`VPN_PAIRING_SECRET` or `JWT_SECRET` as HS256 signer)
2. Mobile app presents the pairing token → receives a mobile session JWT
3. Subsequent API calls use the session JWT for authentication

### API Endpoints (Elysia routes)

| Route Group | Description |
|-------------|-------------|
| `mobile-auth` | Device authentication and token exchange |
| `mobile-pairing` | QR-code pairing flow |
| `mobile-profiles` | VPN profile listing and config download |
| `mobile-device` | Device management CRUD |

Key source: `modules/vpn/mobile/api/`

### Session Tracking (`modules/vpn/sessions/`)

Added in **PGREEN-156** (`309609d`), the session tracking system monitors:

- Connection state (connected/disconnected)
- Traffic metrics (upload/download bytes)
- Connection duration
- Heartbeat mechanism
- Stale session cleanup (`stale-cleanup.ts`)

Managed by route groups under `/vpn/mobile/sessions` in the Elysia router.

## Admin Server Management (`modules/vpn/admin/`)

Full CRUD for VPN infrastructure:

- **Servers** — Create/edit/delete VPN servers with region, host, port, protocol support
- **Packages** — Define VPN package tiers (price, server count, protocol count, regions)
- **Regions** — Server region codes and metadata
- **SSH Keys** — SSH key management for server provisioning
- **Server coordinates** (added in `17069d4`) — lat/lng for map display

Key source: `modules/vpn/admin/vpn-server.service.ts`, `vpn-server.schema.ts`

## Provisioning (`modules/vpn/provisioning/`)

The provisioning pipeline handles:

- **OpenVPN adapter** (`modules/vpn/openvpn/`) — SSH-based config generation and deployment to OpenVPN servers
- **WireGuard adapter** (`modules/vpn/wireguard/`) — SSH-based WireGuard config generation
- Client certificate/key generation
- Server-side configuration push

## Infrastructure Integration

- **Email notifications** — VPN-related transactional emails (`email.service.tsx`)
- **Billing** — VPN billing integration for subscription payments and invoicing
- **API client** — Typed VPN client (`lib/vpn-client.ts`) and mobile client (`lib/vpn-mobile-client.ts`)

## Recent Development History

| Commit | Feature |
|--------|---------|
| `309609d` | PGREEN-156: VPN Mobile Session Tracking (connection + traffic) |
| `54e421c` | PGREEN-157: VPN devices UI bugs |
| `17069d4` | VPN server coordinates, price lock fix, billing improvements |
| `6a650ae` | VPN subscription detail page |

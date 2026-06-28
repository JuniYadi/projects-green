# VPN HA Foundation

> Living doc — requirements for running a second OpenVPN server for high
> availability. Last updated: 2026-06-28.

## What a second server needs

| Requirement | Detail |
|-------------|--------|
| Docker host | Any Linux VM with Docker Engine installed |
| OpenVPN image | [`d3vilh/openvpn-server`](https://hub.docker.com/r/d3vilh/openvpn-server) |
| Port | UDP 1194 (or whatever `OPENVPN_PORT` is set to) |
| Scripts | `/root/genclient.sh`, `/root/revoke.sh`, `/root/rmcert.sh`, `/root/userlist.sh` — same as primary |
| SSH key | Separate ed25519 keypair per server, stored encrypted via `VpnSshKey` |

## SSH key setup

```bash
ssh-keygen -t ed25519 -f ~/.ssh/pgreen-vpn-sg1 -N ""
ssh-copy-id -i ~/.ssh/pgreen-vpn-sg1 root@vpn-sg1.pgreen.io
```

Encrypt the private key with the app's `ENCRYPTION_KEY` and store it in the
`VpnSshKey` table via the admin interface.

## Multi-server in the executor

`VpnServerSshExecutor` already supports per-server targets via the `SshTarget`
type — one `{ host, user, encryptedPrivateKey }` per server. The route layer
resolves a target from `VpnServer` rows in the database:

```ts
// modules/vpn/api/vpn.route.ts — resolveSshTarget
const server = await prisma.vpnServer.findFirst({
  where: { hasOpenVpn: true, isActive: true, regionId: "..." },
  include: { sshKey: true },
})
```

Adding a second server means inserting a new `VpnServer` row with a different
`hostname`, `ipAddress`, and `sshKey`. No code changes needed.

## DNS setup

| Record | Value | Purpose |
|--------|-------|---------|
| `vpn-sg1.pgreen.io` A | 64.120.95.199 | Singapore node |
| `vpn-us2.pgreen.io` A | 70.36.96.42 | US West node |

The executor resolves the hostname first and falls back to `ipAddress` on
DNS failure (`ENOTFOUND`/`EAI_AGAIN`), so both A records and raw IPs work.

## Test procedure

1. Add second server to the `VpnServer` table via Prisma or admin API
2. Create a test client on server A: `adapter.createClient(targetA, "test-ha-a")`
3. Create a test client on server B: `adapter.createClient(targetB, "test-ha-b")`
4. Verify both configs can be fetched: `adapter.fetchConfig(targetA, "test-ha-a")`
5. Verify isolation: client A should not exist on server B and vice versa
6. Revoke and clean up both
7. Run the live integration test against each server:

```bash
OPENVPN_LIVE_TEST_HOST="vpn-sg1.pgreen.io" \
  OPENVPN_LIVE_TEST_USER="root" \
  OPENVPN_LIVE_TEST_KEY="$(cat ~/.ssh/pgreen-vpn-sg1)" \
  ENCRYPTION_KEY="..." \
  bun test modules/vpn/integration/openvpn-live.test.ts
```

Repeat with `vpn-us2.pgreen.io` and its key for the second server.

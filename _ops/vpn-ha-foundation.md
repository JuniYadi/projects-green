# VPN HA Foundation

> Living document for multi-server OpenVPN deployment. Last updated: 2026-06-28

## Overview

The VPN module already supports multiple servers via `VpnServerSshExecutor` and `SshTarget`. No Prisma schema changes required.

## Adding a Second OpenVPN Server

### 1. Provision the Server

- Docker host (VM/cloud instance)
- Image: `d3vilh/openvpn-server`
- Port: 1194/UDP
- Same scripts as primary: `genclient.sh`, `revoke.sh`, `rmcert.sh`, `userlist.sh`
- Same directory structure: `/root/openvpn/`

### 2. SSH Key Per Server

Generate dedicated ed25519 keypair:
```bash
ssh-keygen -t ed25519 -f vpn-sg2
```

Store encrypted private key in `VpnSshKey` table, link to the new `VpnServer` record.

### 3. DNS Setup

Add A record:
```
vpn-sg2.pgreen.io → <new-server-ip>
```

### 4. Test Procedure

1. Add new server to DB via `VpnServer` record
2. Create a test client on each server
3. Verify both `.ovpn` configs work independently
4. Verify isolation (client from server A cannot connect to server B)

## Existing Multi-Server Support

`VpnServerSshExecutor` already supports:
- Per-server `SshTarget` with dedicated host/user/key
- Hostname → IP fallback via `ipAddress` field
- 30s SSH timeout per command

## Status Log Path

Default: `/root/openvpn/log/openvpn-status.log`

The d3vilh container writes status to this host-mounted path. Verify on live test.

## Docker Compose Path

Default: `/root/openvpn/docker-compose.yaml`

Update `dockerComposeFile` option in `OpenVpnSshAdapter` constructor if using a different path.

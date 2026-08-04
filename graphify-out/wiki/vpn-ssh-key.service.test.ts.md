# vpn-ssh-key.service.test.ts

> 47 nodes · cohesion 0.07

## Key Concepts

- **vpn-ssh-key.service.test.ts** (22 connections) — `modules/vpn/admin/vpn-ssh-key.service.test.ts`
- **vpn-ssh-keys.route.ts** (19 connections) — `modules/vpn/admin/api/vpn-ssh-keys.route.ts`
- **vpn-ssh-key.crypto.ts** (18 connections) — `modules/vpn/admin/vpn-ssh-key.crypto.ts`
- **vpn-ssh-key.service.ts** (13 connections) — `modules/vpn/admin/vpn-ssh-key.service.ts`
- **decryptSshPrivateKey()** (11 connections) — `modules/vpn/admin/vpn-ssh-key.crypto.ts`
- **VpnSshKeyService** (7 connections) — `modules/vpn/admin/vpn-ssh-key.service.ts`
- **encryptSshPrivateKey()** (6 connections) — `modules/vpn/admin/vpn-ssh-key.crypto.ts`
- **computeSshKeyFingerprint()** (5 connections) — `modules/vpn/admin/vpn-ssh-key.crypto.ts`
- **vpn-ssh-key.schema.ts** (5 connections) — `modules/vpn/admin/vpn-ssh-key.schema.ts`
- **createAdminVpnSshKeysRoutes()** (4 connections) — `modules/vpn/admin/api/vpn-ssh-keys.route.ts`
- **VpnSshKeyError** (4 connections) — `modules/vpn/admin/vpn-ssh-key.crypto.ts`
- **vpn-ssh-key.dto.ts** (4 connections) — `modules/vpn/admin/vpn-ssh-key.dto.ts`
- **VpnSshKeyAlreadyExistsError** (4 connections) — `modules/vpn/admin/vpn-ssh-key.service.ts`
- **VpnSshKeyInUseError** (4 connections) — `modules/vpn/admin/vpn-ssh-key.service.ts`
- **VpnSshKeyNotFoundError** (4 connections) — `modules/vpn/admin/vpn-ssh-key.service.ts`
- **.create()** (4 connections) — `modules/vpn/admin/vpn-ssh-key.service.ts`
- **getEncryptionKey()** (3 connections) — `modules/vpn/admin/vpn-ssh-key.crypto.ts`
- **parseSshPrivateKey()** (3 connections) — `modules/vpn/admin/vpn-ssh-key.crypto.ts`
- **toVpnSshKeyDTO()** (3 connections) — `modules/vpn/admin/vpn-ssh-key.dto.ts`
- **CreateVpnSshKeyInput** (3 connections) — `modules/vpn/admin/vpn-ssh-key.schema.ts`
- **createVpnSshKeySchema** (3 connections) — `modules/vpn/admin/vpn-ssh-key.schema.ts`
- **toSshKeyError()** (2 connections) — `modules/vpn/admin/api/vpn-ssh-keys.route.ts`
- **resetVpnSshCrypto()** (2 connections) — `modules/vpn/admin/vpn-ssh-key.crypto.ts`
- **vpn-ssh-key.schema.test.ts** (2 connections) — `modules/vpn/admin/vpn-ssh-key.schema.test.ts`
- **Deps** (1 connections) — `modules/vpn/admin/api/vpn-ssh-keys.route.ts`
- *... and 22 more nodes in this community*

## Relationships

- [app-credential.service.ts](app-credential.service.ts.md) (9 shared connections)
- [vpn-connection-scanner.ts](vpn-connection-scanner.ts.md) (6 shared connections)
- [SshTarget](SshTarget.md) (3 shared connections)
- [vpn-packages.route.ts](vpn-packages.route.ts.md) (2 shared connections)
- [admin.guards.ts](admin.guards.ts.md) (2 shared connections)
- [AdminApiError](AdminApiError.md) (1 shared connections)
- [prisma.ts](prisma.ts.md) (1 shared connections)

## Source Files

- `modules/vpn/admin/api/vpn-ssh-keys.route.ts`
- `modules/vpn/admin/vpn-ssh-key.crypto.ts`
- `modules/vpn/admin/vpn-ssh-key.dto.ts`
- `modules/vpn/admin/vpn-ssh-key.schema.test.ts`
- `modules/vpn/admin/vpn-ssh-key.schema.ts`
- `modules/vpn/admin/vpn-ssh-key.service.test.ts`
- `modules/vpn/admin/vpn-ssh-key.service.ts`

## Audit Trail

- EXTRACTED: 176 (99%)
- INFERRED: 2 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
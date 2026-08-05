# app-credential.service.ts

> 84 nodes · cohesion 0.04

## Key Concepts

- **app-credential.service.ts** (26 connections) — `modules/credentials/app-credential.service.ts`
- **vpn-crypto.ts** (20 connections) — `modules/vpn/vpn-crypto.ts`
- **app-managed-service.service.ts** (19 connections) — `modules/deploy/app-managed-service.service.ts`
- **vpn-client.service.ts** (15 connections) — `modules/vpn/vpn-client.service.ts`
- **encryption.ts** (14 connections) — `lib/encryption.ts`
- **decryptVpnConfig()** (14 connections) — `modules/vpn/vpn-crypto.ts`
- **decrypt()** (13 connections) — `lib/encryption.ts`
- **encrypt()** (13 connections) — `lib/encryption.ts`
- **parseEncryptedField()** (13 connections) — `lib/encryption.ts`
- **serializeEncryptedField()** (13 connections) — `lib/encryption.ts`
- **encryption.service.ts** (13 connections) — `modules/payment/services/encryption.service.ts`
- **encryptVpnConfig()** (12 connections) — `modules/vpn/vpn-crypto.ts`
- **credentials.route.ts** (11 connections) — `modules/credentials/api/credentials.route.ts`
- **VpnClientService** (10 connections) — `modules/vpn/vpn-client.service.ts`
- **payment-confirmation.dto.ts** (8 connections) — `modules/payment/dto/payment-confirmation.dto.ts`
- **vpn-client.service.test.ts** (8 connections) — `modules/vpn/vpn-client.service.test.ts`
- **decryptProxyPassword()** (7 connections) — `modules/vpn/vpn-crypto.ts`
- **encryptProxyPassword()** (7 connections) — `modules/vpn/vpn-crypto.ts`
- **decryptClusterIntegrationSecrets()** (6 connections) — `modules/deploy/cluster-integration.service.ts`
- **vpn-crypto.test.ts** (6 connections) — `modules/vpn/vpn-crypto.test.ts`
- **listActiveGithubAppAccounts()** (5 connections) — `modules/credentials/app-credential.service.ts`
- **encryptClusterIntegrationSecrets()** (5 connections) — `modules/deploy/cluster-integration.service.ts`
- **toPaymentConfirmationDTO()** (5 connections) — `modules/payment/dto/payment-confirmation.dto.ts`
- **getEncryptionKey()** (5 connections) — `modules/vpn/vpn-crypto.ts`
- **deriveEncryptionKey()** (4 connections) — `lib/encryption.ts`
- *... and 59 more nodes in this community*

## Relationships

- [prisma.ts](prisma.ts.md) (12 shared connections)
- [vpn-subscriptions.route.ts](vpn-subscriptions.route.ts.md) (10 shared connections)
- [github.service.ts](github.service.ts.md) (9 shared connections)
- [vpn-ssh-key.service.test.ts](vpn-ssh-key.service.test.ts.md) (9 shared connections)
- [payment/api/topup.route.ts](payment-api-topup.route.ts.md) (9 shared connections)
- [getPlatformRoleForUser](getPlatformRoleForUser.md) (6 shared connections)
- [credential-type-registry.ts](credential-type-registry.ts.md) (5 shared connections)
- [wireguard.service.ts](wireguard.service.ts.md) (5 shared connections)
- [SshTarget](SshTarget.md) (3 shared connections)
- [api.ts](api.ts.md) (2 shared connections)
- [console/whatsapp/messages/page.tsx](console-whatsapp-messages-page.tsx.md) (2 shared connections)
- [cluster-management.service.ts](cluster-management.service.ts.md) (2 shared connections)

## Source Files

- `app/api/integrations/github/accounts/route.ts`
- `lib/encryption.ts`
- `modules/credentials/api/credentials.route.test.ts`
- `modules/credentials/api/credentials.route.ts`
- `modules/credentials/app-credential.service.ts`
- `modules/deploy/app-managed-service.service.ts`
- `modules/deploy/app-managed-service.types.ts`
- `modules/deploy/cluster-integration.service.ts`
- `modules/payment/dto/payment-confirmation.dto.test.ts`
- `modules/payment/dto/payment-confirmation.dto.ts`
- `modules/payment/services/encryption.service.test.ts`
- `modules/payment/services/encryption.service.ts`
- `modules/vpn/vpn-client.service.test.ts`
- `modules/vpn/vpn-client.service.ts`
- `modules/vpn/vpn-crypto.test.ts`
- `modules/vpn/vpn-crypto.ts`

## Audit Trail

- EXTRACTED: 382 (100%)
- INFERRED: 1 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
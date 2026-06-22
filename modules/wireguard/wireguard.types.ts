import type { Prisma } from "@prisma/client"

export type WgPeer = {
  username: string
  ip: string
  status: "online" | "offline"
  handshake: string | null
  rx: number
  tx: number
  endpoint: string | null
}

export type CreatePeerInput = {
  username: string
}

export type CreatePeerResult = {
  username: string
  ip: string
  config: string
  qrBase64: string
}

// DTO for API boundary
export type WgPeerDTO = WgPeer

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type VpnServerPayload = Prisma.VpnServerGetPayload<{}>
export type WireGuardServerDTO = Pick<
  VpnServerPayload,
  "id" | "hostname" | "ipAddress" | "wireGuardPort" | "wireGuardPublicKey" | "wireGuardSubnet" | "sshPort" | "sshUser"
>

export type SshTarget = {
  host: string
  ipAddress?: string
  user: string
  encryptedPrivateKey: string
}

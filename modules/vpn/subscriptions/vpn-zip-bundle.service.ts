import { decryptVpnConfig } from "@/modules/vpn/vpn-crypto"

export type VpnZipBundleAccount = {
  serverHostname?: string
  hostname?: string
  server?: { hostname?: string | null } | null
  protocol: "OPENVPN" | "WIREGUARD"
  configEncrypted?: string | null
  encryptedConfig?: string | null
}
type ZipEntry = {
  name: string
  content: Buffer
  crc: number
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(content: Buffer): number {
  let value = 0xffffffff
  for (const byte of content)
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

function dosTimeAndDate() {
  const now = new Date()
  return {
    time:
      (now.getHours() << 11) |
      (now.getMinutes() << 5) |
      Math.floor(now.getSeconds() / 2),
    date:
      ((now.getFullYear() - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate(),
  }
}

function writeEntryHeader(
  entry: ZipEntry,
  offset: number,
  central: boolean,
  time: number,
  date: number
): Buffer {
  const name = Buffer.from(entry.name, "utf8")
  const header = Buffer.alloc(central ? 46 : 30)
  if (central) {
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(20, 6)
    header.writeUInt16LE(0x800, 8)
    header.writeUInt16LE(0, 10)
    header.writeUInt16LE(time, 12)
    header.writeUInt16LE(date, 14)
    header.writeUInt32LE(entry.crc, 16)
    header.writeUInt32LE(entry.content.length, 20)
    header.writeUInt32LE(entry.content.length, 24)
    header.writeUInt16LE(name.length, 28)
    header.writeUInt32LE(offset, 42)
  } else {
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0x800, 6)
    header.writeUInt16LE(0, 8)
    header.writeUInt16LE(time, 10)
    header.writeUInt16LE(date, 12)
    header.writeUInt32LE(entry.crc, 14)
    header.writeUInt32LE(entry.content.length, 18)
    header.writeUInt32LE(entry.content.length, 22)
    header.writeUInt16LE(name.length, 26)
  }
  return Buffer.concat([header, name])
}

/** Build a standard, uncompressed ZIP containing decrypted VPN profiles. */
export function bundleVpnConfigs(accounts: VpnZipBundleAccount[]): Buffer {
  const entries = accounts.map((account) => {
    const hostname =
      account.serverHostname ?? account.hostname ?? account.server?.hostname
    const encrypted = account.configEncrypted ?? account.encryptedConfig
    if (!hostname?.trim()) throw new Error("VPN server hostname is required")
    if (!encrypted) throw new Error("VPN config is required")
    const extension = account.protocol === "WIREGUARD" ? "conf" : "ovpn"
    const content = Buffer.from(decryptVpnConfig(encrypted), "utf8")
    const entry = {
      name: `${hostname.trim()}.${extension}`,
      content,
      crc: crc32(content),
    }
    return entry
  })
  const { time, date } = dosTimeAndDate()
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const local = writeEntryHeader(entry, offset, false, time, date)
    localParts.push(local, entry.content)
    centralParts.push(writeEntryHeader(entry, offset, true, time, date))
    offset += local.length + entry.content.length
  }
  const central = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(central.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...localParts, central, end])
}

export const createVpnZipBundle = bundleVpnConfigs
export const buildVpnZipBundle = bundleVpnConfigs

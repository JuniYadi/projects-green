import { describe, expect, it } from "bun:test"

import { encryptVpnConfig } from "@/modules/vpn/vpn-crypto"
import { bundleVpnConfigs } from "./vpn-zip-bundle.service"

function decodeEntries(zip: Buffer) {
  const entries = new Map<string, string>()
  let offset = 0
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const nameLength = zip.readUInt16LE(offset + 26)
    const extraLength = zip.readUInt16LE(offset + 28)
    const size = zip.readUInt32LE(offset + 18)
    const name = zip.toString("utf8", offset + 30, offset + 30 + nameLength)
    const contentStart = offset + 30 + nameLength + extraLength
    entries.set(name, zip.toString("utf8", contentStart, contentStart + size))
    offset = contentStart + size
  }
  return entries
}

describe("bundleVpnConfigs", () => {
  it("decrypts active account configs and writes protocol extensions", () => {
    const zip = bundleVpnConfigs([
      {
        serverHostname: "sg01.vpn.example.com",
        protocol: "OPENVPN",
        configEncrypted: encryptVpnConfig("client\nremote sg01\n"),
      },
      {
        serverHostname: "us01.vpn.example.com",
        protocol: "WIREGUARD",
        configEncrypted: encryptVpnConfig("[Interface]\nPrivateKey = secret\n"),
      },
    ])

    expect(zip.subarray(0, 4).toString("hex")).toBe("504b0304")
    expect(decodeEntries(zip)).toEqual(
      new Map([
        ["sg01.vpn.example.com.ovpn", "client\nremote sg01\n"],
        ["us01.vpn.example.com.conf", "[Interface]\nPrivateKey = secret\n"],
      ])
    )
  })

  it("returns a valid empty ZIP when there are no accounts", () => {
    const zip = bundleVpnConfigs([])

    expect(zip.subarray(-22, -18).toString("hex")).toBe("504b0506")
    expect(decodeEntries(zip).size).toBe(0)
  })
})

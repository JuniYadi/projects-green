import { describe, expect, it } from "bun:test"

import { assertPublicHttpUrl } from "./public-url"

const resolvesTo =
  (...addresses: string[]) =>
  async () =>
    addresses.map((address) => ({
      address,
      family: address.includes(":") ? 6 : 4,
    }))

describe("assertPublicHttpUrl (WA-C07)", () => {
  it.each([
    "http://169.254.169.254/latest/meta-data",
    "http://127.0.0.2/",
    "http://10.0.0.5/hook",
    "http://[::1]/",
    "http://[::ffff:a9fe:a9fe]/",
    "http://[fd00::1]/",
  ])("rejects the internal address %s", async (url) => {
    await expect(assertPublicHttpUrl(url, resolvesTo())).rejects.toThrow()
  })

  it("rejects non-http schemes", async () => {
    await expect(
      assertPublicHttpUrl("file:///etc/passwd", resolvesTo())
    ).rejects.toThrow()
  })

  it("rejects a hostname when any resolved address is private", async () => {
    await expect(
      assertPublicHttpUrl(
        "https://internal.example.com/hook",
        resolvesTo("93.184.216.34", "10.1.2.3")
      )
    ).rejects.toThrow()
  })

  it("allows a hostname that resolves only to public addresses", async () => {
    await expect(
      assertPublicHttpUrl(
        "https://hooks.example.com/wa",
        resolvesTo("93.184.216.34")
      )
    ).resolves.toBeUndefined()
  })

  it("allows a public literal IP", async () => {
    await expect(
      assertPublicHttpUrl("https://93.184.216.34/wa", resolvesTo())
    ).resolves.toBeUndefined()
  })
})

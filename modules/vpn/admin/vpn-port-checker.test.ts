import { describe, expect, it } from "bun:test"
import {
  classifyIcmpError,
  classifyTcpError,
  defaultTcpDial,
  defaultUdpProbe,
} from "./vpn-port-checker"
import net from "node:net"
import dgram from "node:dgram"

describe("vpn-port-checker", () => {
  describe("classifyTcpError", () => {
    it("classifies ECONNREFUSED as closed port fail", () => {
      const err = new Error("connection refused") as NodeJS.ErrnoException
      err.code = "ECONNREFUSED"

      const res = classifyTcpError(err)

      expect(res.kind).toBe("fail")
      expect(res.message).toBe("Connection refused (port closed)")
      expect(res.detail).toBeDefined()
    })

    it("classifies EHOSTUNREACH and ENETUNREACH as fail", () => {
      const hostErr = new Error("host unreachable") as NodeJS.ErrnoException
      hostErr.code = "EHOSTUNREACH"
      expect(classifyTcpError(hostErr).kind).toBe("fail")

      const netErr = new Error("network unreachable") as NodeJS.ErrnoException
      netErr.code = "ENETUNREACH"
      expect(classifyTcpError(netErr).kind).toBe("fail")
    })

    it("classifies DNS and timeout errors", () => {
      const dnsErr = new Error("not found") as NodeJS.ErrnoException
      dnsErr.code = "ENOTFOUND"
      expect(classifyTcpError(dnsErr).message).toBe("DNS resolution failed")

      const timeoutErr = new Error("timed out") as NodeJS.ErrnoException
      timeoutErr.code = "ETIMEDOUT"
      expect(classifyTcpError(timeoutErr).message).toBe("Connection timed out")
    })

    it("classifies unknown generic errors", () => {
      const genericErr = new Error("Custom error") as NodeJS.ErrnoException
      expect(classifyTcpError(genericErr).message).toBe("Custom error")
    })
  })

  describe("classifyIcmpError", () => {
    it("maps ICMP error codes to human readable strings", () => {
      const refused = new Error() as NodeJS.ErrnoException
      refused.code = "ECONNREFUSED"
      expect(classifyIcmpError(refused)).toBe(
        "ICMP Port Unreachable — port is closed"
      )

      const hostUnreach = new Error() as NodeJS.ErrnoException
      hostUnreach.code = "EHOSTUNREACH"
      expect(classifyIcmpError(hostUnreach)).toBe("ICMP Host Unreachable")

      const netUnreach = new Error() as NodeJS.ErrnoException
      netUnreach.code = "ENETUNREACH"
      expect(classifyIcmpError(netUnreach)).toBe("ICMP Network Unreachable")

      const other = new Error("other error") as NodeJS.ErrnoException
      expect(classifyIcmpError(other)).toBe("other error")
    })
  })

  describe("defaultTcpDial", () => {
    it("successfully connects to local open TCP server", async () => {
      const server = net.createServer()
      const { promise, resolve } = Promise.withResolvers<void>()
      server.listen(0, "127.0.0.1", () => resolve())
      await promise
      const port = (server.address() as net.AddressInfo).port

      try {
        const res = await defaultTcpDial("127.0.0.1", port, 1000)
        expect(res.ok).toBe(true)
        if (res.ok) {
          expect(res.message).toContain("TCP connection succeeded")
        }
      } finally {
        server.close()
      }
    })

    it("handles connection failure on closed TCP port", async () => {
      const tmpServer = net.createServer()
      const { promise, resolve } = Promise.withResolvers<void>()
      tmpServer.listen(0, "127.0.0.1", () => resolve())
      await promise
      const closedPort = (tmpServer.address() as net.AddressInfo).port
      tmpServer.close()

      const res = await defaultTcpDial("127.0.0.1", closedPort, 1000)
      expect(res.ok).toBe(false)
    })
  })

  describe("defaultUdpProbe", () => {
    it("successfully probes open/listening UDP socket and receives message", async () => {
      const server = dgram.createSocket("udp4")
      server.on("message", (_, rinfo) => {
        server.send(Buffer.from("pong"), rinfo.port, rinfo.address)
      })

      const { promise, resolve } = Promise.withResolvers<void>()
      server.bind(0, "127.0.0.1", () => resolve())
      await promise
      const port = server.address().port

      try {
        const res = await defaultUdpProbe("127.0.0.1", port, 1000)
        expect(res.ok).toBe(true)
      } finally {
        server.close()
      }
    })

    it("times out and assumes port appears open when no ICMP received", async () => {
      const tmpSocket = dgram.createSocket("udp4")
      const { promise, resolve } = Promise.withResolvers<void>()
      tmpSocket.bind(0, "127.0.0.1", () => resolve())
      await promise
      const port = tmpSocket.address().port
      tmpSocket.close()

      const res = await defaultUdpProbe("127.0.0.1", port, 100)
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.message).toContain("No ICMP error received")
      }
    })
  })
})

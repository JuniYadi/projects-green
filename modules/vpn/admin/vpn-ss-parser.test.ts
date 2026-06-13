import { describe, it, expect } from "bun:test"

import { parseSsOutput } from "./vpn-server-connection"

describe("parseSsOutput", () => {
  it("parses IPv4 udp + tcp lines with process and pid", () => {
    const stdout = [
      'udp   UNCONN  0  0    0.0.0.0:1194    0.0.0.0:*    users:(("docker-proxy",pid=12150,fd=8))',
      'tcp   LISTEN  0  128  0.0.0.0:22      0.0.0.0:*    users:(("sshd",pid=848,fd=6))',
    ].join("\n")

    const ports = parseSsOutput(stdout)
    expect(ports).toEqual([
      { transport: "udp", port: 1194, processName: "docker-proxy", pid: 12150 },
      { transport: "tcp", port: 22, processName: "sshd", pid: 848 },
    ])
  })

  it("parses IPv6 [::]:port local addresses", () => {
    const stdout =
      'udp   UNCONN  0  0    [::]:51820    [::]:*    users:(("wireguard",pid=9876,fd=3))'
    const ports = parseSsOutput(stdout)
    expect(ports).toEqual([
      { transport: "udp", port: 51820, processName: "wireguard", pid: 9876 },
    ])
  })

  it("returns an empty array for empty input", () => {
    expect(parseSsOutput("")).toEqual([])
    expect(parseSsOutput("   \n  ")).toEqual([])
  })

  it("handles lines without a users column (no process info)", () => {
    const stdout = "udp   UNCONN  0  0    0.0.0.0:1194    0.0.0.0:*"
    const ports = parseSsOutput(stdout)
    expect(ports).toEqual([
      { transport: "udp", port: 1194, processName: "", pid: 0 },
    ])
  })

  it("skips header rows and non tcp/udp transports", () => {
    const stdout = [
      "Netid State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process",
      'raw   UNCONN 0 0 0.0.0.0:1 0.0.0.0:* users:(("ping",pid=1,fd=1))',
      'tcp   LISTEN 0 128 0.0.0.0:443 0.0.0.0:* users:(("nginx",pid=200,fd=9))',
    ].join("\n")
    const ports = parseSsOutput(stdout)
    expect(ports).toEqual([
      { transport: "tcp", port: 443, processName: "nginx", pid: 200 },
    ])
  })

  it("never throws on malformed input", () => {
    expect(() => parseSsOutput("garbage\n\t\t\nudp")).not.toThrow()
    expect(parseSsOutput("garbage line with no port")).toEqual([])
  })
})

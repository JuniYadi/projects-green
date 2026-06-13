import { describe, it, expect } from "bun:test"

import { classifyTcpError, classifyIcmpError } from "./vpn-port-checker"

const errWithCode = (code: string): NodeJS.ErrnoException => {
  const e = new Error(code) as NodeJS.ErrnoException
  e.code = code
  return e
}

describe("classifyTcpError", () => {
  it("treats refused as a fail (port closed)", () => {
    const r = classifyTcpError(errWithCode("ECONNREFUSED"))
    expect(r.kind).toBe("fail")
    expect(r.message).toContain("refused")
  })

  it("treats host unreachable as a fail", () => {
    const r = classifyTcpError(errWithCode("EHOSTUNREACH"))
    expect(r.kind).toBe("fail")
    expect(r.message).toContain("Host unreachable")
  })

  it("treats network unreachable as a fail", () => {
    const r = classifyTcpError(errWithCode("ENETUNREACH"))
    expect(r.kind).toBe("fail")
    expect(r.message).toContain("Network unreachable")
  })

  it("treats timeout as an error", () => {
    const r = classifyTcpError(errWithCode("ETIMEDOUT"))
    expect(r.kind).toBe("error")
    expect(r.message).toContain("timed out")
  })

  it("treats DNS failure as an error", () => {
    const r = classifyTcpError(errWithCode("ENOTFOUND"))
    expect(r.kind).toBe("error")
    expect(r.message).toContain("DNS")
  })
})

describe("classifyIcmpError", () => {
  it("maps ECONNREFUSED to port unreachable", () => {
    expect(classifyIcmpError(errWithCode("ECONNREFUSED"))).toContain(
      "Port Unreachable"
    )
  })

  it("maps EHOSTUNREACH to host unreachable", () => {
    expect(classifyIcmpError(errWithCode("EHOSTUNREACH"))).toContain(
      "Host Unreachable"
    )
  })

  it("maps ENETUNREACH to network unreachable", () => {
    expect(classifyIcmpError(errWithCode("ENETUNREACH"))).toContain(
      "Network Unreachable"
    )
  })
})

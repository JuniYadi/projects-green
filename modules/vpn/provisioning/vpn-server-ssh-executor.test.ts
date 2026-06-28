import { describe, expect, it } from "bun:test"

import type { SshCommandResult } from "./vpn-server-ssh-executor"
import {
  classifySshError,
  formatSshError,
} from "./vpn-server-ssh-executor"

const host = "vpn.example.com"

function result(
  overrides: Partial<SshCommandResult> = {}
): SshCommandResult {
  return { stdout: "", stderr: "", exitCode: 0, ...overrides }
}

describe("classifySshError", () => {
  it("classifies SSH timeout", () => {
    const error = classifySshError(result({ stderr: "SSH exec timed out" }), host)
    expect(error.type).toBe("timeout")
  })

  it("classifies auth failure with 'Authentication failed'", () => {
    const error = classifySshError(
      result({ stderr: "Authentication failed, permission denied" }),
      host
    )
    expect(error.type).toBe("auth_failure")
  })

  it("classifies auth failure with 'auth fail'", () => {
    const error = classifySshError(
      result({ stderr: "Permission denied (publickey,keyboard-interactive). auth fail" }),
      host
    )
    expect(error.type).toBe("auth_failure")
  })

  it("classifies unreachable with ENOTFOUND", () => {
    const error = classifySshError(
      result({ stderr: "getaddrinfo ENOTFOUND vpn.example.com" }),
      host
    )
    expect(error.type).toBe("unreachable")
  })

  it("classifies unreachable with ECONNREFUSED", () => {
    const error = classifySshError(
      result({ stderr: "connect ECONNREFUSED 1.2.3.4:22" }),
      host
    )
    expect(error.type).toBe("unreachable")
  })

  it("classifies command failure (non-zero exit)", () => {
    const error = classifySshError(
      result({ stderr: "docker: not found", exitCode: 127 }),
      host
    )
    expect(error.type).toBe("command_failed")
    expect(error).toHaveProperty("exitCode", 127)
  })

  it("classifies unknown error with empty stderr", () => {
    const error = classifySshError(result(), host)
    expect(error.type).toBe("unknown")
  })

  it("classifies unknown error with non-specific stderr", () => {
    const error = classifySshError(
      result({ stderr: "some unexpected error" }),
      host
    )
    expect(error.type).toBe("unknown")
  })
})

describe("formatSshError", () => {
  it("formats timeout error", () => {
    const msg = formatSshError(
      { type: "timeout", host },
      "deploy config"
    )
    expect(msg).toContain(host)
    expect(msg).toContain("deploy config")
    expect(msg).toContain("timed out")
  })

  it("formats auth failure", () => {
    const msg = formatSshError(
      { type: "auth_failure", host, message: "Authentication failed" },
      "run command"
    )
    expect(msg).toContain(host)
    expect(msg).toContain("Authentication failed")
  })

  it("formats unreachable error", () => {
    const msg = formatSshError(
      { type: "unreachable", host, message: "ENOTFOUND" },
      "check health"
    )
    expect(msg).toContain(host)
    expect(msg).toContain("Cannot reach")
  })

  it("formats command failure", () => {
    const msg = formatSshError(
      { type: "command_failed", host, exitCode: 2, stderr: "no such file" },
      "list clients"
    )
    expect(msg).toContain(host)
    expect(msg).toContain("exit 2")
    expect(msg).toContain("no such file")
  })

  it("formats unknown error", () => {
    const msg = formatSshError(
      { type: "unknown", message: "weird stuff" },
      "restart server"
    )
    expect(msg).toContain("restart server")
    expect(msg).toContain("weird stuff")
  })
})

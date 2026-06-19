import net from "node:net"
import dgram from "node:dgram"

/** Transport used by a port check. */
export type CheckTransport = "tcp" | "udp"

/** Outcome of a single port probe. */
export type PortCheckOutcome =
  | { ok: true; latencyMs: number; message: string; detail?: string }
  | {
      ok: false
      kind: "fail" | "error"
      message: string
      detail?: string
      latencyMs: number | null
    }

/** Low-level TCP dialer — resolves once the socket connects or errors. */
export type TcpDialer = (
  host: string,
  port: number,
  timeoutMs: number
) => Promise<PortCheckOutcome>

/** Low-level UDP prober — sends a datagram and watches for ICMP errors. */
export type UdpProber = (
  host: string,
  port: number,
  timeoutMs: number
) => Promise<PortCheckOutcome>

/**
 * Classify a TCP connection error into an admin-friendly message.
 * Distinguishes timeout vs refused vs host/network unreachable.
 */
export function classifyTcpError(err: NodeJS.ErrnoException): {
  kind: "fail" | "error"
  message: string
  detail?: string
} {
  const code = err.code
  if (code === "ECONNREFUSED") {
    return {
      kind: "fail",
      message: "Connection refused (port closed)",
      detail: "The host is reachable but nothing is listening on this port.",
    }
  }
  if (code === "EHOSTUNREACH") {
    return { kind: "fail", message: "Host unreachable" }
  }
  if (code === "ENETUNREACH") {
    return { kind: "fail", message: "Network unreachable" }
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return { kind: "error", message: "DNS resolution failed" }
  }
  if (code === "ETIMEDOUT") {
    return { kind: "error", message: "Connection timed out" }
  }
  return {
    kind: "error",
    message: err.message || "Unexpected connection error",
  }
}

/** Map a UDP-triggered ICMP error code into a human-readable reason. */
export function classifyIcmpError(err: NodeJS.ErrnoException): string {
  const code = err.code
  if (code === "ECONNREFUSED") {
    return "ICMP Port Unreachable — port is closed"
  }
  if (code === "EHOSTUNREACH") {
    return "ICMP Host Unreachable"
  }
  if (code === "ENETUNREACH") {
    return "ICMP Network Unreachable"
  }
  return err.message || "ICMP error received"
}

/**
 * Default TCP dial: open a socket, classify the connection result, then close.
 * No data is sent — a successful handshake is enough to prove the port is open.
 */
export const defaultTcpDial: TcpDialer = (host, port, timeoutMs) =>
  new Promise<PortCheckOutcome>((resolve) => {
    const socket = new net.Socket()
    const startedAt = Date.now()
    let settled = false

    const finish = (outcome: PortCheckOutcome) => {
      if (settled) return
      settled = true
      socket.removeAllListeners()
      socket.destroy()
      resolve(outcome)
    }

    socket.setTimeout(timeoutMs)
    socket.once("connect", () => {
      finish({
        ok: true,
        latencyMs: Date.now() - startedAt,
        message: "TCP connection succeeded — port is open",
        detail: `TCP dial to ${host}:${port} succeeded`,
      })
    })
    socket.once("timeout", () => {
      finish({
        ok: false,
        kind: "error",
        latencyMs: null,
        message: `Connection timed out after ${timeoutMs}ms`,
        detail: `TCP dial to ${host}:${port} timed out`,
      })
    })
    socket.once("error", (err: NodeJS.ErrnoException) => {
      const classified = classifyTcpError(err)
      finish({
        ok: false,
        kind: classified.kind,
        latencyMs: null,
        message: classified.message,
        detail: classified.detail ?? `TCP dial to ${host}:${port} failed`,
      })
    })

    try {
      socket.connect(port, host)
    } catch (err) {
      const e = err as NodeJS.ErrnoException
      const classified = classifyTcpError(e)
      finish({
        ok: false,
        kind: classified.kind,
        latencyMs: null,
        message: classified.message,
        detail: classified.detail,
      })
    }
  })

/**
 * Default UDP probe: send a minimal datagram and wait for an ICMP error.
 *
 * UDP is connectionless, so the heuristics are:
 * - ICMP Port Unreachable (ECONNREFUSED) → port is closed (fail)
 * - No response before the deadline → port appears open (pass, with caveat)
 * - Other socket errors → error
 */
export const defaultUdpProbe: UdpProber = (host, port, timeoutMs) =>
  new Promise<PortCheckOutcome>((resolve) => {
    const socket = dgram.createSocket("udp4")
    const startedAt = Date.now()
    let settled = false
    // eslint-disable-next-line prefer-const -- reassigned in setTimeout below
    let timer: ReturnType<typeof setTimeout> | undefined

    const finish = (outcome: PortCheckOutcome) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      socket.removeAllListeners()
      try {
        socket.close()
      } catch {
        // ignore teardown errors
      }
      resolve(outcome)
    }

    socket.once("error", (err: NodeJS.ErrnoException) => {
      finish({
        ok: false,
        kind: "fail",
        latencyMs: null,
        message: `Port unreachable — ${classifyIcmpError(err)}`,
        detail: `UDP probe to ${host}:${port} returned an ICMP error`,
      })
    })

    socket.once("message", () => {
      finish({
        ok: true,
        latencyMs: Date.now() - startedAt,
        message: "Port responded to UDP probe",
        detail: `UDP probe sent to ${host}:${port} and a response was received`,
      })
    })

    timer = setTimeout(() => {
      finish({
        ok: true,
        latencyMs: Date.now() - startedAt,
        message: "No ICMP error received — port appears open",
        detail: `UDP port ${port} accepting traffic. Send a handshake initiation to verify the service responds.`,
      })
    }, timeoutMs)

    try {
      socket.send(Buffer.from([0x00]), port, host, (err) => {
        if (err) {
          finish({
            ok: false,
            kind: "error",
            latencyMs: null,
            message: `Failed to send UDP probe: ${err.message}`,
          })
        }
      })
    } catch (err) {
      finish({
        ok: false,
        kind: "error",
        latencyMs: null,
        message: `Failed to send UDP probe: ${(err as Error).message}`,
      })
    }
  })

import net from "node:net"
import tls from "node:tls"

export type DomainTlsProbeResult = {
  ok: boolean
  authorized: boolean
  authorizationError: string | null
  issuer: string | null
  subject: string | null
  validFrom: Date | null
  validTo: Date | null
  fingerprint256: string | null
  error?: string | null
}

export async function probeDomainCertificate(
  hostname: string,
  port = 443,
  timeoutMs = 4000
): Promise<DomainTlsProbeResult> {
  const cleanHost = hostname.trim().toLowerCase().replace(/\.$/, "")
  if (!cleanHost) {
    return {
      ok: false,
      authorized: false,
      authorizationError: null,
      issuer: null,
      subject: null,
      validFrom: null,
      validTo: null,
      fingerprint256: null,
      error: "Empty hostname",
    }
  }

  return new Promise((resolve) => {
    try {
      const isIp = net.isIP(cleanHost) !== 0
      const socket = tls.connect(
        {
          host: cleanHost,
          port,
          ...(isIp ? {} : { servername: cleanHost }),
          rejectUnauthorized: false,
        },
        () => {
          const cert = socket.getPeerCertificate()
          socket.end()

          if (
            !cert ||
            !cert.subject ||
            Object.keys(cert.subject).length === 0
          ) {
            resolve({
              ok: false,
              authorized: false,
              authorizationError: socket.authorizationError ?? null,
              issuer: null,
              subject: null,
              validFrom: null,
              validTo: null,
              fingerprint256: null,
              error: "No certificate presented",
            })
            return
          }

          const validTo = cert.valid_to ? new Date(cert.valid_to) : null
          const validFrom = cert.valid_from ? new Date(cert.valid_from) : null

          resolve({
            ok: true,
            authorized: socket.authorized,
            authorizationError: socket.authorizationError ?? null,
            issuer: cert.issuer?.O || cert.issuer?.CN || "Unknown Issuer",
            subject: cert.subject?.CN || cleanHost,
            validFrom,
            validTo,
            fingerprint256: cert.fingerprint256 ?? null,
          })
        }
      )

      socket.setTimeout(timeoutMs, () => {
        socket.destroy()
        resolve({
          ok: false,
          authorized: false,
          authorizationError: null,
          issuer: null,
          subject: null,
          validFrom: null,
          validTo: null,
          fingerprint256: null,
          error: `Connection timed out after ${timeoutMs}ms`,
        })
      })

      socket.on("error", (err) => {
        resolve({
          ok: false,
          authorized: false,
          authorizationError: null,
          issuer: null,
          subject: null,
          validFrom: null,
          validTo: null,
          fingerprint256: null,
          error: err.message,
        })
      })
    } catch (err) {
      resolve({
        ok: false,
        authorized: false,
        authorizationError: null,
        issuer: null,
        subject: null,
        validFrom: null,
        validTo: null,
        fingerprint256: null,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })
}

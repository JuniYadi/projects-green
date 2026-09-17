import { isIP } from "node:net"
import { connect } from "node:tls"

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

function normalizeCertField(
  value: string | string[] | undefined
): string | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
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
      const isIp = isIP(cleanHost) !== 0
      const socket = connect(
        {
          host: cleanHost,
          port,
          ...(isIp ? {} : { servername: cleanHost }),
          rejectUnauthorized: false,
        },
        () => {
          const cert = socket.getPeerCertificate()
          socket.end()

          const authError = socket.authorizationError
            ? typeof socket.authorizationError === "string"
              ? socket.authorizationError
              : socket.authorizationError instanceof Error
                ? socket.authorizationError.message
                : String(socket.authorizationError)
            : null

          if (
            !cert ||
            !cert.subject ||
            Object.keys(cert.subject).length === 0
          ) {
            resolve({
              ok: false,
              authorized: false,
              authorizationError: authError,
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
          const issuer =
            normalizeCertField(cert.issuer?.O) ||
            normalizeCertField(cert.issuer?.CN) ||
            "Unknown Issuer"
          const subject = normalizeCertField(cert.subject?.CN) || cleanHost

          resolve({
            ok: true,
            authorized: socket.authorized,
            authorizationError: authError,
            issuer,
            subject,
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

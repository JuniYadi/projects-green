import nodemailer from "nodemailer"

async function main() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? "587")
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM ?? user
  const to = process.env.SMTP_TO
  const secure = process.env.SMTP_SECURE === "true" || port === 465

  if (!host || !user || !pass || !to || !from) {
    console.error("Missing required environment variables.")
    console.error("Usage:")
    console.error(
      "  SMTP_HOST=smtp.example.com SMTP_PORT=587 SMTP_USER=you@example.com SMTP_PASS=secret SMTP_TO=recipient@example.com bun run scripts/test-smtp.ts"
    )
    console.error("")
    console.error("Optional:")
    console.error("  SMTP_FROM     sender address (defaults to SMTP_USER)")
    console.error(
      "  SMTP_SECURE   set to 'true' to force TLS (port 465 defaults to true)"
    )
    process.exit(1)
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== "false",
    },
  })

  console.log(`Verifying connection to ${host}:${port} (secure=${secure})...`)
  await transporter.verify()
  console.log("Connection verified.")

  const info = await transporter.sendMail({
    from,
    to,
    subject: `SMTP test from ${host}`,
    text: `This is a test email sent from ${host}:${port} using Nodemailer.\n\nSent at: ${new Date().toISOString()}`,
    html: `<p>This is a test email sent from <strong>${host}:${port}</strong> using Nodemailer.</p><p>Sent at: ${new Date().toISOString()}</p>`,
  })

  console.log("Message sent:", info.messageId)
  console.log("Accepted:", info.accepted)
  console.log("Rejected:", info.rejected)
}

main().catch((error) => {
  console.error("SMTP test failed:", error)
  process.exit(1)
})

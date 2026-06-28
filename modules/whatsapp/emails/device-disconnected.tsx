import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components"

interface DeviceDisconnectedEmailProps {
  deviceName?: string
  phoneNumber?: string
  lastHeartbeatAt?: string | null
  disconnectedAt?: string
  orgName?: string
  deviceId?: string
  dashboardUrl?: string
}

export const DeviceDisconnectedEmail = ({
  deviceName,
  phoneNumber = "Unknown",
  lastHeartbeatAt,
  disconnectedAt = new Date().toISOString(),
  orgName = "Your Organization",
  deviceId,
  dashboardUrl = "https://app.projects-green.com",
}: DeviceDisconnectedEmailProps) => {
  const lastSeen = lastHeartbeatAt
    ? new Date(lastHeartbeatAt).toLocaleString()
    : "Never"
  const disconnectedTime = new Date(disconnectedAt).toLocaleString()
  const deviceLabel = deviceName ?? phoneNumber

  return (
    <Html>
      <Head />
      <Preview>
        [WhatsApp Alert] Device Disconnected: {phoneNumber}
      </Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Heading style={s.heading}>⚠️ Device Disconnected</Heading>
          <Text style={s.text}>
            A WhatsApp device in <strong>{orgName}</strong> has been
            disconnected.
          </Text>

          <table style={s.details}>
            <tr>
              <td style={s.label}>Device</td>
              <td style={s.value}>{deviceLabel}</td>
            </tr>
            <tr>
              <td style={s.label}>Phone Number</td>
              <td style={s.value}>{phoneNumber}</td>
            </tr>
            <tr>
              <td style={s.label}>Last Seen</td>
              <td style={s.value}>{lastSeen}</td>
            </tr>
            <tr>
              <td style={s.label}>Disconnected At</td>
              <td style={s.value}>{disconnectedTime}</td>
            </tr>
          </table>

          <Text style={s.text}>
            The device was automatically marked as disconnected after
            consecutive health check failures. All messaging through this
            device has been stopped.
          </Text>

          {deviceId && (
            <Link
              href={`${dashboardUrl}/portal/whatsapp/devices/${deviceId}`}
              style={s.button}
            >
              View Device in Dashboard
            </Link>
          )}

          <Hr style={s.hr} />
          <Text style={s.footer}>
            You can re-activate the device from the dashboard once the issue is
            resolved. This is an automated alert from projects-green.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const s = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #f0f0f0",
    borderRadius: "8px",
    margin: "0 auto",
    padding: "24px",
    maxWidth: "560px",
  },
  heading: {
    color: "#dc2626",
    fontSize: "24px",
    fontWeight: "700",
    margin: "0 0 16px",
  },
  text: {
    color: "#333",
    fontSize: "14px",
    lineHeight: "1.5",
    margin: "0 0 16px",
  },
  details: {
    width: "100%",
    marginBottom: "16px",
    borderCollapse: "collapse" as const,
  },
  label: {
    color: "#666",
    fontSize: "12px",
    fontWeight: "600",
    padding: "4px 12px 4px 0",
    verticalAlign: "top",
    whiteSpace: "nowrap" as const,
  },
  value: {
    color: "#333",
    fontSize: "14px",
    padding: "4px 0",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: "600",
    margin: "8px 0 16px",
    padding: "12px 24px",
    textDecoration: "none",
  },
  hr: {
    border: "none",
    borderTop: "1px solid #e6e6e6",
    margin: "24px 0",
  },
  footer: {
    color: "#888",
    fontSize: "12px",
    lineHeight: "1.4",
    margin: "0",
  },
}

export default DeviceDisconnectedEmail

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

interface DeviceDisconnectedEmailProps {
  deviceName: string
  phoneNumber: string
  orgName: string
  lastHeartbeatAt: string
  disconnectedAt: string
  dashboardUrl: string
}

export const DeviceDisconnectedEmail = ({
  deviceName,
  phoneNumber,
  orgName,
  lastHeartbeatAt,
  disconnectedAt,
  dashboardUrl,
}: DeviceDisconnectedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>
        [{orgName}] WhatsApp Device Disconnected: {phoneNumber}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>WhatsApp Device Disconnected</Heading>

          <Text style={styles.intro}>
            A WhatsApp device under <strong>{orgName}</strong> has gone
            offline and is no longer responding to health checks.
          </Text>

          <Section style={styles.deviceInfo}>
            <Text style={styles.deviceName}>{deviceName}</Text>
            <Text style={styles.phoneNumber}>{phoneNumber}</Text>
            <Text style={styles.statusBadge}>DISCONNECTED</Text>
          </Section>

          <Section style={styles.details}>
            <Text style={styles.detailRow}>
              <strong>Last seen:</strong> {lastHeartbeatAt}
            </Text>
            <Text style={styles.detailRow}>
              <strong>Disconnected at:</strong> {disconnectedAt}
            </Text>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.note}>
            WhatsApp messaging through this device will fail until it
            reconnects. Please verify the device&apos;s connection to Meta and
            check your network.
          </Text>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            This is an automated alert from your WhatsApp monitoring system.
            You can manage device health from the dashboard.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    margin: "40px auto",
    padding: "40px",
    maxWidth: "600px",
  },
  heading: {
    color: "#dc2626",
    fontSize: "24px",
    fontWeight: "600" as const,
    margin: "0 0 24px 0",
  },
  intro: {
    color: "#525f7f",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "0 0 24px 0",
  },
  deviceInfo: {
    backgroundColor: "#fef2f2",
    borderRadius: "6px",
    padding: "24px",
    margin: "0 0 24px 0",
    border: "1px solid #fecaca",
  },
  deviceName: {
    color: "#1a1a1a",
    fontSize: "18px",
    fontWeight: "600" as const,
    margin: "0 0 8px 0",
  },
  phoneNumber: {
    color: "#525f7f",
    fontSize: "14px",
    margin: "0 0 16px 0",
  },
  statusBadge: {
    backgroundColor: "#dc2626",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "600" as const,
    padding: "4px 12px",
    borderRadius: "4px",
    display: "inline-block",
    margin: "0",
  },
  details: {
    backgroundColor: "#f8f9fa",
    borderRadius: "6px",
    padding: "24px",
    margin: "0 0 24px 0",
  },
  detailRow: {
    color: "#525f7f",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0 0 8px 0",
  },
  divider: {
    borderColor: "#e6ebf1",
    borderWidth: "1px",
    margin: "24px 0",
  },
  note: {
    color: "#525f7f",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0 0 24px 0",
  },
  footer: {
    color: "#8898aa",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0",
  },
}

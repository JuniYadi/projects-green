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
} from "react-email"
import { getMessages } from "@/lib/i18n/messages"
import type { AppLocale } from "@/lib/i18n/config"

interface DeviceDisconnectedEmailProps {
  deviceName: string
  phoneNumber: string
  orgName: string
  lastHeartbeatAt: string
  disconnectedAt: string
  locale?: AppLocale
}

export const DeviceDisconnectedEmail = ({
  deviceName,
  phoneNumber,
  orgName,
  lastHeartbeatAt,
  disconnectedAt,
  locale = "en",
}: DeviceDisconnectedEmailProps) => {
  const messages = getMessages(locale).pEmailTemplates.whatsapp

  return (
    <Html>
      <Head />
      <Preview>
        {messages.disconnPreview
          .replace("{orgName}", orgName)
          .replace("{phoneNumber}", phoneNumber)}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{messages.disconnHeading}</Heading>

          <Text style={styles.intro}>
            {messages.disconnIntro.replace("{orgName}", orgName)}
          </Text>

          <Section style={styles.deviceInfo}>
            <Text style={styles.deviceName}>{deviceName}</Text>
            <Text style={styles.phoneNumber}>{phoneNumber}</Text>
            <Text style={styles.statusBadge}>{messages.disconnBadge}</Text>
          </Section>

          <Section style={styles.details}>
            <Text style={styles.detailRow}>
              <strong>{messages.lastSeen}</strong> {lastHeartbeatAt}
            </Text>
            <Text style={styles.detailRow}>
              <strong>{messages.disconnectedAt}</strong> {disconnectedAt}
            </Text>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.note}>
            {messages.disconnNote}
          </Text>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            {messages.disconnFooter}
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

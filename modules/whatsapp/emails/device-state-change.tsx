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

export interface DeviceStateChangeDiff {
  field: string
  oldValue: string
  newValue: string
}

export interface DeviceStateChangeEmailProps {
  deviceName: string
  phoneNumber: string
  orgName: string
  changes: DeviceStateChangeDiff[]
  changedAt: string
}

export const DeviceStateChangeEmail = ({
  deviceName,
  phoneNumber,
  orgName,
  changes,
  changedAt,
}: DeviceStateChangeEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>
        [Admin Alert] WhatsApp Device Status Changed: {phoneNumber} ({orgName})
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            WhatsApp Device Status Update
          </Heading>

          <Text style={styles.intro}>
            A Meta WhatsApp device state change has been detected for{" "}
            <strong>{orgName}</strong>.
          </Text>

          <Section style={styles.deviceInfo}>
            <Text style={styles.deviceName}>{deviceName}</Text>
            <Text style={styles.phoneNumber}>{phoneNumber}</Text>
          </Section>

          <Section style={styles.details}>
            <Text style={styles.subHeading}>Detected Changes:</Text>
            {changes.map((change, index) => (
              <div key={index} style={styles.changeRow}>
                <Text style={styles.changeField}>{change.field}</Text>
                <Text style={styles.changeValues}>
                  <span style={styles.oldVal}>
                    {change.oldValue || "EMPTY"}
                  </span>{" "}
                  &rarr;{" "}
                  <span style={styles.newVal}>
                    {change.newValue || "EMPTY"}
                  </span>
                </Text>
              </div>
            ))}
            <Text style={styles.timestamp}>
              <strong>Detected At:</strong> {changedAt}
            </Text>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            This is an automated super-admin alert. You can inspect this device
            in the admin portal.
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
    margin: "0 auto",
    padding: "32px 24px",
    maxWidth: "560px",
    borderRadius: "8px",
    border: "1px solid #e6ebf1",
  },
  heading: {
    color: "#1a1f36",
    fontSize: "20px",
    fontWeight: "600",
    lineHeight: "1.3",
    margin: "0 0 16px",
  },
  intro: {
    color: "#4f566b",
    fontSize: "14px",
    lineHeight: "1.5",
    margin: "0 0 20px",
  },
  deviceInfo: {
    backgroundColor: "#f8fafc",
    borderRadius: "6px",
    padding: "16px",
    margin: "0 0 20px",
    border: "1px solid #e2e8f0",
  },
  deviceName: {
    color: "#1a1f36",
    fontSize: "15px",
    fontWeight: "600",
    margin: "0 0 4px",
  },
  phoneNumber: {
    color: "#64748b",
    fontSize: "13px",
    fontFamily: "monospace",
    margin: "0",
  },
  details: {
    margin: "0 0 20px",
  },
  subHeading: {
    color: "#1a1f36",
    fontSize: "14px",
    fontWeight: "600",
    margin: "0 0 10px",
  },
  changeRow: {
    backgroundColor: "#f1f5f9",
    padding: "8px 12px",
    borderRadius: "4px",
    marginBottom: "6px",
  },
  changeField: {
    color: "#334155",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase" as const,
    margin: "0 0 2px",
  },
  changeValues: {
    fontSize: "13px",
    margin: "0",
  },
  oldVal: {
    color: "#dc2626",
    textDecoration: "line-through",
  },
  newVal: {
    color: "#16a34a",
    fontWeight: "600",
  },
  timestamp: {
    color: "#64748b",
    fontSize: "12px",
    marginTop: "12px",
  },
  divider: {
    borderColor: "#e6ebf1",
    margin: "20px 0",
  },
  footer: {
    color: "#8898aa",
    fontSize: "12px",
    lineHeight: "1.5",
    margin: "0",
  },
}

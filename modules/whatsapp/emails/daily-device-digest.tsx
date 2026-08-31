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

export interface DeviceDigestItem {
  id: string
  phoneNumber: string
  displayName: string
  orgName: string
  nameStatus: string
  qualityRating: string
  status: string
}

export interface DailyDeviceDigestEmailProps {
  devices: DeviceDigestItem[]
  generatedAt: string
  stats: {
    total: number
    approved: number
    pending: number
    declinedOrExpired: number
    active: number
  }
}

export const DailyDeviceDigestEmail = ({
  devices,
  generatedAt,
  stats,
}: DailyDeviceDigestEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>
        [Daily Digest] WhatsApp Device Status Summary ({stats.total} Devices)
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>WhatsApp Daily Device Digest</Heading>

          <Text style={styles.intro}>
            Daily summary of all WhatsApp devices and Meta approval statuses as
            of <strong>{generatedAt}</strong>.
          </Text>

          {/* KPI Summary */}
          <Section style={styles.kpiGrid}>
            <div style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{stats.total}</Text>
              <Text style={styles.kpiLabel}>Total Devices</Text>
            </div>
            <div style={styles.kpiCard}>
              <Text style={{ ...styles.kpiValue, color: "#16a34a" }}>
                {stats.approved}
              </Text>
              <Text style={styles.kpiLabel}>Name Approved</Text>
            </div>
            <div style={styles.kpiCard}>
              <Text style={{ ...styles.kpiValue, color: "#d97706" }}>
                {stats.pending}
              </Text>
              <Text style={styles.kpiLabel}>Pending Review</Text>
            </div>
            <div style={styles.kpiCard}>
              <Text style={{ ...styles.kpiValue, color: "#dc2626" }}>
                {stats.declinedOrExpired}
              </Text>
              <Text style={styles.kpiLabel}>Declined / Issues</Text>
            </div>
          </Section>

          {/* Devices Table */}
          <Section style={styles.tableSection}>
            <Text style={styles.sectionTitle}>Device Breakdown:</Text>
            {devices.map((device) => (
              <div key={device.id} style={styles.deviceRow}>
                <div style={styles.deviceHeader}>
                  <span style={styles.orgName}>{device.orgName}</span>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor:
                        device.nameStatus === "APPROVED"
                          ? "#dcfce7"
                          : device.nameStatus === "PENDING" ||
                              device.nameStatus === "PENDING_REVIEW"
                            ? "#fef3c7"
                            : "#fee2e2",
                      color:
                        device.nameStatus === "APPROVED"
                          ? "#15803d"
                          : device.nameStatus === "PENDING" ||
                              device.nameStatus === "PENDING_REVIEW"
                            ? "#b45309"
                            : "#b91c1c",
                    }}
                  >
                    {device.nameStatus || "UNSET"}
                  </span>
                </div>
                <Text style={styles.deviceSub}>
                  <strong style={styles.phone}>{device.phoneNumber}</strong> (
                  {device.displayName}) &bull; Quality: {device.qualityRating}{" "}
                  &bull; Connection: {device.status}
                </Text>
              </div>
            ))}
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            This is an automated 07:00 AM daily briefing sent to super
            administrators.
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
    maxWidth: "600px",
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
  kpiGrid: {
    display: "flex" as const,
    gap: "8px",
    marginBottom: "24px",
  },
  kpiCard: {
    flex: "1",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    padding: "12px 8px",
    textAlign: "center" as const,
  },
  kpiValue: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0 0 4px",
  },
  kpiLabel: {
    fontSize: "10px",
    color: "#64748b",
    textTransform: "uppercase" as const,
    fontWeight: "600",
    margin: "0",
  },
  tableSection: {
    margin: "0 0 20px",
  },
  sectionTitle: {
    color: "#1a1f36",
    fontSize: "14px",
    fontWeight: "600",
    margin: "0 0 12px",
  },
  deviceRow: {
    borderBottom: "1px solid #f1f5f9",
    padding: "10px 0",
  },
  deviceHeader: {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: "4px",
  },
  orgName: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#1e293b",
  },
  phone: {
    fontFamily: "monospace",
    color: "#0f172a",
  },
  statusBadge: {
    fontSize: "10px",
    fontWeight: "700",
    padding: "2px 6px",
    borderRadius: "4px",
    textTransform: "uppercase" as const,
  },
  deviceSub: {
    fontSize: "12px",
    color: "#64748b",
    margin: "0",
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

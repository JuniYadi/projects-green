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

interface ProvisioningSuccessEmailProps {
  organizationName?: string
  packageName?: string
}

export const ProvisioningSuccessEmail = ({
  organizationName = "your organization",
  packageName = "VPN",
}: ProvisioningSuccessEmailProps) => (
  <Html>
    <Head />
    <Preview>Your VPN account is ready</Preview>
    <Body style={s.body}>
      <Container style={s.container}>
        <Heading style={s.heading}>VPN Account Ready</Heading>
        <Text style={s.text}>
          Your {packageName} subscription for {organizationName} is now active.
        </Text>
        <Text style={s.text}>
          You can download configuration files and connect to your VPN from the
          console.
        </Text>
        <Hr style={s.hr} />
        <Text style={s.footer}>
          If you experience any issues, please contact our support team.
        </Text>
      </Container>
    </Body>
  </Html>
)

const s = {
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
    color: "#1a1a1a",
    fontSize: "24px",
    fontWeight: "600" as const,
    margin: "0 0 24px 0",
  },
  text: {
    color: "#525f7f",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "0 0 16px 0",
  },
  hr: {
    borderColor: "#e6ebf1",
    margin: "24px 0",
  },
  footer: {
    color: "#8898aa",
    fontSize: "14px",
    margin: "0",
  },
}

export default ProvisioningSuccessEmail

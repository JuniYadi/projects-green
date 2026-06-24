import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components"

interface ProvisioningFailedEmailProps {
  organizationName?: string
  packageName?: string
}

export const ProvisioningFailedEmail = ({
  organizationName = "your organization",
  packageName = "VPN",
}: ProvisioningFailedEmailProps) => (
  <Html>
    <Head />
    <Preview>Provisioning failed — contact support</Preview>
    <Body style={s.body}>
      <Container style={s.container}>
        <Heading style={s.heading}>Provisioning Failed</Heading>
        <Text style={s.text}>
          We encountered a problem while setting up your {packageName}{" "}
          subscription for {organizationName}.
        </Text>
        <Text style={s.text}>
          Our team has been notified and will investigate. If the issue persists,
          please reach out to support for assistance.
        </Text>
        <Hr style={s.hr} />
        <Text style={s.footer}>
          We apologize for the inconvenience. Contact support for help.
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
    color: "#cc0000",
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

export default ProvisioningFailedEmail

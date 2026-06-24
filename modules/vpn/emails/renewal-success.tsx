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

interface RenewalSuccessEmailProps {
  organizationName?: string
  packageName?: string
  period?: string
}

export const RenewalSuccessEmail = ({
  organizationName = "your organization",
  packageName = "VPN",
  period = "the current billing period",
}: RenewalSuccessEmailProps) => (
  <Html>
    <Head />
    <Preview>VPN subscription renewed</Preview>
    <Body style={s.body}>
      <Container style={s.container}>
        <Heading style={s.heading}>Subscription Renewed</Heading>
        <Text style={s.text}>
          Your {packageName} subscription for {organizationName} has been
          successfully renewed for {period}.
        </Text>
        <Text style={s.text}>
          Your VPN service continues as normal. You do not need to take any
          action.
        </Text>
        <Hr style={s.hr} />
        <Text style={s.footer}>
          Thank you for being a valued customer.
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

export default RenewalSuccessEmail

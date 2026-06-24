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

interface SubscriptionSuspendedEmailProps {
  organizationName?: string
  packageName?: string
}

export const SubscriptionSuspendedEmail = ({
  organizationName = "your organization",
  packageName = "VPN",
}: SubscriptionSuspendedEmailProps) => (
  <Html>
    <Head />
    <Preview>VPN suspended due to payment overdue</Preview>
    <Body style={s.body}>
      <Container style={s.container}>
        <Heading style={s.heading}>VPN Subscription Suspended</Heading>
        <Text style={s.text}>
          Your {packageName} subscription for {organizationName} has been
          suspended due to overdue payment.
        </Text>
        <Text style={s.text}>
          Please top up your balance to restore service. If no payment is
          received within the next few days, your subscription will be
          permanently expired.
        </Text>
        <Hr style={s.hr} />
        <Text style={s.footer}>
          Need help? Contact our support team.
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

export default SubscriptionSuspendedEmail

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

interface SubscriptionCancelledEmailProps {
  organizationName?: string
  packageName?: string
  periodEnd?: string
}

export const SubscriptionCancelledEmail = ({
  organizationName = "your organization",
  packageName = "VPN",
  periodEnd = "the end of the current billing period",
}: SubscriptionCancelledEmailProps) => (
  <Html>
    <Head />
    <Preview>Subscription will be cancelled at period end</Preview>
    <Body style={s.body}>
      <Container style={s.container}>
        <Heading style={s.heading}>Subscription Cancellation Confirmed</Heading>
        <Text style={s.text}>
          Your {packageName} subscription for {organizationName} has been
          scheduled for cancellation.
        </Text>
        <Text style={s.text}>
          You will retain access until {periodEnd}. After that date, your
          subscription will be terminated and all associated data will be
          removed.
        </Text>
        <Hr style={s.hr} />
        <Text style={s.footer}>
          If you change your mind, you can cancel the cancellation from your
          console before the period ends.
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

export default SubscriptionCancelledEmail

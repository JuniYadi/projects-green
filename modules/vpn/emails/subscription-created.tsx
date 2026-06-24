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

interface SubscriptionCreatedEmailProps {
  organizationName?: string
  packageName?: string
}

export const SubscriptionCreatedEmail = ({
  organizationName = "your organization",
  packageName = "VPN",
}: SubscriptionCreatedEmailProps) => (
  <Html>
    <Head />
    <Preview>Your VPN subscription is being provisioned</Preview>
    <Body style={s.body}>
      <Container style={s.container}>
        <Heading style={s.heading}>VPN Subscription Creating</Heading>
        <Text style={s.text}>
          Thank you for subscribing to the {packageName} plan for{" "}
          {organizationName}. We are now provisioning your VPN account.
        </Text>
        <Text style={s.text}>
          This usually takes a few minutes. You will receive another email once
          your VPN is ready to use.
        </Text>
        <Hr style={s.hr} />
        <Text style={s.footer}>
          If you have any questions, please contact our support team.
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

export default SubscriptionCreatedEmail

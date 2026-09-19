import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "react-email"
import { getMessages } from "@/lib/i18n/messages"
import type { AppLocale } from "@/lib/i18n/config"

interface SubscriptionExpiredEmailProps {
  organizationName?: string
  packageName?: string
  locale?: AppLocale
}

export const SubscriptionExpiredEmail = ({
  organizationName = "your organization",
  packageName = "VPN",
  locale = "en",
}: SubscriptionExpiredEmailProps) => {
  const messages = getMessages(locale).pEmailTemplates.vpn

  return (
    <Html>
      <Head />
      <Preview>{messages.expiredPreview}</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Heading style={s.heading}>{messages.expiredHeading}</Heading>
          <Text style={s.text}>
            {messages.expiredText1
              .replace("{packageName}", packageName)
              .replace("{organizationName}", organizationName)}
          </Text>
          <Text style={s.text}>
            {messages.expiredText2}
          </Text>
          <Hr style={s.hr} />
          <Text style={s.footer}>
            {messages.expiredFooter}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

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

export default SubscriptionExpiredEmail

import type { AppMessages } from "@/lib/i18n/messages/types"

export const legalEn: AppMessages["legal"] = {
  centerTitle: "Legal Center",
  badgeLabel: "Official Legal Policy",
  policiesHeading: "Policies & Agreements",
  navigationLabel: "Legal document navigation",
  entityLabel: "Entity",
  contactLabel: "Contact",
  legalEntityLabel: "Legal Entity",
  effectiveDateLabel: "Effective Date",
  lastUpdatedLabel: "Last Updated",
  effectiveDate: "August 21, 2026",
  contactEmail: "support@premiumfast.net",
  companyName: "PT. Premium Fast Network",
  navigation: {
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    acceptableUse: "Acceptable Use Policy",
    backToHome: "Back to Home",
  },
  terms: {
    title: "Terms of Service",
    description:
      "Review the Terms of Service governing access to and use of PFNApp cloud hosting, WhatsApp Business API, and VPN services operated by PT. Premium Fast Network.",
    intro:
      "These Terms of Service ('Terms') constitute a legally binding agreement between you ('Customer', 'you') and PT. Premium Fast Network ('Company', 'we', 'us', or 'our') regarding your access to and use of PFNApp platform, developer APIs, app hosting, WhatsApp integrations, and VPN infrastructure services.",
    sections: [
      {
        title: "1. Acceptance of Terms",
        content: [
          "By creating an account, accessing developer APIs, deploying applications, or purchasing subscriptions on PFNApp, you agree to be bound by these Terms and our Acceptable Use Policy.",
          "If you are entering into these Terms on behalf of an organization or legal entity, you represent and warrant that you have the authority to bind such entity.",
        ],
      },
      {
        title: "2. Account Registration and Security",
        content: [
          "You must provide accurate, current, and complete information during registration and keep your account details updated.",
          "You are solely responsible for maintaining the confidentiality of your credentials, API keys, and session tokens, as well as for all activities occurring under your account.",
          "You must promptly notify us at support@premiumfast.net if you discover or suspect unauthorized access to your account.",
        ],
      },
      {
        title: "3. Platform Services & Responsibilities",
        content: [
          "PFNApp provides cloud deployment orchestration, messaging APIs (including WhatsApp Business integrations), VPN connectivity, and developer management tools.",
          "We strive for high availability but do not guarantee uninterrupted or error-free operations. Scheduled maintenance, upstream provider disruptions (e.g., Meta Cloud API, cloud providers), and emergency upgrades may impact service availability.",
          "You retain ownership of all source code, deployment assets, customer contact lists, and message payloads processed through the platform.",
        ],
      },
      {
        title: "4. Billing, Subscriptions, and Payments",
        content: [
          "Services and subscription plans are billed according to published catalog rates, active recurring terms, or usage ledgers as displayed in the Console.",
          "All invoices and top-up balances must be settled in accordance with the specified payment terms. Failure to maintain required balances or pay invoices on time may result in service throttling or suspension.",
          "Except where required by applicable law, subscription fees and prepaid credits are non-refundable once allocated or consumed.",
        ],
      },
      {
        title: "5. Intellectual Property & License",
        content: [
          "PT. Premium Fast Network retains all rights, title, and interest in and to PFNApp software, trademarks, logos, and proprietary infrastructure.",
          "We grant you a revocable, non-exclusive, non-transferable license to access and use the platform strictly in accordance with these Terms.",
        ],
      },
      {
        title: "6. Limitation of Liability",
        content: [
          "To the maximum extent permitted by applicable law, in no event shall PT. Premium Fast Network, its directors, employees, or partners be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities.",
          "Our aggregate liability arising out of or related to these Terms shall not exceed the total amount paid by you to the Company in the twelve (12) months preceding the incident giving rise to liability.",
        ],
      },
      {
        title: "7. Termination & Suspension",
        content: [
          "You may terminate your account at any time through the platform settings or by contacting customer support.",
          "We reserve the right to suspend or terminate your access immediately if you violate these Terms, breach our Acceptable Use Policy, or engage in fraudulent or harmful conduct.",
        ],
      },
      {
        title: "8. Governing Law & Dispute Resolution",
        content: [
          "These Terms are governed by and construed in accordance with the laws of the Republic of Indonesia.",
          "Any disputes arising from or relating to these Terms shall be resolved through amicable negotiations or submitted to the competent courts of Indonesia.",
        ],
      },
      {
        title: "9. Contact & Inquiries",
        content: [
          "For legal notices, billing inquiries, or questions regarding these Terms, please contact us at support@premiumfast.net.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    description:
      "Learn how PT. Premium Fast Network collects, processes, and protects your personal and technical data across PFNApp cloud services.",
    intro:
      "PT. Premium Fast Network ('Company', 'we', 'us') is committed to protecting your privacy. This Privacy Policy describes how we collect, use, disclose, and safeguard your personal data when you use the PFNApp platform, website, APIs, and related cloud products.",
    sections: [
      {
        title: "1. Information We Collect",
        content: [
          "Account & Profile Information: Name, work email address, organization name, billing address, and authentication identifiers provided during signup or WorkOS authentication.",
          "Billing & Transaction Data: Invoice records, payment confirmations, bank transfer references, and transaction histories. We do not store raw credit card numbers on our servers.",
          "Technical & Telemetry Data: IP addresses, browser types, operating system details, device identifiers, and server access logs collected to ensure platform security and reliability.",
          "Service Payload Metadata: Message timestamps, routing identifiers, delivery statuses, deployment logs, and cluster metrics processed as part of your application workloads.",
        ],
      },
      {
        title: "2. How We Use Your Information",
        content: [
          "To provide, operate, maintain, and optimize PFNApp cloud hosting, VPN tunnels, and messaging services.",
          "To process billing transactions, calculate usage quotas, generate invoices, and verify bank payments.",
          "To detect, investigate, and prevent fraudulent activity, security incidents, and violations of our Acceptable Use Policy.",
          "To send critical system alerts, maintenance notices, and customer support communications.",
        ],
      },
      {
        title: "3. Data Sharing and Third-Party Processors",
        content: [
          "We do not sell, rent, or trade your personal information to third parties.",
          "We may share data with trusted infrastructure providers and technology partners solely for service delivery, including cloud compute providers, Meta Cloud API for WhatsApp, and WorkOS for enterprise authentication.",
          "We may disclose information if required to comply with applicable laws, regulations, court orders, or governmental requests in Indonesia.",
        ],
      },
      {
        title: "4. Data Security & Storage",
        content: [
          "We implement technical and organizational measures, including TLS/HTTPS encryption in transit and AES encryption at rest, to safeguard your data.",
          "Access to production systems is restricted to authorized personnel under strict multi-factor authentication and audit logging policies.",
        ],
      },
      {
        title: "5. Data Retention & Your Rights",
        content: [
          "We retain your personal data for as long as your account remains active or as necessary to fulfill legal, tax, and auditing obligations.",
          "You have the right to request access to, correction of, or deletion of your personal data by submitting a request to support@premiumfast.net.",
        ],
      },
      {
        title: "6. Changes to This Privacy Policy",
        content: [
          "We may update this Privacy Policy from time to time to reflect regulatory changes or platform updates. We will notify you of material changes by updating the Effective Date and publishing the revised policy on this page.",
        ],
      },
      {
        title: "7. Contact Us",
        content: [
          "If you have questions or concerns regarding our privacy practices or wish to exercise your data rights, please contact our Data Protection team at support@premiumfast.net.",
        ],
      },
    ],
  },
  acceptableUse: {
    title: "Acceptable Use Policy",
    description:
      "Guidelines and restrictions on the permissible use of PFNApp cloud infrastructure, WhatsApp API messaging, and VPN connectivity.",
    intro:
      "This Acceptable Use Policy ('AUP') outlines prohibited activities on the PFNApp platform, network infrastructure, and integrated APIs operated by PT. Premium Fast Network. By utilizing our services, you agree to comply with this AUP.",
    sections: [
      {
        title: "1. Purpose & Scope",
        content: [
          "This policy applies to all users, organizations, developers, and automated systems utilizing PFNApp compute hosting, database services, WhatsApp Business messaging, and VPN tunnels.",
          "Our goal is to protect the integrity, reliability, and security of our platform and ensure compliance with global telecommunications and messaging standards.",
        ],
      },
      {
        title: "2. Prohibited Content & Activities",
        content: [
          "Illegal & Harmful Content: Hosting, transmitting, or distributing content that violates Indonesian or international laws, including child exploitation material, terrorist propaganda, defamation, or hate speech.",
          "Malicious Software & Cyberattacks: Distributing viruses, malware, ransomware, conducting DDoS attacks, port scanning without authorization, or attempting to compromise any computer network.",
          "Cryptocurrency Mining: Unauthorized high-intensity crypto mining or compute abuse on shared app hosting resources.",
          "Fraud & Phishing: Creating deceptive landing pages, executing phishing campaigns, impersonating legitimate entities, or conducting fraudulent transactions.",
        ],
      },
      {
        title: "3. Messaging & WhatsApp Business Guidelines",
        content: [
          "Unsolicited Messaging (Spam): Sending bulk, spam, or promotional WhatsApp messages without prior affirmative consent (opt-in) from recipients is strictly prohibited.",
          "Meta Policy Compliance: All WhatsApp communications must adhere strictly to Meta's WhatsApp Business Messaging Policy and Commerce Policy.",
          "Prohibited Verticals: Using the WhatsApp API for prohibited products (e.g., illicit drugs, counterfeit goods, unauthorized gambling, weapons) is prohibited and will result in immediate termination.",
        ],
      },
      {
        title: "4. Network & VPN Usage Standards",
        content: [
          "Our VPN services are designed for secure remote connectivity, privacy protection, and legitimate network management.",
          "You must not use VPN endpoints for illegal torrenting, bypassing lawful blocking orders, masking malicious network intrusions, or conducting unauthorized surveillance.",
        ],
      },
      {
        title: "5. Enforcement, Reporting & Penalties",
        content: [
          "We actively monitor system telemetry, abuse reports, and abnormal usage patterns.",
          "Violation of this AUP may result in immediate suspension or termination of your services without prior notice or refund.",
          "To report abuse or policy violations, please email abuse@premiumfast.net or support@premiumfast.net.",
        ],
      },
      {
        title: "6. Policy Revisions",
        content: [
          "PT. Premium Fast Network reserves the right to modify this AUP at any time. Continued use of the platform after modifications constitutes acceptance of the revised policy.",
        ],
      },
    ],
  },
}

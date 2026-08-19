---
path: /whatsapp/api-keys
title: WhatsApp API Key Management & Integration Guide
category: WhatsApp
purpose: Generate, rotate, and securely use your organization's static WhatsApp API key to integrate with the WhatsApp Business Platform.
howTo:
  - "Navigate to Console > WhatsApp > API Key (/console/whatsapp/api-keys)."
  - "Click Generate API key and copy the one-time API secret immediately."
  - "Store the secret in your password manager or backend environment vault."
  - "Authenticate requests using the Authorization: Bearer <API_KEY> header."
notes:
  - The plaintext API secret is displayed only once upon creation or rotation.
  - Each organization has at most one ACTIVE key at a time.
  - Key rotation immediately invalidates the previous API key.
---

# WhatsApp API Key Management & Integration Guide

This guide explains how to generate, rotate, and securely use your organization's static WhatsApp API key to integrate with the WhatsApp Business Platform APIs.

---

## 1. Overview & Security Model

The WhatsApp API key allows backend services to authenticate API requests on behalf of your organization.

- **Zero-Trust Token Visibility**: The plaintext API secret is **displayed only once** upon creation or rotation. It is never stored in plaintext and cannot be retrieved again once dismissed.
- **Single Active Key Model**: Each organization has at most one `ACTIVE` key at a time.
- **Safe Metadata**: Fingerprints (`wa_key_...`) and lifecycle timestamps (Created, Rotated, Revoked, Last Used) can be safely shared for auditing without exposing secret material.

---

## 2. Generating Your API Key

### Step 1: Navigate to API Keys Console
Go to **Console** > **WhatsApp** > **API Key** (`/console/whatsapp/api-keys`).

If your organization does not yet have an active API key, the status badge will indicate **Not generated**.

![Initial Not Generated State](/kb-assets/whatsapp/api-keys/01-initial-empty-state.png)

---

### Step 2: Generate the API Key
1. Click the **"Generate API key"** button.
2. The system immediately provisions the key and presents the **One-time API secret** banner.
3. Click **"Copy secret"** to copy your secret key to your password manager or environment secrets vault.

![Key Generated with One-Time Secret](/kb-assets/whatsapp/api-keys/02-key-generated-with-secret.png)

> ⚠️ **Important:**
> Once you navigate away or refresh the page, the secret cannot be shown again. If you lose the secret, you must rotate the key.

---

## 3. Key Lifecycle Management

### Rotating an API Key
If you suspect your key has been leaked or your security policy requires periodic rotation:
1. Click **"Rotate API key"**.
2. Read the confirmation dialog: **The current key will stop working immediately**.
3. Confirm rotation to generate a new key and receive a fresh one-time secret.

![Rotate API Key Confirmation Dialog](/kb-assets/whatsapp/api-keys/03-rotate-key-dialog.png)

---

### Revoking an API Key
To immediately terminate all API access without issuing a replacement key:
1. Click **"Revoke API key"**.
2. Confirm the revocation dialog.
3. The key status switches to **Revoked**, and incoming requests using this key will receive `401 Unauthorized`.

![Revoke API Key Confirmation Dialog](/kb-assets/whatsapp/api-keys/04-revoke-key-dialog.png)

---

## 4. Authenticating API Requests

To authenticate requests to the WhatsApp API endpoints, provide your API key in standard `Authorization: Bearer <API_KEY>` header or `x-api-key` header.

### Example: Checking WhatsApp Devices Status

Verify your API key and inspect connected WhatsApp phone numbers and device health:

```bash
curl -X GET "https://api.pfnapp.my.id/api/whatsapp/devices/" \
  -H "Authorization: Bearer pfn_wa_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### OpenAPI Specification & SDK Reference
For detailed request/response schemas, query parameters, error codes, and SDK generation, refer to the interactive OpenAPI documentation:
- [WhatsApp Devices OpenAPI Reference](/api/openapi#tag/whatsapp-devices/GET/api/whatsapp/devices/)

---

## 5. Audit & Compliance

All API key lifecycle events are recorded in the immutable audit log:
- `ORGANIZATION_API_KEY_GENERATED`
- `ORGANIZATION_API_KEY_ROTATED`
- `ORGANIZATION_API_KEY_REVOKED`

Organization administrators can view historical activity and fingerprint records under the **Audit Logs** tab in the management console.

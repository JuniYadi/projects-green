# WhatsApp

Sending WhatsApp template messages to customers, one at a time or as broadcasts to many recipients at once, plus the address book and devices that support that.

## Language

**Broadcast**:
A single send operation that delivers one WhatsApp template, in one language, to a list of recipients. Modeled in code as `WhatsappBroadcastCampaign`.
_Avoid_: Campaign (on its own), blast, batch.

**Recipient**:
One phone number's participation in a specific broadcast, along with whatever personalized values it carries for that send. Modeled as `WhatsappBroadcastRecipient`. Scoped to a single broadcast — it doesn't exist before the broadcast is created or outlive it.
_Avoid_: Number, target, contact (when the row is broadcast-scoped, not address-book-scoped).

**Contact**:
A saved address-book entry (phone, name, optional custom fields) that's reusable across broadcasts. Selecting contacts for a broadcast turns each one into a Recipient.
_Avoid_: Recipient (before it's attached to a broadcast).

**Personalization**:
Giving a Recipient its own values for the template's placeholders instead of every Recipient sharing one value. Stored as `dynamicValues` on a Recipient or Contact; any placeholder a Recipient doesn't set falls back to the broadcast's Default Values.
_Avoid_: Merge fields, custom variables.

**Template Variable**:
A numbered placeholder in a WhatsApp template body (`{{1}}`, `{{2}}`, ...), always sequential starting at 1.
_Avoid_: Merge field, parameter (that's what a *resolved* variable is called once it's turned into text for sending).

**Default Values**:
The one set of variable values entered in a broadcast's Template Variables step. Stored as `templateParams` on the broadcast. Serves two roles depending on Recipient Entry Mode: the entire message content for every Recipient (Manual Input), or a fallback for whichever Template Variables a personalized Recipient hasn't set (Select Contacts / Upload CSV).
_Avoid_: Global variables, shared variables.

## Recipient Entry Modes

A broadcast's recipients come from exactly one of three mutually exclusive modes — a broadcast doesn't mix them:

- **Manual Input**: free-text phone numbers, nothing else. Every Recipient added this way gets the broadcast's Default Values — it cannot personalize.
- **Select Contacts**: pick existing Contacts; each becomes a Recipient carrying that Contact's `dynamicValues`.
- **Upload CSV**: a file whose extra columns (beyond phone/name) become each row's `dynamicValues`, personalizing per Recipient.

Personalization is only possible through Select Contacts or Upload CSV — see [[0002-whatsapp-broadcast-manual-input-no-personalization]] for why Manual Input deliberately doesn't support it.

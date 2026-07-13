# End-To-End Whatsapp Issue

Track every issue below, mark done if finished, and add new issue if found.

## Issue with Open Status

- At User Side at Page /console

| Page | Issue | Target | Status |
| --- | --- | --- | -- |
| /console/whatsapp/templates/cmqr5s303001dkh4c9dvx270q | Template Preview not show like whatsapp message | Make the template like whatsapp message design, so user can understand how the look like, example button must be in multi line, there is example parameter that filled , also the variant langauge indicator including the flags , and not just pill button like now | Done |
| /console/whatsapp/messages | Same like in template, outbox message not using same template preview | Make email outbox same like template. so user not confusing | Done | 
| /console/whatsapp/messages | On the message only show date , there is no tooltip when message send | Make date can be tooltip using user local browser timezone | Done | 
| /console/whatsapp/messages | There is big text "Converstations" and search, just delete it | Delete text so search text can be large | Done |
| /console/whatsapp/templates | There is no indicator what filter is. the filter only show "All" what is "All" ? no mention what is that | Every filter must have indicator, Example "All" become "All Status" , etc | Done |
| /console/whatsapp/templates | Make table more compact | like language can be in template name with pill and country icon , Sync icon like dot color, approved too , hide column creation date by default, but user can show it later on | Done | 
| /console/whatsapp/devices | The table it's show not like other table, there is no filter here, like filter name or phone, filter status, filter if it's active. it's good for 1-2 devices, but if user has a lot devices, that will be confused | add filter based on the issue | Done |

## Issue with Complete Status
| /console/whatsapp/dashboard | There is card "Send Template Message" "Manage Templates" "View Contacts" That not needed | Remove the card "Send Template Message" "Manage Templates" "View Contacts" | Done |
| /console/whatsapp/usage | Blank white page error from icon | Fix icon on client side rendering — removed phosphor icons from loading.tsx (Server Component), replaced with Skeleton placeholders | Done |
| /console/whatsapp/template | Template sync only focus on body, there is other component like header, footer, button, media, etc | When sync template, it should sync all component of the template | Done |
| /console/whatsapp/templates/cmqr5s303001dkh4c9dvx270q | Missing footer component , button component | Added headerUrl extraction in sync worker; template-detail.tsx now displays footer text and buttons | Done |
| /console/whatsapp/messages | New message show an modal, but its too long to scroll. And if i'm only have a single device, i need select it again and again | Make new modal bigger, left is selection, right is preview message. If only have a single device, auto select it and hide the selection. Put target number at the top of field input , not below it | Done |
| /console/whatsapp/usage | A lot static card and widget here, but no data return , API Cost Breakdown error 500 | When sending a message, this page should show the cost of sending message, and the usage of whatsapp api. If no data, show empty state with link to docs. Fix API Cost Breakdown error 500 | Done |
| /console/whatsapp/contacts | When user send a message, the contact list not update | When user send a message, the contact list should update with new contact. If the contact already exist, update the last message and last message time. If not exist, add new contact to the list. If message sent is success from webhook, mark this contact isActiveWhatsappNumber (the idea to indicate if this contact active whatsapp, check if we have existing on table or not) | Done |
| /console/whatsapp/webhook-logs , /console/whatsapp/audit-logs | The page size is diffrent with other page | The page size should be same across page | Done |
| /console/whatsapp/templates | The template does not show any category | The template should show category, and filter by category, create or sync | Done | 
| /console/whatsapp/usage | When sending the message, the quota not reduce based on category | When sending the message, the quota should reduce : MARKETING = 2 Quota Credit, AUTHENTICATION = 1,25 Quota Credit, UTILLITY = 1 Quota Credit, Reply = 1 Quota Credit, full detail below | Done |
| /console/whatsapp/templates | Missing Creation Date and Last Updated Date | The template should show Creation Date and Last Updated Date | Done |
| /console/whatsapp/messages | There is no normalize phone number for local indonesia, so when i type 085708296482 it become +085708296482 | When sending message, the phone number should be normalize to +6285708296482 for local indonesia number that start with 08 or 62, in form user can input with +62 or just 08 | Done |
| /console/whatsapp/messages | When model pop up and user select the template, the template selection must be hide after click,  user confusing because it need to scroll to fill, and need to scroll up again for review the result | make template hide selection and show only selected template, then add a button "Change Template" to show the selection again | Done |
| /console/whatsapp/messages | When selecting a message, and the 24 hour window is close, there is no option to direct send template | add options that trigger "Send a Message" and the modal will prefill the phone number, so user can focus select template and fill it | Done |
| /console/whatsapp/usage | Loading skeleton show 4 card , but real card is 8 | Make loading sekeleton just loading on the value not on the card | Done |

## Whatsapp Quota Credit Rules

1. Apply for indonesia number only
2. We should have table to store it, because it will update in future, so we can update the table without change the code. The table should have 3 columns : category, quota_credit, country, description.
3. The quota credit should be reduce based on the category of the message, and the country of the number. The category can be : MARKETING, AUTHENTICATION, UTILITY, REPLY. The country can be : ID, US, SG, MY, PH, TH, VN, etc. The description can be : "Marketing message", "Authentication message", "Utility message", "Reply message". The quota credit can be : 2, 1.25, 1, 1. The default quota credit is 1.
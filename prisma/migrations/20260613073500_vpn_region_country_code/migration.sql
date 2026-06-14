-- Rename VpnRegion.flagEmoji to countryCode (stores an ISO country code, e.g. "id").
ALTER TABLE "VpnRegion" RENAME COLUMN "flagEmoji" TO "countryCode";

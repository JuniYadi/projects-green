-- noqa: disable=LT01
-- CreateTable
CREATE TABLE "AiAgentProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Tanya P',
    "description" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "fallbackMessage" TEXT NOT NULL DEFAULT 'Maaf, pertanyaan Anda akan kami teruskan ke tim CS kami.',
    "dailyUserLimit" INTEGER NOT NULL DEFAULT 20,
    "maxCharLength" INTEGER NOT NULL DEFAULT 800,
    "enableProfanityFilter" BOOLEAN NOT NULL DEFAULT true,
    "customBlockedWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enableIpProtection" BOOLEAN NOT NULL DEFAULT true,
    "strikeEscalation" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKnowledgeDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "agentProfileId" TEXT,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "sourceType" TEXT NOT NULL DEFAULT 'PDF',
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "errorMessage" TEXT,
    "contentMarkdown" TEXT,
    "contentHash" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "parentChunkId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "howTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "searchText" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiChannelBinding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentProfileId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "customSystemPrompt" TEXT,
    "customDailyUserLimit" INTEGER,
    "customBlockedWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiChannelBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiChatSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "organizationId" TEXT,
    "agentProfileId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'CONSOLE',
    "channelTargetId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "customerPhone" TEXT,
    "externalUserId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "strikeCount" INTEGER NOT NULL DEFAULT 0,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "routePath" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "responseTokens" INTEGER NOT NULL DEFAULT 0,
    "modelName" TEXT,
    "durationMs" INTEGER,
    "citations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiChatBan" (
    "id" TEXT NOT NULL,
    "banType" TEXT NOT NULL DEFAULT 'ORGANIZATION',
    "targetValue" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "ipAddress" TEXT,
    "customerPhone" TEXT,
    "offenseLevel" INTEGER NOT NULL DEFAULT 1,
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,
    "blockedUntil" TIMESTAMP(3),
    "reason" TEXT,
    "strikeSnapshot" INTEGER NOT NULL DEFAULT 0,
    "pardonedAt" TIMESTAMP(3),
    "pardonedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiChatBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProviderConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "baseUrl" TEXT,
    "defaultModel" TEXT NOT NULL,
    "vaultPath" TEXT NOT NULL,
    "vaultKey" TEXT NOT NULL DEFAULT 'API_KEY',
    "isConfigured" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAgentProfile_organizationId_isActive_idx" ON "AiAgentProfile"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "AiKnowledgeDocument_agentProfileId_idx" ON "AiKnowledgeDocument"("agentProfileId");

-- CreateIndex
CREATE INDEX "AiKnowledgeDocument_organizationId_status_idx" ON "AiKnowledgeDocument"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AiChannelBinding_organizationId_channel_idx" ON "AiChannelBinding"("organizationId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "AiChannelBinding_channel_targetId_key" ON "AiChannelBinding"("channel", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "AiChatSession_sessionId_key" ON "AiChatSession"("sessionId");

-- CreateIndex
CREATE INDEX "AiChatSession_organizationId_createdAt_idx" ON "AiChatSession"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatSession_agentProfileId_createdAt_idx" ON "AiChatSession"("agentProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatSession_channel_channelTargetId_idx" ON "AiChatSession"("channel", "channelTargetId");

-- CreateIndex
CREATE INDEX "AiChatSession_customerPhone_createdAt_idx" ON "AiChatSession"("customerPhone", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatSession_ipAddress_createdAt_idx" ON "AiChatSession"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatMessage_sessionId_createdAt_idx" ON "AiChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatMessage_isFlagged_createdAt_idx" ON "AiChatMessage"("isFlagged", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatBan_banType_targetValue_isPermanent_blockedUntil_idx" ON "AiChatBan"("banType", "targetValue", "isPermanent", "blockedUntil");

-- CreateIndex
CREATE INDEX "AiChatBan_organizationId_isPermanent_blockedUntil_idx" ON "AiChatBan"("organizationId", "isPermanent", "blockedUntil");

-- CreateIndex
CREATE INDEX "AiChatBan_ipAddress_isPermanent_blockedUntil_idx" ON "AiChatBan"("ipAddress", "isPermanent", "blockedUntil");

-- CreateIndex
CREATE INDEX "AiChatBan_userId_isPermanent_blockedUntil_idx" ON "AiChatBan"("userId", "isPermanent", "blockedUntil");

-- CreateIndex
CREATE INDEX "AiProviderConfig_organizationId_isDefault_idx" ON "AiProviderConfig"("organizationId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "AiProviderConfig_organizationId_name_key" ON "AiProviderConfig"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "AiKnowledgeDocument" ADD CONSTRAINT "AiKnowledgeDocument_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AiAgentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChannelBinding" ADD CONSTRAINT "AiChannelBinding_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AiAgentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatSession" ADD CONSTRAINT "AiChatSession_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AiAgentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiChatSession"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "SupportTicketDepartment" AS ENUM (
  'BILLING',
  'TECHNICAL',
  'ACCOUNT',
  'COMPLIANCE'
);

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED'
);

-- CreateTable
CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "ticketNumber" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requesterWorkosUserId" TEXT NOT NULL,
  "assignedAgentWorkosUserId" TEXT,
  "department" "SupportTicketDepartment" NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "subject" TEXT NOT NULL,
  "description" TEXT,
  "attachmentsJson" JSONB,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketReply" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorWorkosUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isInternalNote" BOOLEAN NOT NULL DEFAULT false,
  "attachmentsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportTicketReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"(
  "ticketNumber"
);

-- CreateIndex
CREATE INDEX "SupportTicket_organizationId_createdAt_idx" ON "SupportTicket"(
  "organizationId",
  "createdAt" DESC
);

-- CreateIndex
CREATE INDEX "SupportTicket_organizationId_status_idx" ON "SupportTicket"(
  "organizationId",
  "status"
);

-- CreateIndex
CREATE INDEX "SupportTicket_requesterWorkosUserId_idx" ON "SupportTicket"(
  "requesterWorkosUserId"
);

-- CreateIndex
CREATE INDEX "SupportTicket_assignedAgentWorkosUserId_idx" ON "SupportTicket"(
  "assignedAgentWorkosUserId"
);

-- CreateIndex
CREATE INDEX "SupportTicket_department_idx" ON "SupportTicket"(
  "department"
);

-- CreateIndex
CREATE INDEX "SupportTicketReply_ticketId_createdAt_idx" ON "SupportTicketReply"(
  "ticketId",
  "createdAt"
);

-- CreateIndex
CREATE INDEX "SupportTicketReply_authorWorkosUserId_idx" ON "SupportTicketReply"(
  "authorWorkosUserId"
);

-- CreateIndex
CREATE INDEX "SupportTicketReply_isInternalNote_idx" ON "SupportTicketReply"(
  "isInternalNote"
);

-- AddForeignKey
ALTER TABLE "SupportTicketReply"
ADD CONSTRAINT "SupportTicketReply_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

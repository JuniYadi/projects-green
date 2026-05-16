-- CreateTable
CREATE TABLE "GithubInstallStateNonce" (
    "id" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "workosUserId" TEXT NOT NULL,
    "organizationId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubInstallStateNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubInstallStateNonce_nonceHash_key" ON "GithubInstallStateNonce"("nonceHash");

-- CreateIndex
CREATE INDEX "GithubInstallStateNonce_expiresAt_idx" ON "GithubInstallStateNonce"("expiresAt");

-- CreateIndex
CREATE INDEX "GithubInstallStateNonce_workosUserId_idx" ON "GithubInstallStateNonce"("workosUserId");

-- CreateIndex
CREATE INDEX "GithubInstallStateNonce_organizationId_idx" ON "GithubInstallStateNonce"("organizationId");

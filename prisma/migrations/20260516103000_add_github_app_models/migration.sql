-- CreateTable
CREATE TABLE "GithubInstallation" (
    "id" TEXT NOT NULL,
    "githubInstallationId" BIGINT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" BIGINT,
    "workosUserId" TEXT NOT NULL,
    "organizationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "permissionsJson" JSONB,
    "eventsSubscribed" JSONB,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubRepositoryConnection" (
    "id" TEXT NOT NULL,
    "githubRepositoryId" BIGINT NOT NULL,
    "installationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "ownerLogin" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "defaultBranch" TEXT,
    "isPrivate" BOOLEAN NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "branchFilters" TEXT[] DEFAULT ARRAY['main']::TEXT[],
    "rootDirectory" TEXT NOT NULL DEFAULT '/',
    "buildConfigJson" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubRepositoryConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubInstallation_githubInstallationId_key" ON "GithubInstallation"("githubInstallationId");

-- CreateIndex
CREATE INDEX "GithubInstallation_workosUserId_idx" ON "GithubInstallation"("workosUserId");

-- CreateIndex
CREATE INDEX "GithubInstallation_organizationId_idx" ON "GithubInstallation"("organizationId");

-- CreateIndex
CREATE INDEX "GithubInstallation_accountLogin_idx" ON "GithubInstallation"("accountLogin");

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepositoryConnection_githubRepositoryId_installationId_key" ON "GithubRepositoryConnection"("githubRepositoryId", "installationId");

-- CreateIndex
CREATE INDEX "GithubRepositoryConnection_installationId_idx" ON "GithubRepositoryConnection"("installationId");

-- CreateIndex
CREATE INDEX "GithubRepositoryConnection_fullName_idx" ON "GithubRepositoryConnection"("fullName");

-- AddForeignKey
ALTER TABLE "GithubRepositoryConnection" ADD CONSTRAINT "GithubRepositoryConnection_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GithubInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

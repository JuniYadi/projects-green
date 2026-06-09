import { describe, expect, it } from "bun:test"

import { normalizeGithubWebhookPayload } from "./github-event-normalizer"

const pushPayload = {
  ref: "refs/heads/main",
  repository: {
    id: 987654321,
    full_name: "acme/checkout-api",
    name: "checkout-api",
    owner: { login: "acme" },
  },
  installation: { id: 123456 },
  head_commit: {
    id: "abcdef1234567890",
    message: "feat: add checkout webhook",
    url: "https://github.com/acme/checkout-api/commit/abcdef1234567890",
    author: { name: "Ada Lovelace", email: "ada@example.com" },
  },
  sender: {
    login: "ada",
    avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
  },
}

const installationPayload = {
  action: "created",
  installation: { id: 222222 },
  repositories: [{ id: 111, full_name: "acme/docs" }],
  sender: { login: "octocat" },
}

describe("normalizeGithubWebhookPayload", () => {
  it("extracts repository, branch, commit, sender, and installation fields from push payloads", () => {
    expect(normalizeGithubWebhookPayload(pushPayload)).toEqual({
      githubInstallationId: BigInt(123456),
      githubRepositoryId: BigInt(987654321),
      repositoryFullName: "acme/checkout-api",
      repositoryOwner: "acme",
      repositoryName: "checkout-api",
      ref: "refs/heads/main",
      branch: "main",
      commitSha: "abcdef1234567890",
      commitMessage: "feat: add checkout webhook",
      commitAuthorName: "Ada Lovelace",
      commitAuthorEmail: "ada@example.com",
      commitUrl: "https://github.com/acme/checkout-api/commit/abcdef1234567890",
      senderLogin: "ada",
      senderAvatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
    })
  })

  it("returns nulls for fields missing on non-push payloads", () => {
    expect(normalizeGithubWebhookPayload(installationPayload)).toEqual({
      githubInstallationId: BigInt(222222),
      githubRepositoryId: null,
      repositoryFullName: null,
      repositoryOwner: null,
      repositoryName: null,
      ref: null,
      branch: null,
      commitSha: null,
      commitMessage: null,
      commitAuthorName: null,
      commitAuthorEmail: null,
      commitUrl: null,
      senderLogin: "octocat",
      senderAvatarUrl: null,
    })
  })
})

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveInstallationId } from "../get-bot-token.mjs";

test("resolveInstallationId: uses the repo installation endpoint when repo context is available", async () => {
  const seenPaths = [];
  const installationId = await resolveInstallationId(
    async (path) => {
      seenPaths.push(path);
      return { id: 42 };
    },
    "jwt",
    "taskcore/taskcore",
    "taskcore",
  );

  assert.equal(installationId, 42);
  assert.deepEqual(seenPaths, ["/repos/khulnasoft/taskcore/installation"]);
});

test("resolveInstallationId: falls back to the matching owner installation", async () => {
  const installationId = await resolveInstallationId(
    async () => [
      { id: 1, account: { login: "someone-else" } },
      { id: 7, account: { login: "taskcore" } },
    ],
    "jwt",
    undefined,
    "taskcore",
  );

  assert.equal(installationId, 7);
});

test("resolveInstallationId: rejects ambiguous installations without repo or owner context", async () => {
  await assert.rejects(
    resolveInstallationId(
      async () => [
        { id: 1, account: { login: "org-one" } },
        { id: 2, account: { login: "org-two" } },
      ],
      "jwt",
    ),
    /Multiple commitperclip installations found/,
  );
});

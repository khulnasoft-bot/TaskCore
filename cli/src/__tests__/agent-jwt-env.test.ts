import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureAgentJwtSecret,
  ensureToolActionSigningSecret,
  mergeTaskcoreEnvEntries,
  readAgentJwtSecretFromEnv,
  readTaskcoreEnvEntries,
  resolveAgentJwtEnvFile,
} from "../config/env.js";
import { agentJwtSecretCheck } from "../checks/agent-jwt-secret-check.js";

const ORIGINAL_ENV = { ...process.env };

function tempConfigPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskcore-jwt-env-"));
  const configDir = path.join(dir, "custom");
  fs.mkdirSync(configDir, { recursive: true });
  return path.join(configDir, "config.json");
}

describe("agent jwt env helpers", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.TASKCORE_AGENT_JWT_SECRET;
    delete process.env.TASKCORE_TOOL_ACTION_SIGNING_SECRET;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("writes .env next to explicit config path", () => {
    const configPath = tempConfigPath();
    const result = ensureAgentJwtSecret(configPath);

    expect(result.created).toBe(true);

    const envPath = resolveAgentJwtEnvFile(configPath);
    expect(fs.existsSync(envPath)).toBe(true);
    const contents = fs.readFileSync(envPath, "utf-8");
    expect(contents).toContain("TASKCORE_AGENT_JWT_SECRET=");
  });

  it("creates an independent tool-action signing secret next to the config", () => {
    const configPath = tempConfigPath();
    const result = ensureToolActionSigningSecret(configPath);

    expect(result.created).toBe(true);
    expect(result.secret).toHaveLength(64);
    const entries = readTaskcoreEnvEntries(resolveAgentJwtEnvFile(configPath));
    expect(entries.TASKCORE_TOOL_ACTION_SIGNING_SECRET).toBe(result.secret);
    expect(entries.TASKCORE_AGENT_JWT_SECRET).toBeUndefined();
  });

  it("loads secret from .env next to explicit config path", () => {
    const configPath = tempConfigPath();
    const envPath = resolveAgentJwtEnvFile(configPath);
    fs.writeFileSync(envPath, "TASKCORE_AGENT_JWT_SECRET=test-secret\n", {
      mode: 0o600,
    });

    const loaded = readAgentJwtSecretFromEnv(configPath);
    expect(loaded).toBe("test-secret");
    expect(process.env.TASKCORE_AGENT_JWT_SECRET).toBe("test-secret");
  });

  it("doctor check passes when secret exists in adjacent .env", () => {
    const configPath = tempConfigPath();
    const envPath = resolveAgentJwtEnvFile(configPath);
    fs.writeFileSync(envPath, "TASKCORE_AGENT_JWT_SECRET=check-secret\n", {
      mode: 0o600,
    });

    const result = agentJwtSecretCheck(configPath);
    expect(result.status).toBe("pass");
  });

  it("quotes hash-prefixed env values so dotenv round-trips them", () => {
    const configPath = tempConfigPath();
    const envPath = resolveAgentJwtEnvFile(configPath);

    mergeTaskcoreEnvEntries(
      {
        TASKCORE_WORKTREE_COLOR: "#439edb",
      },
      envPath,
    );

    const contents = fs.readFileSync(envPath, "utf-8");
    expect(contents).toContain('TASKCORE_WORKTREE_COLOR="#439edb"');
    expect(readTaskcoreEnvEntries(envPath).TASKCORE_WORKTREE_COLOR).toBe(
      "#439edb",
    );
  });

  it("preserves operator content and CRLF while updating only managed entries", () => {
    const configPath = tempConfigPath();
    const envPath = resolveAgentJwtEnvFile(configPath);
    const original = [
      "# operator comment",
      "DATABASE_URL='postgres://operator:encoded@localhost/taskcore'",
      "",
      "export TASKCORE_HOME = '/old path'  # managed path",
      "TASKCORE_DUPLICATE=stale",
      'TASKCORE_DUPLICATE="current"',
      "UNKNOWN_VALUE=operator-owned",
      "",
    ].join("\r\n");
    fs.writeFileSync(envPath, original, { mode: 0o600 });

    mergeTaskcoreEnvEntries(
      {
        TASKCORE_HOME: "/new path",
        TASKCORE_DUPLICATE: "current",
        TASKCORE_WORKTREE_COLOR: "#439edb",
        DATABASE_URL: "postgres://taskcore-must-not-overwrite",
      },
      envPath,
    );

    const updated = fs.readFileSync(envPath, "utf8");
    expect(updated).toBe(
      [
        "# operator comment",
        "DATABASE_URL='postgres://operator:encoded@localhost/taskcore'",
        "",
        'export TASKCORE_HOME = "/new path"  # managed path',
        "TASKCORE_DUPLICATE=current",
        'TASKCORE_DUPLICATE="current"',
        "UNKNOWN_VALUE=operator-owned",
        'TASKCORE_WORKTREE_COLOR="#439edb"',
        "",
      ].join("\r\n"),
    );
    expect(updated.replaceAll("\r\n", "")).not.toContain("\n");
  });

  it("does not replace the env file when managed values are already current", () => {
    const configPath = tempConfigPath();
    const envPath = resolveAgentJwtEnvFile(configPath);
    const original = [
      "# preserve this file byte-for-byte",
      "export TASKCORE_HOME = '/same path'",
      'UNKNOWN="operator encoding"',
      "",
    ].join("\n");
    fs.writeFileSync(envPath, original, { mode: 0o600 });
    const previousInode = fs.statSync(envPath).ino;

    mergeTaskcoreEnvEntries({ TASKCORE_HOME: "/same path" }, envPath);

    expect(fs.readFileSync(envPath, "utf8")).toBe(original);
    expect(fs.statSync(envPath).ino).toBe(previousInode);
  });
});

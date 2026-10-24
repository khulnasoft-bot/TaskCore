import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listCodexSkills,
  syncCodexSkills,
} from "@taskcore/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("codex local skill sync", () => {
  const taskcoreKey = "taskcore/taskcore/taskcore";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("defaults the operational Taskcore skill for workspace injection on the next run", async () => {
    const codexHome = await makeTempDir("taskcore-codex-skill-sync-");
    cleanupDirs.add(codexHome);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
      },
    } as const;

    const before = await listCodexSkills(ctx);
    expect(before.mode).toBe("ephemeral");
    expect(before.desiredSkills).toContain(taskcoreKey);
    expect(before.entries.find((entry) => entry.key === taskcoreKey)?.state).toBe("configured");
    expect(before.entries.find((entry) => entry.key === taskcoreKey)?.detail).toContain("CODEX_HOME/skills/");
  });

  it("does not apply the legacy operational skill default to the native runner", async () => {
    const snapshot = await listCodexSkills({
      agentId: "agent-native",
      companyId: "company-1",
      adapterType: "taskcore_runner",
      config: {},
    });

    expect(snapshot.adapterType).toBe("taskcore_runner");
    expect(snapshot.desiredSkills).toEqual([]);
    expect(snapshot.entries.find((entry) => entry.key === taskcoreKey)?.state).toBe("available");
  });

  it("does not persist Taskcore skills into CODEX_HOME during sync", async () => {
    const codexHome = await makeTempDir("taskcore-codex-skill-prune-");
    cleanupDirs.add(codexHome);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        taskcoreSkillSync: {
          desiredSkills: [taskcoreKey],
        },
      },
    } as const;

    const after = await syncCodexSkills(configuredCtx, [taskcoreKey]);
    expect(after.mode).toBe("ephemeral");
    expect(after.entries.find((entry) => entry.key === taskcoreKey)?.state).toBe("configured");
    await expect(fs.lstat(path.join(codexHome, "skills", "taskcore"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("normalizes legacy flat Taskcore skill refs before reporting configured state", async () => {
    const codexHome = await makeTempDir("taskcore-codex-legacy-skill-sync-");
    cleanupDirs.add(codexHome);

    const snapshot = await listCodexSkills({
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        taskcoreSkillSync: {
          desiredSkills: ["taskcore"],
        },
      },
    });

    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.desiredSkills).toContain(taskcoreKey);
    expect(snapshot.desiredSkills).not.toContain("taskcore");
    expect(snapshot.entries.find((entry) => entry.key === taskcoreKey)?.state).toBe("configured");
    expect(snapshot.entries.find((entry) => entry.key === "taskcore")).toBeUndefined();
  });
});

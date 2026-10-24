import { describe, expect, it } from "vitest";
import {
  normalizeTaskcoreOperationalSkillPreference,
  normalizeTaskcoreRunnerAdapterConfig,
  TASKCORE_OPERATIONAL_SKILL_KEY,
  resolveLegacyTaskcoreDesiredSkillNames,
} from "@taskcore/adapter-utils/server-utils";

const legacyConfig = {
  taskcoreSkillSync: {
    desiredSkills: [TASKCORE_OPERATIONAL_SKILL_KEY],
  },
};

describe("taskcore_runner operational skill normalization", () => {
  it("applies full-auto native runner defaults at persistence boundaries", () => {
    expect(normalizeTaskcoreRunnerAdapterConfig("taskcore_runner", {})).toEqual({
      provider: "codex",
      model: "gpt-5.6-sol",
      codexPermissionMode: "never",
      lifecycleMode: "per_turn",
    });
  });

  it("repairs an existing blank model without replacing an explicit model", () => {
    expect(normalizeTaskcoreRunnerAdapterConfig("taskcore_runner", { model: "" }))
      .toMatchObject({ model: "gpt-5.6-sol" });
    expect(normalizeTaskcoreRunnerAdapterConfig("taskcore_runner", { model: "gpt-5.5" }))
      .toMatchObject({ model: "gpt-5.5" });
  });

  it("does not replace a non-Codex provider model with the Codex default", () => {
    expect(normalizeTaskcoreRunnerAdapterConfig("taskcore_runner", {
      provider: "claude_managed",
      model: "claude-sonnet-5",
    })).toMatchObject({
      provider: "claude_managed",
      model: "claude-sonnet-5",
    });
  });

  it("removes the legacy operational skill while preserving optional skills", () => {
    const normalized = normalizeTaskcoreOperationalSkillPreference("taskcore_runner", {
      taskcoreSkillSync: {
        desiredSkills: [TASKCORE_OPERATIONAL_SKILL_KEY, "company-1/reviewer"],
      },
    });

    expect(normalized).toEqual({
      taskcoreSkillSync: { desiredSkills: ["company-1/reviewer"] },
    });
  });

  it("restores the required operational skill through the legacy resolver after switching back", () => {
    const normalized = normalizeTaskcoreOperationalSkillPreference("taskcore_runner", legacyConfig);
    expect(resolveLegacyTaskcoreDesiredSkillNames(normalized, [{
      key: TASKCORE_OPERATIONAL_SKILL_KEY,
      runtimeName: "taskcore",
    }])).toEqual([TASKCORE_OPERATIONAL_SKILL_KEY]);
  });

  it("does not change direct adapter preferences", () => {
    expect(normalizeTaskcoreOperationalSkillPreference("codex_local", legacyConfig)).toBe(legacyConfig);
  });
});

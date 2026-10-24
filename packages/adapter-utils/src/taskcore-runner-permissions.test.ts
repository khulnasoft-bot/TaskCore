import { describe, expect, it } from "vitest";

import {
  TASKCORE_RUNNER_DEFAULT_MODELS,
  taskcoreRunnerTransitionConfig,
  isTaskcoreRunnerProvider,
  resolveTaskcoreRunnerModel,
  resolveTaskcoreRunnerPermissionMode,
} from "./taskcore-runner-permissions.js";

describe("Taskcore Runner permission defaults", () => {
  it("defaults Codex to the only qualified non-interactive mode", () => {
    expect(resolveTaskcoreRunnerPermissionMode("codex", undefined)).toBe(
      "never",
    );
    expect(resolveTaskcoreRunnerPermissionMode("codex", "on-request")).toBe(
      "never",
    );
    expect(resolveTaskcoreRunnerPermissionMode("codex", "untrusted")).toBe(
      "never",
    );
  });

  it("defaults Claude and OpenCode to full auto", () => {
    expect(resolveTaskcoreRunnerPermissionMode("opencode", undefined)).toBe(
      "allow",
    );
    expect(resolveTaskcoreRunnerPermissionMode("acpx", undefined)).toBe(
      "approve-all",
    );
  });

  it.each(["approve-taskcore", "approve-reads", "deny-all", "approve-all"])(
    "preserves explicit Claude %s settings",
    (mode) => {
      expect(resolveTaskcoreRunnerPermissionMode("acpx", mode)).toBe(mode);
    },
  );

  it.each([
    ["claude_local", "acpxPermissionMode", "approve-all"],
    ["codex_local", "codexPermissionMode", "never"],
    ["opencode_local", "opencodePermissionMode", "allow"],
  ])(
    "uses full auto when converting %s to the new runner",
    (adapter, key, value) => {
      expect(taskcoreRunnerTransitionConfig(adapter, undefined)).toMatchObject({
        [key]: value,
      });
    },
  );

  it("recognizes only exact provider identifiers", () => {
    expect(isTaskcoreRunnerProvider("codex")).toBe(true);
    expect(isTaskcoreRunnerProvider("opencode")).toBe(true);
    expect(isTaskcoreRunnerProvider("claude_managed")).toBe(true);
    expect(isTaskcoreRunnerProvider("aws_agentcore")).toBe(true);
    expect(isTaskcoreRunnerProvider("acpx")).toBe(true);
    expect(isTaskcoreRunnerProvider("toString")).toBe(false);
    expect(isTaskcoreRunnerProvider("__proto__")).toBe(false);
  });

  it("keeps managed provider permissions under the qualified profile", () => {
    expect(resolveTaskcoreRunnerPermissionMode("claude_managed", "never")).toBe(
      "provider-managed",
    );
    expect(
      resolveTaskcoreRunnerPermissionMode("aws_agentcore", "approve-all"),
    ).toBe("provider-managed");
  });

  it("uses the Codex default for missing or blank models", () => {
    expect(resolveTaskcoreRunnerModel("codex", undefined)).toBe(
      TASKCORE_RUNNER_DEFAULT_MODELS.codex,
    );
    expect(resolveTaskcoreRunnerModel("codex", "   ")).toBe(
      TASKCORE_RUNNER_DEFAULT_MODELS.codex,
    );
  });

  it("preserves an explicit Codex model", () => {
    expect(resolveTaskcoreRunnerModel("codex", "gpt-5.5")).toBe("gpt-5.5");
    expect(resolveTaskcoreRunnerModel("codex", "  gpt-5.5  ")).toBe("gpt-5.5");
  });
});

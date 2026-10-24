import { describe, expect, it } from "vitest";
import { capabilityCanonicalOperationsForSurface } from "../../catalog/canonical-operations.js";

import {
  acpxRuntimePermissionPolicy,
  claudeTaskcorePermissionRules,
  decideAcpxPermission,
} from "./permission-policy.js";

describe("ACPX permission policy", () => {
  it.each(["approve-reads", "approve-taskcore"] as const)("allows assigned canonical live reads, including approval lookup, in %s", mode => {
    const reads = capabilityCanonicalOperationsForSurface("live").filter(action => action.sideEffectClass === "read");
    expect(reads.some(action => action.operationId === "get_approval")).toBe(true);
    for (const action of reads) {
      expect(claudeTaskcorePermissionRules([{ name: action.operationId }], mode)).toEqual([`mcp__taskcore__${action.operationId}`]);
    }
    expect(claudeTaskcorePermissionRules([{ name: "get_approval" }], "deny-all")).toEqual([]);
  });
  it("uses only catalogued reads assigned to this run, regardless of tool hints", () => {
    const tools = [
      "taskcore__get_task_context", "read_document", "write_document",
      "call_api", "request_approval", "unknown_read", "mcp__other__get_task_context",
    ].map((name) => ({ name, annotations: { readOnlyHint: true, effect: "read" } }));
    expect(claudeTaskcorePermissionRules(tools, "approve-reads")).toEqual([
      "mcp__taskcore__get_task_context", "mcp__taskcore__read_document",
    ]);
    expect(claudeTaskcorePermissionRules([], "approve-reads")).toEqual([]);
  });

  it("allows assigned Taskcore mutations without admitting unknown or external tools", () => {
    const tools = ["taskcore__write_document", "create_task", "reassign_task", "request_approval",
      "write_document", "mcp__other__create_task", "Bash", "unknown_write", "mcp__taskcore__create_task",
      "decide_approval", "control_workspace_service", "call_api", "create_skill", "schedule_wake"]
      .map(name => ({ name, annotations: { readOnlyHint: true } }));
    expect(claudeTaskcorePermissionRules(tools, "approve-taskcore")).toEqual([
      "mcp__taskcore__create_task", "mcp__taskcore__reassign_task",
      "mcp__taskcore__request_approval", "mcp__taskcore__write_document",
    ]);
    expect(claudeTaskcorePermissionRules([], "approve-taskcore")).toEqual([]);
    expect(claudeTaskcorePermissionRules(tools, "deny-all")).toEqual([]);
  });

  it("maps each configured mode to a closed ACP runtime policy", () => {
    expect(acpxRuntimePermissionPolicy("approve-all")).toEqual({
      defaultAction: "approve",
    });
    expect(acpxRuntimePermissionPolicy("deny-all")).toEqual({
      defaultAction: "deny",
    });
    expect(acpxRuntimePermissionPolicy("approve-taskcore")).toEqual({ defaultAction: "escalate" });
    expect(acpxRuntimePermissionPolicy("approve-reads")).toEqual({
      defaultAction: "escalate",
    });
  });

  it.each([
    ["approve-all", "execute", "allow_once"],
    ["approve-reads", "read", "delegate"],
    ["approve-reads", "search", "delegate"],
    ["approve-reads", "execute", "delegate"],
    ["approve-taskcore", "read", "delegate"],
    ["approve-taskcore", "write", "delegate"],
    ["approve-taskcore", "execute", "delegate"],
    ["deny-all", "read", "reject_once"],
  ] as const)("%s maps %s to %s", (mode, inferredKind, expected) => {
    expect(
      decideAcpxPermission("claude", mode, { inferredKind, raw: {} }),
    ).toBe(expected);
  });

  it("keeps deny-all closed against provider-supplied semantic metadata", () => {
    for (const [agent, raw] of [
      ["claude", { toolCall: { name: "mcp__taskcore__taskcore_finish" } }],
      ["claude", { toolCall: { rawInput: { serverName: "taskcore" } } }],
      [
        "codex",
        {
          _meta: { is_mcp_tool_approval: true },
          toolCall: { title: "MCP approval" },
        },
      ],
    ] as const) {
      expect(
        decideAcpxPermission(
          agent,
          "deny-all",
          { inferredKind: "execute", raw },
          { allConfiguredMcpServersAreRunnerOwned: true },
        ),
      ).toBe("reject_once");
    }
  });

  it.each(["approve-reads", "approve-taskcore"] as const)("does not let provider metadata widen %s", (mode) => {
    for (const [agent, inferredKind, raw, options] of [
      [
        "codex",
        "execute",
        {
          _meta: { is_mcp_tool_approval: true },
          toolCall: { title: "MCP approval" },
        },
        { allConfiguredMcpServersAreRunnerOwned: true },
      ],
      [
        "claude",
        "write",
        { toolCall: { rawInput: { serverName: "taskcore" } } },
        {},
      ],
      [
        "claude",
        "execute",
        { toolCall: { name: "mcp__taskcore__taskcore_finish" } },
        {},
      ],
      [
        "claude",
        "write",
        {
          toolCall: {
            _meta: {
              claudeCode: { toolName: "mcp.taskcore.get_task_context" },
            },
          },
        },
        {},
      ],
    ] as const) {
      expect(
        decideAcpxPermission(
          agent,
          mode,
          { inferredKind, raw },
          options,
        ),
      ).toBe("delegate");
    }
  });

  it("does not trust provider-originated read classifications", () => {
    for (const inferredKind of ["read", "search", "list", "READ"]) {
      expect(
        decideAcpxPermission("codex", "approve-reads", {
          inferredKind,
          raw: {
            _meta: { is_mcp_tool_approval: true },
            toolCall: {
              name: "mcp__taskcore__get_task_context",
              rawInput: { serverName: "taskcore" },
            },
          },
        }),
      ).toBe("delegate");
    }
  });
});

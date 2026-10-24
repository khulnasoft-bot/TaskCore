import { describe, expect, it } from "vitest";
import { encodeEnvValue, updateEnvFileContents } from "./env-file.js";

describe("env file editor", () => {
  it("pins minimal and JSON value encoding", () => {
    expect(encodeEnvValue("plain-value", "minimal")).toBe("plain-value");
    expect(encodeEnvValue("#439edb", "minimal")).toBe('"#439edb"');
    expect(encodeEnvValue("plain-value", "json")).toBe('"plain-value"');
  });

  it("preserves unrelated content and CRLF while updating every stale duplicate", () => {
    const original = [
      "# operator comment",
      "UNKNOWN='keep this encoding'",
      "",
      "export TASKCORE_HOME = '/old path'  # managed path",
      "TASKCORE_DUPLICATE=stale",
      'TASKCORE_DUPLICATE="current"',
      "TRAILING=untouched",
      "",
    ].join("\r\n");

    const updated = updateEnvFileContents(
      original,
      {
        TASKCORE_HOME: "/new path",
        TASKCORE_DUPLICATE: "current",
        TASKCORE_WORKTREE_COLOR: "#439edb",
      },
      { valueEncoding: "minimal" },
    );

    expect(updated).toBe([
      "# operator comment",
      "UNKNOWN='keep this encoding'",
      "",
      'export TASKCORE_HOME = "/new path"  # managed path',
      "TASKCORE_DUPLICATE=current",
      'TASKCORE_DUPLICATE="current"',
      "TRAILING=untouched",
      'TASKCORE_WORKTREE_COLOR="#439edb"',
      "",
    ].join("\r\n"));
    expect(updated.replaceAll("\r\n", "")).not.toContain("\n");
  });

  it("uses JSON encoding for changed values without re-encoding current assignments", () => {
    const original = [
      "TASKCORE_CURRENT=plain-value",
      "TASKCORE_CHANGED=old",
      "UNKNOWN=\"operator value\"",
      "",
    ].join("\n");

    expect(
      updateEnvFileContents(
        original,
        {
          TASKCORE_CURRENT: "plain-value",
          TASKCORE_CHANGED: "new",
          TASKCORE_ADDED: "added",
        },
        { valueEncoding: "json" },
      ),
    ).toBe([
      "TASKCORE_CURRENT=plain-value",
      'TASKCORE_CHANGED="new"',
      'UNKNOWN="operator value"',
      'TASKCORE_ADDED="added"',
      "",
    ].join("\n"));
  });

  it("does not treat an unquoted dotenv comment as the managed value", () => {
    expect(
      updateEnvFileContents(
        ["TASKCORE_COLOR=#439edb", "TASKCORE_HOME=old# keep this comment"].join("\n"),
        {
          TASKCORE_COLOR: "#439edb",
          TASKCORE_HOME: "new",
        },
        { valueEncoding: "minimal" },
      ),
    ).toBe(
      ['TASKCORE_COLOR="#439edb"#439edb', "TASKCORE_HOME=new# keep this comment"].join("\n"),
    );
  });

  it("is a no-op when every managed duplicate is already current", () => {
    const original = [
      "export TASKCORE_HOME = '/same path' # first",
      'TASKCORE_HOME="/same path"',
      "UNKNOWN=value",
    ].join("\n");

    expect(updateEnvFileContents(original, { TASKCORE_HOME: "/same path" })).toBe(original);
  });
});

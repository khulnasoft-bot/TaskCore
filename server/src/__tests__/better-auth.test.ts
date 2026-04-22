import { afterEach, describe, expect, it } from "vitest";
import type { BetterAuthOptions } from "better-auth";
import { getCookies } from "better-auth/cookies";
import {
  buildBetterAuthAdvancedOptions,
  deriveAuthCookiePrefix,
} from "../auth/better-auth.js";

const ORIGINAL_INSTANCE_ID = process.env.TASKCORE_INSTANCE_ID;

afterEach(() => {
  if (ORIGINAL_INSTANCE_ID === undefined) delete process.env.TASKCORE_INSTANCE_ID;
  else process.env.TASKCORE_INSTANCE_ID = ORIGINAL_INSTANCE_ID;
});

describe("Better Auth cookie scoping", () => {
  it("derives an instance-scoped cookie prefix", () => {
    expect(deriveAuthCookiePrefix("default")).toBe("taskcore-default");
    expect(deriveAuthCookiePrefix("PAP-1601-worktree")).toBe("taskcore-PAP-1601-worktree");
  });

  it("uses TASKCORE_INSTANCE_ID for the Better Auth cookie prefix", () => {
    process.env.TASKCORE_INSTANCE_ID = "sat-worktree";

    const advanced = buildBetterAuthAdvancedOptions({ disableSecureCookies: false });

    expect(advanced).toEqual({
      cookiePrefix: "taskcore-sat-worktree",
    });
    expect(getCookies({ advanced } as BetterAuthOptions).sessionToken.name).toBe(
      "taskcore-sat-worktree.session_token",
    );
  });

  it("keeps local http auth cookies non-secure while preserving the scoped prefix", () => {
    process.env.TASKCORE_INSTANCE_ID = "pap-worktree";

    expect(buildBetterAuthAdvancedOptions({ disableSecureCookies: true })).toEqual({
      cookiePrefix: "taskcore-pap-worktree",
      useSecureCookies: false,
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  getCloudStackContext,
  isCloudManagedInstance,
  type CloudInstanceEnv,
} from "../services/cloud-instance.js";

describe("isCloudManagedInstance", () => {
  it("unifies both prior signals without weakening either restrictive floor", () => {
    const cases: CloudInstanceEnv[] = [
      {},
      { TASKCORE_CLOUD_TENANT_SERVER_TOKEN: "tenant-token" },
      { TASKCORE_MANAGED_CONFIG: "" },
      {
        TASKCORE_CLOUD_TENANT_SERVER_TOKEN: "tenant-token",
        TASKCORE_MANAGED_CONFIG: "managed-document",
      },
    ];

    for (const env of cases) {
      const priorTokenFloor = Boolean(env.TASKCORE_CLOUD_TENANT_SERVER_TOKEN?.trim());
      const priorManagedConfigFloor = env.TASKCORE_MANAGED_CONFIG !== undefined;
      const canonicalFloor = isCloudManagedInstance(env);

      expect(canonicalFloor).toBe(priorTokenFloor || priorManagedConfigFloor);
      expect(canonicalFloor || !priorTokenFloor).toBe(true);
      expect(canonicalFloor || !priorManagedConfigFloor).toBe(true);
    }
  });

  it("does not treat a blank tenant token alone as a managed signal", () => {
    expect(isCloudManagedInstance({ TASKCORE_CLOUD_TENANT_SERVER_TOKEN: "   " })).toBe(false);
  });
});

describe("getCloudStackContext", () => {
  it("returns null outside Taskcore Cloud even when stray stack metadata exists", () => {
    expect(getCloudStackContext({ TASKCORE_STACK_SLUG: "stray-stack" })).toBeNull();
  });

  it("returns normalized provisioner metadata for cloud instances", () => {
    expect(getCloudStackContext({
      TASKCORE_CLOUD_TENANT_SERVER_TOKEN: "tenant-token",
      TASKCORE_CLOUD_STACK_ID: " stack-1 ",
      TASKCORE_STACK_SLUG: " acme ",
      TASKCORE_CLOUD_ACCOUNT_GROUP_ID: " account-group-1 ",
      TASKCORE_PRIMARY_HOST: " acme.taskcore.app ",
      TASKCORE_CLOUD_API_ORIGIN: " https://app.taskcore.app ",
    })).toEqual({
      stackId: "stack-1",
      stackSlug: "acme",
      accountGroupId: "account-group-1",
      primaryHost: "acme.taskcore.app",
      cloudOrigin: "https://app.taskcore.app",
    });
  });

  it("represents missing managed metadata explicitly without failing health checks", () => {
    expect(getCloudStackContext({ TASKCORE_MANAGED_CONFIG: "managed-document" })).toEqual({
      stackId: null,
      stackSlug: null,
      accountGroupId: null,
      primaryHost: null,
      cloudOrigin: null,
    });
  });
});

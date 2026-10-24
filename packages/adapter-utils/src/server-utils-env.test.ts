import { describe, expect, it } from "vitest";
import { sanitizeInheritedTaskcoreEnv } from "./server-utils.js";

describe("sanitizeInheritedTaskcoreEnv", () => {
  it("drops the host-only Taskcore CLI command pointer", () => {
    expect(
      sanitizeInheritedTaskcoreEnv({
        TASKCORE_CMD: "node /missing/taskcore/dist/index.js",
        TASKCORE_RUNTIME_API_URL: "http://127.0.0.1:3100",
        PATH: "/usr/bin",
      }),
    ).toEqual({
      TASKCORE_RUNTIME_API_URL: "http://127.0.0.1:3100",
      PATH: "/usr/bin",
    });
  });
});

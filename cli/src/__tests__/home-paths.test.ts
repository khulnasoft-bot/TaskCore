import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveTaskcoreHomeDir,
  resolveTaskcoreInstanceId,
} from "../config/home.js";

const ORIGINAL_ENV = { ...process.env };

describe("home path resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to ~/.taskcore and default instance", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "taskcore-home-paths-"));
    process.env.TASKCORE_HOME = home;
    delete process.env.TASKCORE_INSTANCE_ID;

    const paths = describeLocalInstancePaths();
    expect(paths.homeDir).toBe(home);
    expect(paths.instanceId).toBe("default");
    expect(paths.configPath).toBe(
      path.resolve(home, "instances", "default", "config.json"),
    );
  });

  it("supports TASKCORE_HOME and explicit instance ids", () => {
    process.env.TASKCORE_HOME = "~/taskcore-home";

    const home = resolveTaskcoreHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "taskcore-home"));
    expect(resolveTaskcoreInstanceId("dev_1")).toBe("dev_1");
  });

  it("rejects invalid instance ids", () => {
    expect(() => resolveTaskcoreInstanceId("bad/id")).toThrow(
      /Invalid TASKCORE_INSTANCE_ID/,
    );
  });

  it("expands ~ prefixes", () => {
    expect(expandHomePrefix("~")).toBe(os.homedir());
    expect(expandHomePrefix("~/x/y")).toBe(path.resolve(os.homedir(), "x/y"));
  });
});

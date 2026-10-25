import fs from "node:fs";
import path from "node:path";
import { resolveDefaultConfigPath } from "./home-paths.js";

const TASKCORE_CONFIG_BASENAME = "config.json";
const TASKCORE_ENV_FILENAME = ".env";

function findConfigFileFromAncestors(startDir: string): string | null {
  const absoluteStartDir = path.resolve(startDir);
  let currentDir = absoluteStartDir;

  while (true) {
    const candidate = path.resolve(
      currentDir,
      ".taskcore",
      TASKCORE_CONFIG_BASENAME,
    );
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const nextDir = path.resolve(currentDir, "..");
    if (nextDir === currentDir) break;
    currentDir = nextDir;
  }

  return null;
}

export function resolveTaskcoreConfigPath(overridePath?: string): string {
  if (overridePath) return path.resolve(overridePath);
  if (process.env.TASKCORE_CONFIG)
    return path.resolve(process.env.TASKCORE_CONFIG);
  return (
    findConfigFileFromAncestors(process.cwd()) ?? resolveDefaultConfigPath()
  );
}

export function resolveTaskcoreEnvPath(overrideConfigPath?: string): string {
  return path.resolve(
    path.dirname(resolveTaskcoreConfigPath(overrideConfigPath)),
    TASKCORE_ENV_FILENAME,
  );
}

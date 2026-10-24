import os from "node:os";
import path from "node:path";

export const DEFAULT_TASKCORE_INSTANCE_ID = "default";
export const TASKCORE_CONFIG_BASENAME = "config.json";
export const TASKCORE_ENV_FILENAME = ".env";

const PATH_SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;

export function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

export function resolveTaskcoreHomeDir(homeOverride?: string): string {
  const raw = homeOverride?.trim() || process.env.TASKCORE_HOME?.trim();
  if (raw) return path.resolve(expandHomePrefix(raw));
  return path.resolve(os.homedir(), ".taskcore");
}

export function resolveTaskcoreInstanceId(instanceIdOverride?: string): string {
  const raw = instanceIdOverride?.trim() || process.env.TASKCORE_INSTANCE_ID?.trim() || DEFAULT_TASKCORE_INSTANCE_ID;
  if (!PATH_SEGMENT_RE.test(raw)) {
    throw new Error(`Invalid TASKCORE_INSTANCE_ID '${raw}'.`);
  }
  return raw;
}

export function resolveTaskcoreInstanceRoot(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveTaskcoreHomeDir(input.homeDir), "instances", resolveTaskcoreInstanceId(input.instanceId));
}

export function resolveTaskcoreInstanceConfigPath(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveTaskcoreInstanceRoot(input), TASKCORE_CONFIG_BASENAME);
}

export function resolveTaskcoreConfigPathForInstance(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return resolveTaskcoreInstanceConfigPath(input);
}

export function resolveTaskcoreEnvPathForConfig(configPath: string): string {
  return path.resolve(path.dirname(configPath), TASKCORE_ENV_FILENAME);
}

export function resolveDefaultEmbeddedPostgresDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveTaskcoreInstanceRoot(input), "db");
}

export function resolveDefaultLogsDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveTaskcoreInstanceRoot(input), "logs");
}

export function resolveDefaultSecretsKeyFilePath(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveTaskcoreInstanceRoot(input), "secrets", "master.key");
}

export function resolveDefaultStorageDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveTaskcoreInstanceRoot(input), "data", "storage");
}

export function resolveDefaultBackupDir(input: {
  homeDir?: string;
  instanceId?: string;
} = {}): string {
  return path.resolve(resolveTaskcoreInstanceRoot(input), "data", "backups");
}

export function resolveHomeAwarePath(value: string): string {
  return path.resolve(expandHomePrefix(value));
}

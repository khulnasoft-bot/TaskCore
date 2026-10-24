export function shouldLoadWorkingDirectoryEnv(input: {
  cwdEnvExists: boolean;
  isTaskcoreEnvFile: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = input.env ?? process.env;
  return env.TASKCORE_DISABLE_CWD_ENV_FILE !== "true"
    && input.cwdEnvExists
    && !input.isTaskcoreEnvFile;
}

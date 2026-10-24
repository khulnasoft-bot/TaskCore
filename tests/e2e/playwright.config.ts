import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

// Use a dedicated port so e2e tests always start their own server in local_trusted mode,
// even when the dev server is running on :3100 in authenticated mode.
const PORT = Number(process.env.TASKCORE_E2E_PORT ?? 3199);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TASKCORE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "taskcore-e2e-home-"));
const TASKCORE_INSTANCE_ID = "playwright-e2e";
const TASKCORE_CONFIG = path.join(TASKCORE_HOME, "instances", TASKCORE_INSTANCE_ID, "config.json");
const TASKCORE_AGENT_JWT_SECRET = process.env.TASKCORE_AGENT_JWT_SECRET ?? "playwright-e2e-agent-jwt-secret";
const TASKCORE_DECISION_SIGNING_SECRET =
  process.env.TASKCORE_DECISION_SIGNING_SECRET ?? "playwright-e2e-decision-signing-secret";
const TASKCORE_TOOL_ACTION_SIGNING_SECRET =
  process.env.TASKCORE_TOOL_ACTION_SIGNING_SECRET ?? "playwright-e2e-tool-action-signing-secret";
const PLAYWRIGHT_CHANNEL = process.env.TASKCORE_PLAYWRIGHT_CHANNEL;

process.env.TASKCORE_HOME = TASKCORE_HOME;
process.env.TASKCORE_CONFIG = TASKCORE_CONFIG;
// Worker processes reload this config; retain the main process's server path
// for specs that seed historical database state in the throwaway instance.
process.env.TASKCORE_E2E_SERVER_CONFIG ??= TASKCORE_CONFIG;
// Specs that mint agent JWTs in-process (via createLocalAgentJwt) must derive
// the same per-instance signing key as the webServer, or verification fails
// with a 401 instead of authenticating as the agent.
process.env.TASKCORE_INSTANCE_ID = TASKCORE_INSTANCE_ID;
process.env.TASKCORE_AGENT_JWT_SECRET = TASKCORE_AGENT_JWT_SECRET;
process.env.TASKCORE_DECISION_SIGNING_SECRET = TASKCORE_DECISION_SIGNING_SECRET;
process.env.TASKCORE_TOOL_ACTION_SIGNING_SECRET = TASKCORE_TOOL_ACTION_SIGNING_SECRET;

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  // These suites target dedicated multi-user configurations/ports and are
  // intentionally not part of the default local_trusted e2e run.
  testIgnore: ["in-feed-native/**", "multi-user.spec.ts", "multi-user-authenticated.spec.ts"],
  timeout: 60_000,
  retries: 0,
  // All specs share one throwaway server, and several toggle instance-level
  // state (the `enableConferenceRoomChat` experimental flag) that changes
  // which UI variant renders. Run files serially so a flag flip in one spec
  // can't change the wizard/thread under another spec mid-flight.
  workers: 1,
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        ...(PLAYWRIGHT_CHANNEL ? { channel: PLAYWRIGHT_CHANNEL } : {}),
      },
    },
  ],
  // The webServer directive bootstraps a throwaway instance and then starts it.
  // `onboard --yes --run` works in a non-interactive temp TASKCORE_HOME.
  webServer: {
    cwd: path.resolve(import.meta.dirname, "../.."),
    // Exercise the shipped UI. Source-checkout onboarding otherwise enables
    // Vite middleware: every reload traverses thousands of modules, including
    // service-worker-intercepted requests, before React can even start.
    // Build the server's first-choice static directory so a prior package build
    // cannot shadow the UI under test with stale server/ui-dist assets.
    command: "pnpm --filter @taskcore/ui build --outDir ../server/ui-dist --emptyOutDir && node cli/node_modules/tsx/dist/cli.mjs cli/src/index.ts onboard --yes --run",
    url: `${BASE_URL}/api/health`,
    // Always boot a dedicated throwaway instance for e2e so browser tests
    // never attach to the developer's active Taskcore home/server.
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      NODE_ENV: "test",
      TASKCORE_UI_DEV_MIDDLEWARE: "false",
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${path.resolve(import.meta.dirname, "fixtures/agent-chat-github.mjs")} --import=${path.resolve(import.meta.dirname, "fixtures/ai-connection-provider.mjs")}`,
      PORT: String(PORT),
      TASKCORE_OPEN_ON_LISTEN: "false",
      TASKCORE_API_URL: BASE_URL,
      TASKCORE_HOME,
      TASKCORE_INSTANCE_ID,
      TASKCORE_CONFIG,
      TASKCORE_AGENT_JWT_SECRET,
      TASKCORE_DECISION_SIGNING_SECRET,
      TASKCORE_TOOL_ACTION_SIGNING_SECRET,
      TASKCORE_BIND: "loopback",
      TASKCORE_DEPLOYMENT_MODE: "local_trusted",
      TASKCORE_DEPLOYMENT_EXPOSURE: "private",
    },
  },
  outputDir: "./test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "./playwright-report" }]],
});

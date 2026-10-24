import { createHash } from "node:crypto";

import { TASKCORE_RUNNER_COMPATIBILITY } from "../compatibility.js";
import {
  PRP_PROTOCOL_MIN_VERSION,
  PRP_PROTOCOL_NAME,
  PRP_PROTOCOL_VERSION,
} from "../protocol/replay-contract.js";
import { canonicalCapabilitySemanticCatalog } from "../semantic-tools/catalog.js";

export const TASKCORE_RUNNER_BUILD_METADATA_SCHEMA =
  "taskcore-runner/build-metadata/v1" as const;
export const TASKCORE_RUNNER_NATIVE_EXECUTION_SCHEMA =
  "taskcore-runner/native-execution/v1" as const;
export const TASKCORE_RUNNER_EVAL_INTEGRATION_SCHEMA =
  "taskcore-runner/evals-integration/v1" as const;
export const TASKCORE_RUNNERD_BUILD_METADATA_SCHEMA =
  "taskcore-runner/runnerd-build-metadata/v1" as const;

export const TASKCORE_RUNNER_SEMANTIC_CATALOG_SHA256 =
  `sha256:${createHash("sha256")
    .update(canonicalCapabilitySemanticCatalog())
    .digest("hex")}` as const;

/**
 * App-owned release metadata that Evals pins beside every native attempt.
 * Contract versions are independent from package semver so consumers can give
 * a precise mismatch instead of guessing from a package version.
 */
export const TASKCORE_RUNNER_BUILD_METADATA = Object.freeze({
  schema: TASKCORE_RUNNER_BUILD_METADATA_SCHEMA,
  package: Object.freeze({
    name: TASKCORE_RUNNER_COMPATIBILITY.packageName,
    version: TASKCORE_RUNNER_COMPATIBILITY.packageVersion,
  }),
  contracts: Object.freeze({
    evalIntegration: TASKCORE_RUNNER_COMPATIBILITY.components.evalIntegration,
    nativeExecution: TASKCORE_RUNNER_COMPATIBILITY.components.nativeExecution,
    runnerdArtifact: TASKCORE_RUNNER_COMPATIBILITY.components.runnerdBinary,
    prp: PRP_PROTOCOL_VERSION,
    semanticCatalog: TASKCORE_RUNNER_COMPATIBILITY.components.catalog,
    harnessDriver: TASKCORE_RUNNER_COMPATIBILITY.components.harnessDriver,
    controlPlaneAdapter: TASKCORE_RUNNER_COMPATIBILITY.components.controlPlaneAdapter,
    testkit: TASKCORE_RUNNER_COMPATIBILITY.components.testkit,
  }),
  prp: Object.freeze({
    name: PRP_PROTOCOL_NAME,
    minimumVersion: PRP_PROTOCOL_MIN_VERSION,
    maximumVersion: PRP_PROTOCOL_VERSION,
  }),
  semanticCatalog: Object.freeze({
    version: TASKCORE_RUNNER_COMPATIBILITY.components.catalog,
    sha256: TASKCORE_RUNNER_SEMANTIC_CATALOG_SHA256,
  }),
  runnerd: Object.freeze({
    binaryName: "taskcore-runnerd" as const,
    metadataSchema: TASKCORE_RUNNERD_BUILD_METADATA_SCHEMA,
    digestAlgorithm: "sha256" as const,
  }),
});

export type TaskcoreRunnerBuildMetadata = typeof TASKCORE_RUNNER_BUILD_METADATA;

/**
 * @deprecated Taskcore ID is identity-only. Import the Taskcore Cloud
 * connector names from `taskcore-cloud-connector.ts` for new code.
 *
 * These aliases keep source compatibility while deployments and persisted app
 * definitions move from the former Taskcore ID broker prototype.
 */
export {
  GMAIL_CONNECTOR_SCOPES,
  GMAIL_MCP_URL,
  GOOGLE_WORKSPACE_CONNECTOR_PROFILES,
  TaskcoreCloudConnectorError as TaskcoreIdConnectorError,
  createTaskcoreCloudConnector as createTaskcoreIdGmailConnector,
  taskcoreCloudConnectorCapabilitiesFromEnv as taskcoreIdGoogleConnectorCapabilitiesFromEnv,
  taskcoreCloudConnectorConfigFromEnv as taskcoreIdGmailConnectorConfigFromEnv,
} from "./taskcore-cloud-connector.js";

export type {
  TaskcoreCloudConnector as TaskcoreIdGmailConnector,
  TaskcoreCloudConnector as TaskcoreIdGoogleWorkspaceConnector,
  TaskcoreCloudConnectorConfig as TaskcoreIdGmailConnectorConfig,
  TaskcoreCloudConnectorEnvironment as TaskcoreIdConnectorEnvironment,
  TaskcoreCloudConnectorOperation as TaskcoreIdConnectorOperation,
  SealedGmailCredentials,
  SealedGoogleWorkspaceCredentials,
} from "./taskcore-cloud-connector.js";

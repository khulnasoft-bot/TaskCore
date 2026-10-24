import {
  taskcoreCloudConnectorEnrollmentStatus,
  type TaskcoreCloudConnectorEnrollmentStatus,
} from "./taskcore-cloud-connector-enrollment.js";
import {
  createTaskcoreCloudConnector,
  taskcoreCloudConnectorConfigFromEnv,
} from "./taskcore-cloud-connector.js";

export async function reconcileTaskcoreCloudConnectorEnrollmentStatus(
  env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
): Promise<TaskcoreCloudConnectorEnrollmentStatus> {
  const local = taskcoreCloudConnectorEnrollmentStatus(env);
  if (!local.configured) return local;
  const config = taskcoreCloudConnectorConfigFromEnv(env);
  if (!config) return { ...local, configured: false, status: "not_configured" };
  try {
    const status = await createTaskcoreCloudConnector({ config, request }).getInstanceStatus();
    if (status === "active") return { ...local, configured: true, status: "active" };
    if (status === "suspended") return { ...local, configured: false, status: "suspended" };
    return { ...local, configured: false, status: "not_configured" };
  } catch {
    return { ...local, configured: false, status: "unverified" };
  }
}

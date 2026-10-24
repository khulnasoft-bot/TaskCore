export type TaskcoreSemanticActionId =
  | "search_api"
  | "call_api"
  | "set_task_title"
  | "set_task_monitor"
  | "get_task_context"
  | "get_task_history"
  | "list_documents"
  | "read_document"
  | "list_document_revisions"
  | "report_progress"
  | "answer_status_question"
  | "write_document"
  | "request_human_input"
  | "register_deliverable"
  | "finish_task"
  | "block_task"
  | "request_review"
  | "list_agents"
  | "hire_agent"
  | "get_agent"
  | "search_tasks"
  | "list_approvals"
  | "get_approval"
  | "get_approval_context"
  | "get_workspace_runtime"
  | "control_workspace_service"
  | "reassign_task"
  | "set_dependencies"
  | "create_skill"
  | "update_skill"
  | "create_project"
  | "list_project_repositories"
  | "list_projects"
  | "create_task"
  | "request_approval"
  | "decide_approval"
  | "comment_on_approval"
  | "schedule_wake";

export type TaskcoreSemanticActionPlacement = "always" | "optional";
export type TaskcoreSemanticActionMode =
  "standard" | "ask" | "planning" | "skill_test";
export type TaskcoreSemanticActionEffect = "read" | "write" | "governance";

export type TaskcoreJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly TaskcoreJsonValue[]
  | { readonly [key: string]: TaskcoreJsonValue };

/** The JSON Schema subset used by the v1 semantic action catalog. */
export interface TaskcoreJsonSchema {
  readonly type?: string | readonly string[];
  readonly title?: string;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, TaskcoreJsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | TaskcoreJsonSchema;
  readonly items?: TaskcoreJsonSchema;
  readonly enum?: readonly TaskcoreJsonValue[];
  readonly oneOf?: readonly TaskcoreJsonSchema[];
  readonly anyOf?: readonly TaskcoreJsonSchema[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly pattern?: string;
  readonly format?: string;
  readonly default?: TaskcoreJsonValue;
}

/**
 * A transport-neutral declaration. Catalog membership never grants discovery
 * or invocation authority; a run-scoped authorization layer must do that.
 */
export interface TaskcoreSemanticActionDescriptor {
  readonly schema: "taskcore.semantic-action.v1";
  readonly operationId: TaskcoreSemanticActionId;
  readonly version: 1;
  readonly title: string;
  readonly description: string;
  readonly placement: TaskcoreSemanticActionPlacement;
  readonly effect: TaskcoreSemanticActionEffect;
  readonly requiredClaims: readonly string[];
  readonly allowedModes: readonly TaskcoreSemanticActionMode[];
  readonly allowedRoles?: readonly string[];
  readonly inputSchema: TaskcoreJsonSchema;
  readonly outputSchema: TaskcoreJsonSchema;
}

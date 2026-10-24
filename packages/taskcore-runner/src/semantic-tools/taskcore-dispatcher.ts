import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv/dist/2020.js";

import {
  TASKCORE_SEMANTIC_ACTION_CATALOG,
  taskcoreSemanticAction,
} from "../catalog/semantic-action-catalog.js";
import type {
  TaskcoreJsonValue,
  TaskcoreSemanticActionDescriptor,
  TaskcoreSemanticActionId,
} from "../catalog/semantic-action-types.js";
import { decideTaskcoreSemanticAuthorization } from "./authorization.js";
import {
  discoverTaskcoreSemanticTools,
  projectTaskcoreSemanticTools,
} from "./taskcore-discovery.js";
import {
  createTaskcoreSemanticInputReceipt,
  createTaskcoreSemanticResultReceipt,
  denialRetryable,
  digestTaskcoreSemanticContent,
  isTaskcoreSemanticStableId,
  normalizeTaskcoreSemanticReferences,
  taskcoreSemanticAuthorizationBoundary,
  taskcoreSemanticOutcome,
} from "./receipts.js";
import {
  inspectTaskcoreSemanticValue,
  isTaskcoreSemanticValueWithinBounds,
  redactTaskcoreSemanticValue,
} from "./redaction.js";
import type {
  TaskcoreSemanticActionBinding,
  TaskcoreSemanticAuthorizationDecision,
  TaskcoreSemanticAuthorizationRecord,
  TaskcoreSemanticBindingResult,
  TaskcoreSemanticContextProvider,
  TaskcoreSemanticDenialCode,
  TaskcoreSemanticDiscoveryResult,
  TaskcoreSemanticIdempotencyClaim,
  TaskcoreSemanticIdempotencyStore,
  TaskcoreSemanticRunContext,
  TaskcoreSemanticStoredOutcome,
  TaskcoreSemanticToolCall,
  TaskcoreSemanticToolDefinition,
  TaskcoreSemanticToolDenial,
  TaskcoreSemanticToolResult,
  TaskcoreSemanticToolSuccess,
} from "./types.js";

export interface TaskcoreSemanticDispatcherOptions {
  readonly contextProvider: TaskcoreSemanticContextProvider;
  readonly bindings: readonly TaskcoreSemanticActionBinding[];
  readonly idempotencyStore?: TaskcoreSemanticIdempotencyStore;
  readonly maxAuthorizationRecords?: number;
}

interface ClaimedMutation {
  readonly token: string;
  readonly inputDigest: string;
  readonly idempotencyKey: string;
}

export class TaskcoreSemanticDispatcher {
  readonly #contextProvider: TaskcoreSemanticContextProvider;
  readonly #bindings = new Map<
    TaskcoreSemanticActionId,
    TaskcoreSemanticActionBinding
  >();
  readonly #boundOperationIds: ReadonlySet<TaskcoreSemanticActionId>;
  readonly #inputValidators = new Map<
    TaskcoreSemanticActionId,
    ValidateFunction
  >();
  readonly #outputValidators = new Map<
    TaskcoreSemanticActionId,
    ValidateFunction
  >();
  readonly #idempotencyStore: TaskcoreSemanticIdempotencyStore | undefined;
  readonly #maxAuthorizationRecords: number;
  readonly #authorizationRecords: TaskcoreSemanticAuthorizationRecord[] = [];
  #recordSequence = 0;

  constructor(options: TaskcoreSemanticDispatcherOptions) {
    this.#contextProvider = options.contextProvider;
    this.#idempotencyStore = options.idempotencyStore;
    this.#maxAuthorizationRecords = Math.max(
      1,
      Math.min(Math.floor(options.maxAuthorizationRecords ?? 1_000), 10_000),
    );
    for (const binding of options.bindings) {
      if (this.#bindings.has(binding.operationId)) {
        throw new Error(
          `duplicate semantic action binding: ${binding.operationId}`,
        );
      }
      if (taskcoreSemanticAction(binding.operationId) === undefined) {
        throw new Error(
          `unknown semantic action binding: ${binding.operationId}`,
        );
      }
      this.#bindings.set(binding.operationId, binding);
    }
    this.#boundOperationIds = new Set(this.#bindings.keys());

    const ajv = new Ajv2020({
      allErrors: true,
      allowUnionTypes: true,
      strict: true,
    });
    for (const descriptor of TASKCORE_SEMANTIC_ACTION_CATALOG) {
      this.#inputValidators.set(
        descriptor.operationId,
        ajv.compile(descriptor.inputSchema),
      );
      this.#outputValidators.set(
        descriptor.operationId,
        ajv.compile(descriptor.outputSchema),
      );
    }
  }

  async listAlwaysAvailableTools(
    runId: string,
  ): Promise<readonly TaskcoreSemanticToolDefinition[]> {
    const context = await this.#contextProvider(runId);
    this.#recordExposureDecisions(runId, context, "always");
    return projectTaskcoreSemanticTools({
      runId,
      context,
      boundOperationIds: this.#boundOperationIds,
      placement: "always",
    });
  }

  async discoverTools(input: {
    readonly runId: string;
    readonly query: string;
    readonly namespace?: string;
    readonly limit?: number;
  }): Promise<TaskcoreSemanticDiscoveryResult> {
    const context = await this.#contextProvider(input.runId);
    this.#recordExposureDecisions(input.runId, context, "optional");
    return discoverTaskcoreSemanticTools({
      ...input,
      context,
      boundOperationIds: this.#boundOperationIds,
    });
  }

  authorizationRecords(): readonly TaskcoreSemanticAuthorizationRecord[] {
    return deepFreeze(structuredClone(this.#authorizationRecords));
  }

  async dispatch(
    call: TaskcoreSemanticToolCall,
  ): Promise<TaskcoreSemanticToolResult> {
    if (!validCallIdentity(call)) {
      return this.#identityDenial(call);
    }
    const descriptor = taskcoreSemanticAction(call.operationId);
    const binding = descriptor && this.#bindings.get(descriptor.operationId);
    if (descriptor === undefined || binding === undefined) {
      return this.#denial(call, "operation_absent", null, null);
    }

    let context: TaskcoreSemanticRunContext;
    try {
      context = await this.#contextProvider(call.runId);
    } catch {
      return this.#denial(call, "binding_failed", descriptor, null);
    }
    let decision = decideTaskcoreSemanticAuthorization(
      descriptor,
      context,
      "invocation",
      call.runId,
      call.input,
    );
    if (!decision.allowed) {
      return this.#denial(
        call,
        denialCode(decision),
        descriptor,
        context,
        decision,
      );
    }

    // The harness owns credential policy; admission only enforces bounds.
    if (!isTaskcoreSemanticValueWithinBounds(call.input)) {
      decision = deniedDecision(
        decision,
        "input_invalid",
        "Tool input exceeds safe bounds.",
      );
      return this.#denial(call, "input_invalid", descriptor, context, decision);
    }
    const inputValidator = this.#inputValidators.get(descriptor.operationId);
    const idempotencyKey = stringProperty(call.input, "idempotencyKey");
    if (descriptor.effect !== "read" && idempotencyKey === undefined) {
      decision = deniedDecision(
        decision,
        "idempotency_required",
        "Mutation actions require an idempotency key.",
      );
      return this.#denial(
        call,
        "idempotency_required",
        descriptor,
        context,
        decision,
      );
    }
    if (inputValidator === undefined || !inputValidator(call.input)) {
      decision = deniedDecision(
        decision,
        "input_invalid",
        formatValidationError(inputValidator),
      );
      return this.#denial(call, "input_invalid", descriptor, context, decision);
    }

    const inputReceipt = createTaskcoreSemanticInputReceipt({
      operationId: descriptor.operationId,
      callId: call.callId,
      correlation: call.correlation,
      idempotencyKey: idempotencyKey ?? null,
      content: call.input,
    });
    const inputDigest = digestTaskcoreSemanticContent(call.input);
    let claim: ClaimedMutation | undefined;
    if (descriptor.effect !== "read") {
      if (this.#idempotencyStore === undefined) {
        decision = deniedDecision(
          decision,
          "receipt_store_unavailable",
          "No durable idempotency store is configured for mutation actions.",
        );
        return this.#denial(
          call,
          "receipt_store_unavailable",
          descriptor,
          context,
          decision,
        );
      }
      const scope = digestTaskcoreSemanticContent([
        context.companyId,
        call.runId,
        descriptor.operationId,
        idempotencyKey,
      ]);
      let claimed: TaskcoreSemanticIdempotencyClaim;
      try {
        claimed = await this.#idempotencyStore.claim({
          scope,
          operationId: descriptor.operationId,
          inputDigest,
        });
      } catch {
        decision = deniedDecision(
          decision,
          "receipt_store_unavailable",
          "The durable idempotency store is unavailable.",
        );
        return this.#denial(
          call,
          "receipt_store_unavailable",
          descriptor,
          context,
          decision,
        );
      }
      if (claimed.kind === "conflict") {
        decision = deniedDecision(
          decision,
          "idempotency_conflict",
          "The idempotency key was already used with different input.",
        );
        return this.#denial(
          call,
          "idempotency_conflict",
          descriptor,
          context,
          decision,
        );
      }
      if (claimed.kind === "in_progress") {
        decision = deniedDecision(
          decision,
          "idempotency_in_progress",
          "The original mutation is still in progress.",
        );
        return this.#denial(
          call,
          "idempotency_in_progress",
          descriptor,
          context,
          decision,
        );
      }
      if (claimed.kind === "duplicate") {
        return this.#duplicate(
          call,
          descriptor,
          context,
          decision,
          inputReceipt,
          inputDigest,
          claimed.outcome,
        );
      }
      claim = {
        token: claimed.token,
        inputDigest,
        idempotencyKey: idempotencyKey!,
      };
    }

    // Re-read authority after any durable claim and immediately before the
    // application binding. A stale projection can never authorize execution.
    let currentContext: TaskcoreSemanticRunContext;
    try {
      currentContext = await this.#contextProvider(call.runId);
    } catch {
      if (claim !== undefined && !(await this.#releaseClaim(claim.token))) {
        return this.#denial(
          call,
          "receipt_store_unavailable",
          descriptor,
          context,
        );
      }
      return this.#denial(call, "binding_failed", descriptor, context);
    }
    decision = decideTaskcoreSemanticAuthorization(
      descriptor,
      currentContext,
      "invocation",
      call.runId,
      call.input,
    );
    if (!decision.allowed) {
      if (claim !== undefined && !(await this.#releaseClaim(claim.token))) {
        return this.#denial(
          call,
          "receipt_store_unavailable",
          descriptor,
          currentContext,
          deniedDecision(
            decision,
            "receipt_store_unavailable",
            "The unused mutation claim could not be released.",
          ),
        );
      }
      return this.#denial(
        call,
        denialCode(decision),
        descriptor,
        currentContext,
        decision,
      );
    }

    let executed: TaskcoreSemanticBindingResult;
    try {
      executed = await binding.execute({
        runId: call.runId,
        companyId: currentContext.companyId,
        actorId: currentContext.actor.id,
        taskId: currentContext.activeTask.id,
        callId: call.callId,
        operationId: descriptor.operationId,
        input: call.input as Readonly<Record<string, TaskcoreJsonValue>>,
      });
    } catch {
      // A mutation may have crossed the application boundary. Keep its claim
      // reserved so an uncertain retry cannot execute it twice.
      decision = deniedDecision(
        decision,
        "binding_failed",
        "The action binding failed safely.",
      );
      return this.#denial(
        call,
        "binding_failed",
        descriptor,
        currentContext,
        decision,
      );
    }

    if (!isBindingResult(executed)) {
      decision = deniedDecision(
        decision,
        "binding_output_invalid",
        "The action binding returned an invalid result.",
      );
      return this.#denial(
        call,
        "binding_output_invalid",
        descriptor,
        currentContext,
        decision,
      );
    }
    const outputSafety = inspectTaskcoreSemanticValue(executed.value);
    const safeValue = redactTaskcoreSemanticValue(executed.value);
    const outputValidator = this.#outputValidators.get(descriptor.operationId);
    if (
      !outputSafety.withinBounds ||
      !validOptionalCode(executed.code) ||
      !validOptionalRevision(executed.stateRevision) ||
      !validOptionalStableId(executed.auditReceiptId) ||
      outputValidator === undefined ||
      !outputValidator(safeValue)
    ) {
      decision = deniedDecision(
        decision,
        "binding_output_invalid",
        "The action binding returned an invalid result.",
      );
      return this.#denial(
        call,
        "binding_output_invalid",
        descriptor,
        currentContext,
        decision,
        outputSafety.containsProtectedData,
      );
    }

    const code = executed.code ?? "ok";
    const references = normalizeTaskcoreSemanticReferences(
      executed.references,
    );
    const resultReceipt = createTaskcoreSemanticResultReceipt({
      operationId: descriptor.operationId,
      callId: call.callId,
      correlation: call.correlation,
      idempotencyKey: idempotencyKey ?? null,
      content: safeValue,
      references,
      redacted: outputSafety.containsProtectedData,
      outcome: taskcoreSemanticOutcome({ ok: true, code }),
      code,
      retryable: false,
      authorizationBoundary: taskcoreSemanticAuthorizationBoundary(code),
      ...(validRevision(executed.stateRevision)
        ? { currentRevision: executed.stateRevision }
        : {}),
      ...(executed.auditReceiptId !== undefined
        ? { auditReceiptId: executed.auditReceiptId }
        : {}),
    });
    const operationReceiptId = String(resultReceipt.operationReceiptId);

    if (claim !== undefined) {
      const stored: TaskcoreSemanticStoredOutcome = {
        operationId: descriptor.operationId,
        inputDigest,
        operationReceiptId,
        value: safeValue,
        code,
        ...(validRevision(executed.stateRevision)
          ? { stateRevision: executed.stateRevision }
          : {}),
        references,
        ...(executed.auditReceiptId !== undefined
          ? { auditReceiptId: executed.auditReceiptId }
          : {}),
      };
      try {
        await this.#idempotencyStore!.complete(claim.token, stored);
      } catch {
        try {
          await this.#idempotencyStore!.recover(claim.token, stored);
        } catch {
          // The application effect may have happened. Keep the claim reserved
          // and stop automatic retries. The store's operator recovery path can
          // commit the same sanitized outcome without repeating the effect.
          decision = deniedDecision(
            decision,
            "receipt_recovery_failed",
            "The mutation receipt needs operator recovery.",
          );
          return this.#denial(
            call,
            "receipt_recovery_failed",
            descriptor,
            currentContext,
            decision,
          );
        }
      }
    }

    this.#record(
      currentContext,
      decision,
      call.callId,
      inputDigest,
      operationReceiptId,
    );
    return deepFreeze({
      ok: true,
      operationId: descriptor.operationId,
      callId: call.callId,
      value: safeValue,
      code,
      duplicate: false,
      ...(validRevision(executed.stateRevision)
        ? { stateRevision: executed.stateRevision }
        : {}),
      inputReceipt,
      resultReceipt,
    } satisfies TaskcoreSemanticToolSuccess);
  }

  #recordExposureDecisions(
    runId: string,
    context: TaskcoreSemanticRunContext,
    placement: TaskcoreSemanticActionDescriptor["placement"],
  ): void {
    for (const descriptor of TASKCORE_SEMANTIC_ACTION_CATALOG) {
      if (
        descriptor.placement !== placement ||
        !this.#boundOperationIds.has(descriptor.operationId)
      ) {
        continue;
      }
      const decision = decideTaskcoreSemanticAuthorization(
        descriptor,
        context,
        "exposure",
        runId,
      );
      this.#record(context, decision, null, null, null);
    }
  }

  #duplicate(
    call: TaskcoreSemanticToolCall,
    descriptor: TaskcoreSemanticActionDescriptor,
    context: TaskcoreSemanticRunContext,
    decision: TaskcoreSemanticAuthorizationDecision,
    inputReceipt: TaskcoreSemanticToolSuccess["inputReceipt"],
    inputDigest: string,
    stored: TaskcoreSemanticStoredOutcome,
  ): TaskcoreSemanticToolResult {
    if (!isStoredOutcome(stored)) {
      const denied = deniedDecision(
        decision,
        "binding_output_invalid",
        "The stored mutation receipt is invalid.",
      );
      return this.#denial(
        call,
        "binding_output_invalid",
        descriptor,
        context,
        denied,
      );
    }
    const outputValidator = this.#outputValidators.get(descriptor.operationId);
    const outputSafety = inspectTaskcoreSemanticValue(stored.value);
    const safeValue = redactTaskcoreSemanticValue(stored.value);
    if (
      stored.operationId !== descriptor.operationId ||
      stored.inputDigest !== inputDigest ||
      !isTaskcoreSemanticStableId(stored.operationReceiptId) ||
      !validCode(stored.code) ||
      !validOptionalRevision(stored.stateRevision) ||
      !validOptionalStableId(stored.auditReceiptId) ||
      !outputSafety.withinBounds ||
      outputValidator === undefined ||
      !outputValidator(safeValue)
    ) {
      const denied = deniedDecision(
        decision,
        "binding_output_invalid",
        "The stored mutation receipt is invalid.",
      );
      return this.#denial(
        call,
        "binding_output_invalid",
        descriptor,
        context,
        denied,
      );
    }
    const references = normalizeTaskcoreSemanticReferences(stored.references);
    const resultReceipt = createTaskcoreSemanticResultReceipt({
      operationId: descriptor.operationId,
      callId: call.callId,
      correlation: call.correlation,
      idempotencyKey: stringProperty(call.input, "idempotencyKey") ?? null,
      content: safeValue,
      references,
      redacted: outputSafety.containsProtectedData,
      outcome: "duplicate",
      code: stored.code,
      retryable: false,
      authorizationBoundary: taskcoreSemanticAuthorizationBoundary(
        stored.code,
      ),
      operationReceiptId: stored.operationReceiptId,
      duplicateOfReceiptId: stored.operationReceiptId,
      ...(validRevision(stored.stateRevision)
        ? { currentRevision: stored.stateRevision }
        : {}),
      ...(stored.auditReceiptId !== undefined
        ? { auditReceiptId: stored.auditReceiptId }
        : {}),
    });
    this.#record(
      context,
      decision,
      call.callId,
      inputDigest,
      stored.operationReceiptId,
    );
    return deepFreeze({
      ok: true,
      operationId: descriptor.operationId,
      callId: call.callId,
      value: safeValue,
      code: stored.code,
      duplicate: true,
      ...(validRevision(stored.stateRevision)
        ? { stateRevision: stored.stateRevision }
        : {}),
      inputReceipt,
      resultReceipt,
    } satisfies TaskcoreSemanticToolSuccess);
  }

  async #releaseClaim(token: string): Promise<boolean> {
    try {
      await this.#idempotencyStore!.release(token);
      return true;
    } catch {
      return false;
    }
  }

  #identityDenial(
    call: TaskcoreSemanticToolCall,
  ): TaskcoreSemanticToolDenial {
    return deepFreeze({
      ok: false,
      operationId: safeIdentity(call.operationId),
      callId: safeIdentity(call.callId),
      error: {
        code: "input_invalid",
        message: "The semantic call identity is invalid.",
        retryable: false,
      },
      inputReceipt: null,
      resultReceipt: null,
    });
  }

  #denial(
    call: TaskcoreSemanticToolCall,
    code: TaskcoreSemanticDenialCode,
    descriptor: TaskcoreSemanticActionDescriptor | null,
    context: TaskcoreSemanticRunContext | null,
    decision?: TaskcoreSemanticAuthorizationDecision,
    redacted = false,
  ): TaskcoreSemanticToolDenial {
    const idempotencyKey = stringProperty(call.input, "idempotencyKey") ?? null;
    const inputReceipt = createTaskcoreSemanticInputReceipt({
      operationId: call.operationId,
      callId: call.callId,
      correlation: call.correlation,
      idempotencyKey,
      content: call.input,
      redacted,
    });
    const resultReceipt = createTaskcoreSemanticResultReceipt({
      operationId: call.operationId,
      callId: call.callId,
      correlation: call.correlation,
      idempotencyKey,
      content: { code },
      redacted,
      outcome: taskcoreSemanticOutcome({ ok: false, code }),
      code,
      retryable: denialRetryable(code),
      authorizationBoundary: taskcoreSemanticAuthorizationBoundary(code),
    });
    if (descriptor !== null && context !== null) {
      const finalDecision =
        decision ??
        deniedDecision(
          decideTaskcoreSemanticAuthorization(
            descriptor,
            context,
            "invocation",
            call.runId,
            call.input,
          ),
          code,
          denialMessage(code),
        );
      this.#record(
        context,
        finalDecision,
        call.callId,
        digestTaskcoreSemanticContent(call.input),
        String(resultReceipt.operationReceiptId),
      );
    }
    return deepFreeze({
      ok: false,
      operationId: call.operationId,
      callId: call.callId,
      error: {
        code,
        message: denialMessage(code),
        retryable: denialRetryable(code),
      },
      inputReceipt,
      resultReceipt,
    });
  }

  #record(
    context: TaskcoreSemanticRunContext,
    decision: TaskcoreSemanticAuthorizationDecision,
    callId: string | null,
    inputDigest: string | null,
    operationReceiptId: string | null,
  ): void {
    if (decision.code === "authority_context_invalid") return;
    this.#recordSequence += 1;
    this.#authorizationRecords.push(
      deepFreeze({
        schema: "taskcore.semantic-authorization-record.v1",
        id: `semantic_auth:${String(this.#recordSequence).padStart(8, "0")}`,
        runId: context.runId,
        companyId: context.companyId,
        actorId: context.actor.id,
        taskId: context.activeTask.id,
        callId,
        ...decision,
        inputDigest,
        operationReceiptId,
      }),
    );
    if (this.#authorizationRecords.length > this.#maxAuthorizationRecords) {
      this.#authorizationRecords.splice(
        0,
        this.#authorizationRecords.length - this.#maxAuthorizationRecords,
      );
    }
  }
}

function validCallIdentity(call: TaskcoreSemanticToolCall): boolean {
  return (
    call.correlation.runId === call.runId &&
    [
      call.runId,
      call.callId,
      call.operationId,
      call.correlation.normalizedSessionId,
      call.correlation.turnId,
      call.correlation.itemId,
      ...(call.correlation.requestId === undefined
        ? []
        : [call.correlation.requestId]),
    ].every(isTaskcoreSemanticStableId)
  );
}

function isBindingResult(
  value: unknown,
): value is TaskcoreSemanticBindingResult {
  return typeof value === "object" && value !== null && "value" in value;
}

function isStoredOutcome(
  value: unknown,
): value is TaskcoreSemanticStoredOutcome {
  return (
    typeof value === "object" &&
    value !== null &&
    "operationId" in value &&
    "inputDigest" in value &&
    "operationReceiptId" in value &&
    "value" in value &&
    "code" in value &&
    Array.isArray((value as { references?: unknown }).references)
  );
}

function deniedDecision(
  decision: TaskcoreSemanticAuthorizationDecision,
  code: TaskcoreSemanticDenialCode,
  reason: string,
): TaskcoreSemanticAuthorizationDecision {
  return { ...decision, allowed: false, code, reason };
}

function denialCode(
  decision: TaskcoreSemanticAuthorizationDecision,
): TaskcoreSemanticDenialCode {
  if (decision.code === "allowed") {
    throw new Error("allowed authorization decision cannot create a denial");
  }
  return decision.code;
}

function denialMessage(code: TaskcoreSemanticDenialCode): string {
  switch (code) {
    case "operation_absent":
      return "The requested semantic action is not available.";
    case "idempotency_in_progress":
      return "The original mutation is still in progress.";
    case "binding_failed":
      return "The semantic action could not complete safely.";
    default:
      return "The requested semantic action was not executed.";
  }
}

function formatValidationError(
  validator: ValidateFunction | undefined,
): string {
  const issue = validator?.errors?.[0];
  if (issue === undefined)
    return "Tool input does not match its action schema.";
  return `Tool input ${issue.instancePath || "/"} ${issue.message ?? "is invalid"}.`;
}

function stringProperty(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : undefined;
}

function validCode(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9_.:-]{0,159}$/.test(value);
}

function validOptionalCode(value: unknown): value is string | undefined {
  return value === undefined || validCode(value);
}

function validRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validOptionalRevision(value: unknown): value is number | undefined {
  return value === undefined || validRevision(value);
}

function validOptionalStableId(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    (typeof value === "string" && isTaskcoreSemanticStableId(value))
  );
}

function safeIdentity(value: string): string {
  return isTaskcoreSemanticStableId(value) ? value : "invalid";
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

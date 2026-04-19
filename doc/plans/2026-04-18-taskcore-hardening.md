# TaskCore Implementation Plan: Operational Hardening & Feature Expansion

This plan outlines the steps to harden TaskCore's autonomous runtime and implement key product features as defined in the P0/P1 roadmap.

## P0: Cost Safety & Runtime Hardening

### 1. Heartbeat Wake-Gating
Implement deterministic gating to suppress non-actionable model calls.

- [ ] **Define `WakeReason` Enum**
  - Add to `packages/shared/src/types/heartbeat.ts` (or similar).
  - Reasons: `heartbeat_timer`, `mention`, `task_update`, `force_wake`, `budget_check`.
- [ ] **Refactor `enqueueWakeup`**
  - Update signature to accept `reason: WakeReason`.
  - Log reason in `activity_logs`.
- [ ] **Implement Gating Logic in `tickTimers`**
  - Only enqueue `heartbeat_timer` if:
    - Agent has active tasks.
    - AND last run was > N minutes ago (per policy).
    - AND there are "unseen" changes (new comments, state changes).
- [ ] **Add `force_wake` API**
  - Ensure manual "Run" buttons in UI use `force_wake` to bypass gating.

### 2. Budget Circuit Breakers
Automate protective actions when spending or failure thresholds are exceeded.

- [ ] **Extend `BudgetConfig`**
  - Add `circuitBreaker: { failureThreshold: number, windowMs: number, autoPause: boolean }`.
- [ ] **Track Execution Failures**
  - Update `agent_runtime_state` to track consecutive failures.
- [ ] **Implement Circuit Breaker Service**
  - Create `server/src/services/circuitBreakers.ts`.
  - Logic to check failures vs threshold.
  - Trigger `BudgetService.pauseAgent()` or `pauseCompany()` when tripped.
- [ ] **UI Indicators**
  - Show "Circuit Breaker Tripped" status on Agent/Company cards.

## P0: Artifact System (Phase 1)

### 3. Expanded MIME Support
- [ ] **Update `server/src/attachment-types.ts`**
  - Add `text/markdown`, `application/json`, `text/csv` to `DEFAULT_ALLOWED_TYPES`.
- [ ] **Sanitization for New Types**
  - Ensure `.json` and `.csv` are validated for basic structure to prevent injection if rendered.

### 4. Issue Workspace File Browser
- [ ] **New Component: `IssueFileBrowser.tsx`**
  - Reuse `PackageFileTree.tsx` logic.
  - Fetch file list from `GET /api/execution-workspaces/:id/files`.
- [ ] **Integrate into `IssueDetail.tsx`**
  - Add a "Files" tab or section to explore the actual workspace CWD.

## P1: Guided Onboarding

### 5. AI-Guided Interview Flow
- [ ] **Backend: `GET /api/onboarding/recommendation`**
  - Use an LLM to generate follow-up questions based on the initial "Mission/Goal" input.
- [ ] **Frontend: Interview Step**
  - Replace/Extend Step 1 of `OnboardingWizard.tsx` with a multi-turn chat-like interface.
  - Goal: Refine broad missions into concrete `goals` and `projects`.

## Verification Roadmap

### Testing
- [ ] **Unit Tests:** `heartbeat.test.ts` for wake-gating logic.
- [ ] **Integration Tests:** Trigger circuit breakers via mocked failed runs.
- [ ] **Manual E2E:** Walk through onboarding with the new interview flow.

### Build & Typecheck
- [ ] `pnpm -r typecheck`
- [ ] `pnpm build`

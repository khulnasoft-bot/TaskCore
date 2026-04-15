# Taskcore MCP Server

Model Context Protocol server for Taskcore.

This package is a thin MCP wrapper over the existing Taskcore REST API. It does
not talk to the database directly and it does not reimplement business logic.

## Authentication

The server reads its configuration from environment variables:

- `TASKCORE_API_URL` - Taskcore base URL, for example `http://localhost:3100`
- `TASKCORE_API_KEY` - bearer token used for `/api` requests
- `TASKCORE_COMPANY_ID` - optional default company for company-scoped tools
- `TASKCORE_AGENT_ID` - optional default agent for checkout helpers
- `TASKCORE_RUN_ID` - optional run id forwarded on mutating requests

## Usage

```sh
npx -y @taskcore/mcp-server
```

Or locally in this repo:

```sh
pnpm --filter @taskcore/mcp-server build
node packages/mcp-server/dist/stdio.js
```

## Tool Surface

Read tools:

- `taskcoreMe`
- `taskcoreInboxLite`
- `taskcoreListAgents`
- `taskcoreGetAgent`
- `taskcoreListIssues`
- `taskcoreGetIssue`
- `taskcoreGetHeartbeatContext`
- `taskcoreListComments`
- `taskcoreGetComment`
- `taskcoreListIssueApprovals`
- `taskcoreListDocuments`
- `taskcoreGetDocument`
- `taskcoreListDocumentRevisions`
- `taskcoreListProjects`
- `taskcoreGetProject`
- `taskcoreListGoals`
- `taskcoreGetGoal`
- `taskcoreListApprovals`
- `taskcoreGetApproval`
- `taskcoreGetApprovalIssues`
- `taskcoreListApprovalComments`

Write tools:

- `taskcoreCreateIssue`
- `taskcoreUpdateIssue`
- `taskcoreCheckoutIssue`
- `taskcoreReleaseIssue`
- `taskcoreAddComment`
- `taskcoreUpsertIssueDocument`
- `taskcoreRestoreIssueDocumentRevision`
- `taskcoreCreateApproval`
- `taskcoreLinkIssueApproval`
- `taskcoreUnlinkIssueApproval`
- `taskcoreApprovalDecision`
- `taskcoreAddApprovalComment`

Escape hatch:

- `taskcoreApiRequest`

`taskcoreApiRequest` is limited to paths under `/api` and JSON bodies. It is
meant for endpoints that do not yet have a dedicated MCP tool.

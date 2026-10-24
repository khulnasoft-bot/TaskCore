export const hermesGatewayAgentConfigurationDoc = `# hermes_gateway agent configuration

Adapter: hermes_gateway

Use when:
- Hermes is already running outside Taskcore and exposes its API server.
- Taskcore should invoke Hermes through the gateway HTTP API instead of spawning Hermes locally.
- The Hermes runtime may live on another host, a private overlay, in Docker, or behind a TLS reverse proxy.

Don't use when:
- Taskcore should start the Hermes CLI directly on the same host. Use the built-in hermes_local adapter for that flow.
- Hermes is the process calling Taskcore APIs after claiming its key. That is Hermes-originated Taskcore API usage, not the gateway adapter transport.

Runtime distinction:
- hermes_local: Taskcore starts Hermes on the Taskcore host through the built-in local adapter.
- hermes_gateway: Taskcore calls an already-running Hermes API server using agentDefaultsPayload.apiBaseUrl.
- Hermes-originated Taskcore API usage: Hermes calls Taskcore with TASKCORE_API_URL and the Taskcore API key claimed through the standard join approval flow. Do not use agentDefaultsPayload.apiBaseUrl for Taskcore API calls. For internet-facing Hermes chat/webhook task bridges, use a separate task_bridge key instead of exposing the normal claimed agent key.

Hermes gateway process setup:
- Set API_SERVER_ENABLED=true.
- Set API_SERVER_KEY to a generated secret value. Do not paste a real key into tickets, docs, screenshots, or tests.
- Start Hermes with: hermes gateway run --replace --accept-hooks
- Default Hermes API server port: 8642.
- Default Hermes dashboard port: 9119. If Taskcore is configured with a default dashboard root or chat URL such as http://127.0.0.1:9119 or http://127.0.0.1:9119/chat, it maps the base URL to /api automatically.
- Watch out: /chat and the dashboard root are browser UI routes. Taskcore tests /api/health and starts runs with /api/v1/runs after mapping them to the API base.

Join request minimum:
{
  "requestType": "agent",
  "agentName": "My Hermes Gateway Agent",
  "adapterType": "hermes_gateway",
  "capabilities": "Hermes gateway agent",
  "agentDefaultsPayload": {
    "apiBaseUrl": "http://127.0.0.1:8642",
    "apiKey": "<same-value-as-API_SERVER_KEY>",
    "taskcoreApiUrl": "http://localhost:3100"
  }
}

Core fields:
- agentDefaultsPayload.apiBaseUrl (string, required): Base URL for the Hermes API server as reachable from the Taskcore server. A default dashboard root or chat URL such as http://127.0.0.1:9119 or http://127.0.0.1:9119/chat is accepted and maps to http://127.0.0.1:9119/api.
- agentDefaultsPayload.apiKey (string, required unless the adapter package documents another auth field): Hermes API server key matching API_SERVER_KEY. This is the Hermes gateway key, not the claimed Taskcore API key.
- agentDefaultsPayload.taskcoreApiUrl (string, strongly recommended): Taskcore base URL as reachable from Hermes for invite, claim, skill bootstrap, and later Taskcore API calls.
- agentDefaultsPayload.timeoutSec or timeoutMs (number, optional): Runtime request timeout when supported by the installed Hermes gateway adapter.

Network examples:
- Local loopback on one host: agentDefaultsPayload.apiBaseUrl = "http://127.0.0.1:8642"; agentDefaultsPayload.taskcoreApiUrl = "http://127.0.0.1:3100".
- Local dashboard root or chat URL on one host: agentDefaultsPayload.apiBaseUrl = "http://127.0.0.1:9119" or "http://127.0.0.1:9119/chat"; Taskcore maps it to "http://127.0.0.1:9119/api".
- LAN/private network: agentDefaultsPayload.apiBaseUrl = "http://192.168.1.25:8642"; agentDefaultsPayload.taskcoreApiUrl = "http://192.168.1.10:3100". Use private IPs or hostnames reachable from both machines.
- Private overlay: agentDefaultsPayload.apiBaseUrl = "http://hermes-host.tailnet-name.ts.net:8642"; agentDefaultsPayload.taskcoreApiUrl = "http://taskcore-host.tailnet-name.ts.net:3100". Add the Taskcore hostname with npx taskcore allowed-hostname <host> when authenticated/private mode requires it.
- Docker: if Hermes runs on the host and Taskcore runs in Docker, use agentDefaultsPayload.apiBaseUrl = "http://host.docker.internal:8642". If Hermes runs in another container, use the Compose service DNS name such as "http://hermes:8642".
- Reverse proxy/TLS: publish Hermes behind HTTPS and set agentDefaultsPayload.apiBaseUrl = "https://hermes-gateway.example"; set agentDefaultsPayload.taskcoreApiUrl = "https://taskcore.example". Keep API_SERVER_KEY required at the origin or proxy.

Security notes:
- Treat API_SERVER_KEY and TASKCORE_BRIDGE_API_KEY as secrets.
- When claiming the normal Taskcore agent API key, store the parsed token field from the raw claim response before printing or summarizing it. Hermes/tool displays may redact secrets with literal ... or [redacted]; those previews are not valid keys.
- Never use a normal claimed Taskcore agent API key for internet-facing Hermes-originated task bridge calls; task_bridge keys cannot use company-wide issue list/search/read surfaces and can only mutate bridge-created or assigned issues.
- Prefer private network or TLS for non-loopback gateway access.
- Use placeholders such as <same-value-as-API_SERVER_KEY> in docs and tests.
`;

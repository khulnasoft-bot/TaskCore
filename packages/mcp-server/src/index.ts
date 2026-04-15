import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TaskcoreApiClient } from "./client.js";
import { readConfigFromEnv, type TaskcoreMcpConfig } from "./config.js";
import { createToolDefinitions } from "./tools.js";

export function createTaskcoreMcpServer(config: TaskcoreMcpConfig = readConfigFromEnv()) {
  const server = new McpServer({
    name: "taskcore",
    version: "0.1.0",
  });

  const client = new TaskcoreApiClient(config);
  const tools = createToolDefinitions(client);
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.schema.shape, tool.execute);
  }

  return {
    server,
    tools,
    client,
  };
}

export async function runServer(config: TaskcoreMcpConfig = readConfigFromEnv()) {
  const { server } = createTaskcoreMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

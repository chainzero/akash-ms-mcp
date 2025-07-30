import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import * as netdata from "./netdata.js";
import * as akash from "./akash.js";

// Combine all tools from all services
export function getAllTools() {
  return [
    ...netdata.getTools(),
    ...akash.getTools(),
  ];
}

// Route tool calls to appropriate service
export async function handleToolCall(name: string, args: any) {
  // NetData tools
  if (netdata.getToolNames().includes(name)) {
    return await netdata.handleToolCall(name, args);
  }
  
  // Akash tools
  if (akash.getToolNames().includes(name)) {
    return await akash.handleToolCall(name, args);
  }
  
  throw new McpError(
    ErrorCode.MethodNotFound,
    `Unknown tool: ${name}`
  );
}
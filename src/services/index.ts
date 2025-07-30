import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import * as netdata from "./netdata.js";
import * as akash from "./akash.js";
import * as github from "./github.js";

// Combine all tools from all services
export function getAllTools() {
  return [
    ...netdata.getTools(),
    ...akash.getTools(),
    ...github.getTools(),
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
  
  // GitHub tools
  if (github.getToolNames().includes(name)) {
    return await github.handleToolCall(name, args);
  }
  
  throw new McpError(
    ErrorCode.MethodNotFound,
    `Unknown tool: ${name}`
  );
}
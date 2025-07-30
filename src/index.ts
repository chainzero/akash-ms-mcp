#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import { getAllTools, handleToolCall } from "./services/index.js";

import dotenv from "dotenv";
import { getAllTools, handleToolCall } from "./services/index.js";

// Add these debug lines here
console.error("DEBUG: Process CWD:", process.cwd());
console.error("DEBUG: .env file exists:", require('fs').existsSync('.env'));
console.error("DEBUG: Explicit path .env exists:", require('fs').existsSync('/opt/akash-ms-mcp/.env'));

// Load environment variables
dotenv.config({ path: '/opt/akash-ms-mcp/.env' });

// Add these debug lines after dotenv.config()
console.error("DEBUG: NETDATA_API_TOKEN after dotenv:", !!process.env.NETDATA_API_TOKEN);
console.error("DEBUG: NETDATA_API_TOKEN length:", process.env.NETDATA_API_TOKEN?.length || 0);

// Load environment variables
dotenv.config({ path: '/opt/akash-ms-mcp/.env' });

// Create server with tool capabilities
const server = new Server(
  {
    name: "netdata-mcp-server-enhanced",
    version: "2.10.1",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: getAllTools(),
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    return await handleToolCall(name, args);
  } catch (error) {
    console.error(`Error in ${name}:`, error);
    
    if (error instanceof McpError) {
      throw error;
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool ${name}: ${errorMessage}`
    );
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("NetData MCP Server (Enhanced with Clean Single-Source Alarm Reporting + Comprehensive Monitoring) started");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
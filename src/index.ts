#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import fs from 'fs';
import { getAllTools, handleToolCall } from "./services/index.js";

// Write debug to file
const debugInfo = `
=== DEBUG LOG ${new Date().toISOString()} ===
Process CWD: ${process.cwd()}
.env file exists (relative): ${fs.existsSync('.env')}
.env file exists (absolute): ${fs.existsSync('/opt/akash-ms-mcp/.env')}
BEFORE dotenv - NETDATA_API_TOKEN present: ${!!process.env.NETDATA_API_TOKEN}
=====================================

`;
fs.appendFileSync('/tmp/mcp-debug.log', debugInfo);


// Debug AFTER dotenv
const debugInfo2 = `
AFTER dotenv - NETDATA_API_TOKEN present: ${!!process.env.NETDATA_API_TOKEN}
NETDATA_API_TOKEN length: ${process.env.NETDATA_API_TOKEN?.length || 0}
NETDATA_SPACE_ID: ${process.env.NETDATA_SPACE_ID}
All NETDATA env vars: ${Object.keys(process.env).filter(k => k.startsWith('NETDATA')).join(', ')}

`;
fs.appendFileSync('/tmp/mcp-debug.log', debugInfo2);

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
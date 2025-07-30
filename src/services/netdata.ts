import axios from "axios";
import { 
  makeCloudRequest, 
  config, 
  ROOM_IDS, 
  METRIC_CATEGORIES,
  filterContextsByCategory,
  testMetricsInBatches
} from "../utils.js";
import type { ToolResponse, MetricTestResults, NetDataAlarmData } from "../types.js";

// NetData tool definitions
export function getTools() {
  return [
    {
      name: "get_space_info",
      description: "Get basic information about your NetData space",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_nodes_info",
      description: "Get information about nodes/rooms in your NetData space",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_infrastructure_overview",
      description: "Get comprehensive overview of entire NetData infrastructure",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_room_contexts",
      description: "Get all available metric contexts for a specific room",
      inputSchema: {
        type: "object",
        properties: {
          room_name: {
            type: "string",
            description: "Room name (e.g., 'valdi-sdg-h100')",
          },
        },
        required: ["room_name"],
      },
    },
    {
      name: "get_room_nodes",
      description: "Get all nodes in a specific room",
      inputSchema: {
        type: "object",
        properties: {
          room_name: {
            type: "string",
            description: "Room name (e.g., 'valdi-sdg-h100')",
          },
        },
        required: ["room_name"],
      },
    },
    {
      name: "test_room_parameter",
      description: "Test tool to verify room parameter passing works",
      inputSchema: {
        type: "object",
        properties: {
          room_name: {
            type: "string",
            description: "Room name to test",
          },
        },
        required: ["room_name"],
      },
    },
    {
      name: "debug_api_call",
      description: "Debug API call with simple output",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "test_direct_room_contexts",
      description: "Test direct room contexts call with hardcoded room ID (debugging)",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "test_category_metrics_activity",
      description: "Test metric activity for a specific category using direct agent queries on sandbox host",
      inputSchema: {
        type: "object",
        properties: {
          room_name: {
            type: "string",
            description: "Room name to get contexts from",
          },
          category: {
            type: "string",
            enum: Object.keys(METRIC_CATEGORIES),
            description: "Metric category to test (network, system, disk, memory, docker, kubernetes, applications, sensors, nvidia, netdata_internal)",
          },
        },
        required: ["room_name", "category"],
      },
    },
    {
      name: "test_network_metrics_activity",
      description: "Comprehensive test of network metric activity using direct agent queries",
      inputSchema: {
        type: "object",
        properties: {
          room_name: {
            type: "string",
            description: "Room name to analyze",
          },
        },
        required: ["room_name"],
      },
    },
    {
      name: "get_active_metrics_summary",
      description: "Get summary of active metrics across all categories using intelligent sampling",
      inputSchema: {
        type: "object",
        properties: {
          room_name: {
            type: "string",
            description: "Room name to analyze",
          },
          sample_size: {
            type: "number",
            description: "Number of metrics to test per category (default: 10)",
            default: 10,
          },
        },
        required: ["room_name"],
      },
    },
  ];
}

// Get tool names for routing
export function getToolNames() {
  return getTools().map(tool => tool.name);
}

// Route tool calls to appropriate handlers
export async function handleToolCall(name: string, args: any): Promise<ToolResponse> {
  switch (name) {
    case "get_space_info":
      return await getSpaceInfo(args);
    case "get_nodes_info":
      return await getNodesInfo(args);
    case "get_infrastructure_overview":
      return await getInfrastructureOverview(args);
    case "get_room_contexts":
      return await getRoomContexts(args);
    case "get_room_nodes":
      return await getRoomNodes(args);
    case "test_room_parameter":
      return await testRoomParameter(args);
    case "debug_api_call":
      return await debugApiCall(args);
    case "test_direct_room_contexts":
      return await testDirectRoomContexts(args);
    case "test_category_metrics_activity":
      return await testCategoryMetricsActivity(args);
    case "test_network_metrics_activity":
      return await testNetworkMetricsActivity(args);
    case "get_active_metrics_summary":
      return await getActiveMetricsSummary(args);
    default:
      throw new Error(`Unknown NetData tool: ${name}`);
  }
}

// Helper function to get critical alarm details from host agents
async function getCriticalAlarmDetails(roomsWithCriticals: any[]) {
  const criticalAlerts = [];
  
  for (const room of roomsWithCriticals) {
    try {
      // Get nodes for this room
      const nodesData = await makeCloudRequest(`/spaces/${config.netdata.spaceId}/rooms/${room.roomID}/nodes`);
      
      // Filter to only nodes that have critical alarms
      const nodesWithCriticals = nodesData.filter((node: any) => 
        node.alarmCounters && node.alarmCounters.critical > 0
      );
      
      // Query each node with critical alarms directly
      for (const node of nodesWithCriticals) {
        try {
          const alarmUrl = `http://${node.name}:19999/api/v1/alarms?active=true`;
          const response = await axios.get(alarmUrl, {
            timeout: config.netdata.agentTimeout,
          });
          
          const alarms = response.data.alarms || {};
          
          // Extract critical alarms
          for (const [alarmKey, alarmData] of Object.entries(alarms)) {
            const alarm = alarmData as any;
            if (alarm.status && alarm.status.toUpperCase() === 'CRITICAL') {
              criticalAlerts.push({
                host: node.name,
                alertName: alarm.name || alarmKey,
                status: alarm.status,
                description: alarm.info || 'Critical alert detected',
                chart: alarm.chart || 'Unknown',
                room: room.roomName
              });
            }
          }
        } catch (nodeError) {
          // Skip unreachable nodes silently
          continue;
        }
      }
    } catch (roomError) {
      // Skip rooms we can't query
      continue;
    }
  }
  
  return criticalAlerts;
}

// Get NetData alarms data
export async function getNetDataAlarms(): Promise<NetDataAlarmData> {
  try {
    // Fetch both alarms data and all rooms for complete name mapping
    const [alarmsData, roomsData] = await Promise.all([
      makeCloudRequest(`/spaces/${config.netdata.spaceId}/alarms`),
      makeCloudRequest(`/spaces/${config.netdata.spaceId}/rooms`)
    ]);
    
    // Process the alarm data
    const roomAlarms = alarmsData.results || [];
    
    // Create complete room ID to name mapping from API
    const roomIdToName = Object.fromEntries(
      roomsData.map((room: any) => [room.id, room.name])
    );
    
    let roomsWithAlarms = [];
    let roomsWithCriticals = [];
    
    roomAlarms.forEach((room: any) => {
      const warnings = room.alarmCounter?.warning || 0;
      const critical = room.alarmCounter?.critical || 0;
      const unreachable = room.unreachableCount || 0;
      
      // Track rooms with active alarms - only include rooms we can identify
      if ((warnings > 0 || critical > 0 || unreachable > 0) && roomIdToName[room.roomID]) {
        const roomData = {
          roomID: room.roomID,
          roomName: roomIdToName[room.roomID],
          warnings: warnings,
          critical: critical,
          unreachable: unreachable
        };
        
        // MINIMAL CHANGE: Only include "All nodes" to avoid double counting
        if (roomData.roomName === "All nodes") {
          roomsWithAlarms.push(roomData);
          
          // Track rooms with critical alarms for detailed querying
          if (critical > 0) {
            roomsWithCriticals.push(roomData);
          }
        }
      }
    });
    
    // Get detailed critical alarm information
    let criticalAlarmDetails = [];
    if (roomsWithCriticals.length > 0) {
      criticalAlarmDetails = await getCriticalAlarmDetails(roomsWithCriticals);
    }
    
    // Calculate totals ONLY from the rooms we're actually displaying
    const totalWarnings = roomsWithAlarms.reduce((sum, room) => sum + room.warnings, 0);
    const totalCritical = roomsWithAlarms.reduce((sum, room) => sum + room.critical, 0);
    const totalUnreachable = roomsWithAlarms.reduce((sum, room) => sum + room.unreachable, 0);
    
    return {
      totals: {
        warnings: totalWarnings,
        critical: totalCritical,
        unreachable: totalUnreachable,
        totalRooms: roomAlarms.length,
        roomsWithIssues: roomsWithAlarms.length
      },
      roomsWithAlarms: roomsWithAlarms,
      criticalAlarmDetails: criticalAlarmDetails,
      allRooms: roomAlarms
    };
  } catch (error: any) {
    return {
      error: error.message,
      totals: { warnings: 0, critical: 0, unreachable: 0, totalRooms: 0, roomsWithIssues: 0 },
      roomsWithAlarms: [],
      criticalAlarmDetails: [],
      allRooms: []
    };
  }
}

// =============================================================================
// NETDATA TOOL IMPLEMENTATIONS
// =============================================================================

async function getSpaceInfo(args: any): Promise<ToolResponse> {
  try {
    const spacesData = await makeCloudRequest('/spaces');
    return {
      content: [
        {
          type: "text",
          text: `NetData Space Information:\n${JSON.stringify(spacesData, null, 2)}`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error fetching space info: ${error.message}`,
        },
      ],
    };
  }
}

async function getNodesInfo(args: any): Promise<ToolResponse> {
  try {
    const nodesData = await makeCloudRequest(`/spaces/${config.netdata.spaceId}/rooms`);
    return {
      content: [
        {
          type: "text",
          text: `NetData Nodes Information:\n${JSON.stringify(nodesData, null, 2)}`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error fetching nodes info: ${error.message}`,
        },
      ],
    };
  }
}

async function getInfrastructureOverview(args: any): Promise<ToolResponse> {
  try {
    const spacesData = await makeCloudRequest('/spaces');
    const roomsData = await makeCloudRequest(`/spaces/${config.netdata.spaceId}/rooms`);

    const gpuRooms = roomsData.filter((room: any) =>
      room.name.toLowerCase().includes('h100') ||
      room.name.toLowerCase().includes('v100') ||
      room.name.toLowerCase().includes('4090')
    );

    const totalNodes = roomsData.reduce((sum: number, room: any) => sum + room.node_count, 0);
    const gpuNodes = gpuRooms.reduce((sum: number, room: any) => sum + room.node_count, 0);

    const analysis = {
      infrastructure_summary: {
        total_spaces: spacesData.length,
        total_rooms: roomsData.length,
        total_nodes: totalNodes,
        gpu_focused_rooms: gpuRooms.length,
        gpu_nodes: gpuNodes,
        compute_percentage: Math.round((gpuNodes / totalNodes) * 100)
      },
      gpu_infrastructure: {
        h100_rooms: gpuRooms.filter((r: any) => r.name.toLowerCase().includes('h100')).length,
        v100_rooms: gpuRooms.filter((r: any) => r.name.toLowerCase().includes('v100')).length,
        rtx4090_rooms: gpuRooms.filter((r: any) => r.name.toLowerCase().includes('4090')).length
      },
      provider_breakdown: {
        valdi: roomsData.filter((r: any) => r.name.toLowerCase().includes('valdi')).length,
        coreweave: roomsData.filter((r: any) => r.name.toLowerCase().includes('coreweave')).length,
        nebulablock: roomsData.filter((r: any) => r.name.toLowerCase().includes('nebulablock')).length,
        colo: roomsData.filter((r: any) => r.name.toLowerCase().includes('colo')).length
      },
      rooms_by_size: roomsData.map((room: any) => ({
        name: room.name,
        node_count: room.node_count,
        description: room.description
      })).sort((a: any, b: any) => b.node_count - a.node_count),

      next_steps: [
        'Use get_room_contexts to see metrics for specific rooms',
        'Use get_room_nodes for detailed hardware information',
        'Focus on GPU clusters for specialized monitoring requirements'
      ]
    };

    return {
      content: [
        {
          type: "text",
          text: `NetData Infrastructure Analysis (ENHANCED):\n${JSON.stringify(analysis, null, 2)}`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error analyzing infrastructure: ${error.message}`,
        },
      ],
    };
  }
}

async function getRoomContexts(args: any): Promise<ToolResponse> {
  const { room_name } = args || {};
  
  try {
    if (!room_name) {
      return {
        content: [
          {
            type: "text",
            text: "Error: room_name parameter is required",
          },
        ],
      };
    }

    const roomId = ROOM_IDS[room_name as keyof typeof ROOM_IDS];
    if (!roomId) {
      const availableRooms = Object.keys(ROOM_IDS).join(', ');
      return {
        content: [
          {
            type: "text",
            text: `Room "${room_name}" not found. Available rooms: ${availableRooms}`,
          },
        ],
      };
    }

    const endpoint = `/spaces/${config.netdata.spaceId}/rooms/${roomId}/contexts`;
    const contextsData = await makeCloudRequest(endpoint);
    
    const contexts = contextsData.results || contextsData;
    
    return {
      content: [
        {
          type: "text",
          text: `Room Contexts for "${room_name}" (${contexts.length} contexts found):\n${JSON.stringify(contexts, null, 2)}`,
        },
      ],
    };

  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error getting room contexts: ${error.message}`,
        },
      ],
    };
  }
}

async function getRoomNodes(args: any): Promise<ToolResponse> {
  const { room_name } = args || {};
  
  try {
    if (!room_name) {
      return {
        content: [
          {
            type: "text",
            text: "Error: room_name parameter is required",
          },
        ],
      };
    }

    const roomId = ROOM_IDS[room_name as keyof typeof ROOM_IDS];
    if (!roomId) {
      const availableRooms = Object.keys(ROOM_IDS).join(', ');
      return {
        content: [
          {
            type: "text",
            text: `Room "${room_name}" not found. Available rooms: ${availableRooms}`,
          },
        ],
      };
    }

    const endpoint = `/spaces/${config.netdata.spaceId}/rooms/${roomId}/nodes`;
    const nodesData = await makeCloudRequest(endpoint);
    
    return {
      content: [
        {
          type: "text",
          text: `Room Nodes for "${room_name}" (${nodesData.length} nodes found):\n${JSON.stringify(nodesData, null, 2)}`,
        },
      ],
    };

  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error getting room nodes: ${error.message}`,
        },
      ],
    };
  }
}

async function testRoomParameter(args: any): Promise<ToolResponse> {
  const { room_name } = args || {};
  
  return {
    content: [
      {
        type: "text",
        text: `Parameter test successful!\n\nRoom name received: ${room_name}\nRoom ID lookup: ${ROOM_IDS[room_name as keyof typeof ROOM_IDS] || 'Not found'}\nAPI token present: ${!!config.netdata.apiToken}\n\nThis confirms parameter passing works with enhanced pattern.`,
      },
    ],
  };
}

async function debugApiCall(args: any): Promise<ToolResponse> {
  return {
    content: [
      {
        type: "text",
        text: `Debug Info: spaceId=${config.netdata.spaceId}, tokenPresent=${!!config.netdata.apiToken}, baseUrl=${config.netdata.cloudBaseUrl}, sandboxHost=${config.netdata.sandboxHost}, akashApiUrl=${config.akash.providerApiUrl}`,
      },
    ],
  };
}

async function testDirectRoomContexts(args: any): Promise<ToolResponse> {
  const roomId = "016d43f2-d5c0-4a78-913c-a0bc91e245ed";
  
  const info = {
    space_id: config.netdata.spaceId,
    room_id: roomId,
    token_length: config.netdata.apiToken ? config.netdata.apiToken.length : 0,
    base_url: config.netdata.cloudBaseUrl
  };
  
  try {
    const response = await axios.get(`${config.netdata.cloudBaseUrl}/api/v2/spaces/${config.netdata.spaceId}/rooms/${roomId}/contexts`, {
      headers: {
        'Authorization': `Bearer ${config.netdata.apiToken}`,
        'Accept': 'application/json'
      }
    });
    
    return {
      content: [
        {
          type: "text",
          text: `SUCCESS: ${JSON.stringify(info)} - Got ${response.data.results ? response.data.results.length : 'unknown'} contexts`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `FAILED: ${JSON.stringify(info)} - Error: ${error.response?.status || error.message}`,
        },
      ],
    };
  }
}

async function testCategoryMetricsActivity(args: any): Promise<ToolResponse> {
  const { room_name, category } = args || {};
  
  if (!room_name || !category) {
    return {
      content: [
        {
          type: "text",
          text: "Error: room_name and category are required",
        },
      ],
    };
  }

  try {
    const contextsResponse = await getRoomContexts({ room_name });
    const contextsText = contextsResponse.content[0].text;
    
    const contextsMatch = contextsText.match(/\[(.*)\]/s);
    if (!contextsMatch) {
      throw new Error('Could not parse contexts from response');
    }
    
    const allContexts = JSON.parse('[' + contextsMatch[1] + ']');
    const categoryContexts = filterContextsByCategory(allContexts, category);
    
    if (categoryContexts.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No ${category} contexts found in room "${room_name}"`,
          },
        ],
      };
    }

    const results = await testMetricsInBatches(categoryContexts);
    
    const report = `
METRIC ACTIVITY ANALYSIS - ${category.toUpperCase()} CATEGORY
Room: ${room_name} (analyzed via sandbox host extrapolation)
Sandbox Host: ${config.netdata.sandboxHost}
Analysis Method: Direct agent queries on representative infrastructure
Date: ${new Date().toISOString()}

SUMMARY:
- Total ${category} contexts: ${results.summary.total}
- Active metrics: ${results.summary.activeCount}
- Inactive metrics: ${results.summary.inactiveCount}
- Errors: ${results.summary.errorCount}
- Success rate: ${((results.summary.activeCount / results.summary.tested) * 100).toFixed(1)}%

ACTIVE METRICS (${results.active.length}):
${results.active.map(m => `✅ ${m.context} (${m.dataPoints} data points)`).join('\n')}

${results.inactive.length > 0 ? `INACTIVE METRICS (${results.inactive.length}):
${results.inactive.slice(0, 20).map(m => `❌ ${m.context}`).join('\n')}${results.inactive.length > 20 ? `\n... and ${results.inactive.length - 20} more` : ''}` : ''}

${results.errors.length > 0 ? `ERRORS (${results.errors.length}):
${results.errors.map(m => `⚠️ ${m.context}: ${m.error}`).join('\n')}` : ''}

METHODOLOGY:
- Infrastructure Assumption: Uniform configuration across all nodes
- Representative Testing: Sandbox host (${config.netdata.sandboxHost}) as safe test target  
- Extrapolation: Results apply to all infrastructure due to identical setup
- Safety: Zero impact on production systems

This analysis bypassed Cloud API limitations using direct agent queries
for accurate metric activity detection.
    `;

    return {
      content: [
        {
          type: "text",
          text: report.trim(),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error testing ${category} metrics activity: ${error.message}`,
        },
      ],
    };
  }
}

async function testNetworkMetricsActivity(args: any): Promise<ToolResponse> {
  const { room_name } = args || {};
  
  if (!room_name) {
    return {
      content: [
        {
          type: "text",
          text: "Error: room_name is required",
        },
      ],
    };
  }

  return await testCategoryMetricsActivity({ room_name, category: 'network' });
}

async function getActiveMetricsSummary(args: any): Promise<ToolResponse> {
  const { room_name, sample_size = 10 } = args || {};
  
  if (!room_name) {
    return {
      content: [
        {
          type: "text",
          text: "Error: room_name is required",
        },
      ],
    };
  }

  try {
    const contextsResponse = await getRoomContexts({ room_name });
    const contextsText = contextsResponse.content[0].text;
    const contextsMatch = contextsText.match(/\[(.*)\]/s);
    
    if (!contextsMatch) {
      throw new Error('Could not parse contexts from response');
    }
    
    const allContexts = JSON.parse('[' + contextsMatch[1] + ']');
    
    const categoryResults: any = {};
    let totalActive = 0;
    let totalTested = 0;
    
    for (const [categoryName, prefixes] of Object.entries(METRIC_CATEGORIES)) {
      try {
        const categoryContexts = filterContextsByCategory(allContexts, categoryName);
        
        if (categoryContexts.length > 0) {
          const sample = categoryContexts.slice(0, sample_size);
          const results = await testMetricsInBatches(sample);
          
          categoryResults[categoryName] = {
            totalAvailable: categoryContexts.length,
            tested: results.summary.tested,
            active: results.summary.activeCount,
            activeRate: (results.summary.activeCount / results.summary.tested * 100).toFixed(1)
          };
          
          totalActive += results.summary.activeCount;
          totalTested += results.summary.tested;
          
          await new Promise(resolve => setTimeout(resolve, config.netdata.rateLimitDelay));
        }
      } catch (error: any) {
        categoryResults[categoryName] = {
          totalAvailable: 0,
          tested: 0,
          active: 0,
          activeRate: "0.0",
          error: error.message
        };
      }
    }
    
    const overallActiveRate = totalTested > 0 ? ((totalActive / totalTested) * 100).toFixed(1) : "0.0";
    
    const report = `
COMPREHENSIVE METRIC ACTIVITY SUMMARY
Room: ${room_name} (analyzed via sandbox host extrapolation)
Analysis Method: Intelligent sampling via sandbox host (${config.netdata.sandboxHost})
Sample Size: Up to ${sample_size} metrics per category
Infrastructure Assumption: Uniform configuration across all nodes
Date: ${new Date().toISOString()}

OVERALL SUMMARY:
- Total contexts available: ${allContexts.length}
- Total tested: ${totalTested}
- Total active: ${totalActive}
- Overall activity rate: ${overallActiveRate}%

CATEGORY BREAKDOWN:
${Object.entries(categoryResults).map(([category, stats]: [string, any]) => 
  `${category.padEnd(15)}: ${stats.active}/${stats.tested} active (${stats.activeRate}%) of ${stats.totalAvailable} available${stats.error ? ` [ERROR: ${stats.error}]` : ''}`
).join('\n')}

KEY INSIGHTS:
- Network monitoring: ${categoryResults.network ? `${categoryResults.network.activeRate}% active` : 'No network contexts found'}
- System monitoring: ${categoryResults.system ? `${categoryResults.system.activeRate}% active` : 'No system contexts found'}
- Application monitoring: ${categoryResults.applications ? `${categoryResults.applications.activeRate}% active` : 'No application contexts found'}

METHODOLOGY NOTES:
- Uses sandbox host (${config.netdata.sandboxHost}) for safe, non-production testing
- Extrapolates results to entire infrastructure based on uniform configuration
- Bypasses Cloud API limitations with direct agent queries
- Results representative of all infrastructure due to identical node setup

For detailed analysis of specific categories, use test_category_metrics_activity.
    `;

    return {
      content: [
        {
          type: "text",
          text: report.trim(),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error generating active metrics summary: ${error.message}`,
        },
      ],
    };
  }
}
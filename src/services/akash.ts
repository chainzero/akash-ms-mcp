import { makeAkashRequest, config } from "../utils.js";
import { getNetDataAlarms } from "./netdata.js";
import type { AkashProvider } from "../types.js";
import fs from 'fs';

// Akash tool definitions
export function getTools() {
  return [
    {
      name: "get_akash_providers_down",
      description: "Get list of Akash providers that are currently down",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_akash_gpu_issues",
      description: "Get list of Akash providers with GPU allocation issues",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_akash_cpu_issues",
      description: "Get list of Akash providers with CPU allocation issues",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_akash_memory_issues",
      description: "Get list of Akash providers with memory allocation issues",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_akash_partial_failures",
      description: "Get list of Akash providers with partial failures",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_akash_all_issues_report",
      description: "Get comprehensive report of all Akash provider issues (GPU, CPU, memory, down providers, partial failures)",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];
}

// Get tool names for routing
export function getToolNames() {
  return getTools().map(tool => tool.name);
}

// Route tool calls to appropriate handlers
export async function handleToolCall(name: string, args: any) {  switch (name) {
    case "get_akash_providers_down":
      return await getAkashProvidersDown(args);
    case "get_akash_gpu_issues":
      return await getAkashGpuIssues(args);
    case "get_akash_cpu_issues":
      return await getAkashCpuIssues(args);
    case "get_akash_memory_issues":
      return await getAkashMemoryIssues(args);
    case "get_akash_partial_failures":
      return await getAkashPartialFailures(args);
    case "get_akash_all_issues_report":
      return await getAkashAllIssuesReport(args);
    default:
      throw new Error(`Unknown Akash tool: ${name}`);
  }
}

// =============================================================================
// AKASH PROVIDER TOOL IMPLEMENTATIONS
// =============================================================================

async function getAkashProvidersDown(args: any) {
  try {
    const downProviders = await makeAkashRequest('/providers/down');
    
    if (!downProviders.down_providers || downProviders.down_providers.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "✅ All Akash providers are currently operational - no down providers detected.",
          },
        ],
      };
    }

    const report = `
🚨 AKASH PROVIDERS DOWN ALERT

Currently Down Providers: ${downProviders.down_providers.length}

DETAILS:
${downProviders.down_providers.map((provider: AkashProvider) => `
❌ ${provider.host}
   • Severity: ${provider.severity}
   • Down Duration: ${provider.failureDuration}
   • Total Failures: ${provider.failures?.toLocaleString()}
   • Status: Critical Infrastructure Issue
`).join('\n')}

SUMMARY:
- Total affected providers: ${downProviders.down_providers.length}
- Critical severity issues: ${downProviders.down_providers.filter((p: AkashProvider) => p.severity === 'Critical').length}
- Longest outage: ${downProviders.down_providers.reduce((max: string, p: AkashProvider) => (p.failureDuration || '0') > max ? (p.failureDuration || '0') : max, '0')}

⚠️ These providers are currently unavailable for new deployments.
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
          text: `Error fetching down providers: ${error.message}`,
        },
      ],
    };
  }
}

async function getAkashGpuIssues(args: any) {  
  try {
    const gpuIssues = await makeAkashRequest('/gpuissues');
    
    // DEBUG: Write to log file
    const debugData = {
      timestamp: new Date().toISOString(),
      rawResponse: gpuIssues,
      hasGpuIssues: 'gpu_issues' in gpuIssues,
      gpuIssuesLength: gpuIssues.gpu_issues?.length
    };
    
    fs.appendFileSync('/tmp/mcp-debug.log', JSON.stringify(debugData) + '\n');
    
    if (!gpuIssues.gpu_issues || !Array.isArray(gpuIssues.gpu_issues) || gpuIssues.gpu_issues.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "✅ No GPU allocation issues detected across Akash provider network.",
          },
        ],
      };
    }

    const report = `
⚠️ AKASH GPU ALLOCATION ISSUES

GPU Issues Detected: ${gpuIssues.gpu_issues.length}

DETAILED BREAKDOWN:
${gpuIssues.gpu_issues.map((provider: AkashProvider) => `
🔴 HOST: ${provider.host || provider.provider}
   • Node: ${provider.node || 'N/A'}
   • Allocatable: ${provider.allocatable || 'Unknown'}
   • Allocated: ${provider.allocated || 'Unknown'}
   • Capacity: ${provider.capacity || 'Unknown'}
   • Issue: ${provider.issue || provider.issue_type || 'GPU capacity vs. allocatable mismatch'}
`).join('\n')}

SUMMARY:
- Total providers with GPU issues: ${gpuIssues.gpu_issues.length}
- Issue types detected: Capacity mismatches, over-allocation
- Impact: May affect GPU deployment availability

These GPU allocation issues require attention to ensure proper resource management.
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
          text: `Error fetching GPU issues: ${error.message}`,
        },
      ],
    };
  }
}

async function getAkashCpuIssues(args: any) {
  try {
    const cpuIssues = await makeAkashRequest('/issues/res/cpu');
    
    if (!cpuIssues.nodes_with_issues || cpuIssues.nodes_with_issues.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "✅ No CPU allocation issues detected across Akash provider network.",
          },
        ],
      };
    }

    const report = `
⚠️ AKASH CPU ALLOCATION ISSUES

CPU Issues Detected: ${cpuIssues.nodes_with_issues.length}

DETAILED BREAKDOWN:
${cpuIssues.nodes_with_issues.map((node: AkashProvider) => `
🔴 HOST: ${node.host || node.provider}
   • Node: ${node.node || 'N/A'}
   • Allocatable: ${node.allocatable || 'Unknown'}
   • Allocated: ${node.allocated || 'Unknown'}
   • Utilization: ${node.allocated && node.allocatable ? 
     ((Number(node.allocated) / Number(node.allocatable)) * 100).toFixed(1) + '%' : 'Unknown'}
   • Issue: CPU over-allocation detected
`).join('\n')}

SUMMARY:
- Total nodes with CPU issues: ${cpuIssues.nodes_with_issues.length}
- Issue type: CPU allocation exceeding allocatable limits
- Impact: May affect deployment scheduling and performance

These CPU allocation issues require immediate attention.
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
          text: `Error fetching CPU issues: ${error.message}`,
        },
      ],
    };
  }
}

async function getAkashMemoryIssues(args: any) {
  try {
    const memoryIssues = await makeAkashRequest('/issues/res/memory');
    
    if (!memoryIssues.nodes_with_issues || memoryIssues.nodes_with_issues.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "✅ No memory allocation issues detected across Akash provider network.",
          },
        ],
      };
    }

    const report = `
⚠️ AKASH MEMORY ALLOCATION ISSUES

Memory Issues Detected: ${memoryIssues.nodes_with_issues.length}

DETAILED BREAKDOWN:
${memoryIssues.nodes_with_issues.map((node: AkashProvider) => `
🔴 HOST: ${node.host || node.provider}
   • Node: ${node.node || 'N/A'}
   • Allocatable: ${node.allocatable || 'Unknown'}
   • Allocated: ${node.allocated || 'Unknown'}
   • Utilization: ${node.allocated && node.allocatable ? 
     ((Number(node.allocated) / Number(node.allocatable)) * 100).toFixed(1) + '%' : 'Unknown'}
   • Issue: Memory over-allocation detected
`).join('\n')}

SUMMARY:
- Total nodes with memory issues: ${memoryIssues.nodes_with_issues.length}
- Issue type: Memory allocation exceeding allocatable limits
- Impact: May affect deployment scheduling and performance

These memory allocation issues require immediate attention.
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
          text: `Error fetching memory issues: ${error.message}`,
        },
      ],
    };
  }
}

async function getAkashPartialFailures(args: any) {
  try {
    const partialFailures = await makeAkashRequest('/providers/partialfailures');
    
    if (!partialFailures.providers_with_partial_failures || partialFailures.providers_with_partial_failures.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "✅ No partial provider failures detected across Akash provider network.",
          },
        ],
      };
    }

    const report = `
⚠️ AKASH PARTIAL PROVIDER FAILURES

Partial Failures Detected: ${partialFailures.providers_with_partial_failures.length}

DETAILED BREAKDOWN:
${partialFailures.providers_with_partial_failures.map((provider: AkashProvider) => `
🟡 HOST: ${provider.host || provider.provider}
   • Failed IPs: ${provider.failed_ips?.length || 'Unknown'}
   • Issue: ${provider.issue || 'DNS resolution failures (partial gRPC failures)'}
   • Status: Partially operational
`).join('\n')}

SUMMARY:
- Total providers with partial failures: ${partialFailures.providers_with_partial_failures.length}
- Issue type: DNS resolution failures, partial gRPC connectivity
- Impact: Reduced capacity, some services may be unavailable

These partial failures indicate connectivity issues that should be investigated.
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
          text: `Error fetching partial failures: ${error.message}`,
        },
      ],
    };
  }
}

async function getAkashAllIssuesReport(args: any) {
  try {
    // Fetch all issue types in parallel - including NetData alarms
    const [netdataAlarms, gpuIssues, cpuIssues, memoryIssues, downProviders, partialFailures] = await Promise.all([
      getNetDataAlarms(),
      makeAkashRequest('/gpuissues'),
      makeAkashRequest('/issues/res/cpu'),
      makeAkashRequest('/issues/res/memory'),
      makeAkashRequest('/providers/down'),
      makeAkashRequest('/providers/partialfailures')
    ]);

    // Helper function to format table rows
    const formatTableRow = (host: string, node: string, allocatable: string, allocated: string, capacity: string, issue: string) => {
      return `${(host || '').padEnd(40)} ${(node || '').padEnd(10)} ${(allocatable || '').toString().padEnd(13)} ${(allocated || '').toString().padEnd(11)} ${(capacity || '').toString().padEnd(9)} ${issue || ''}`;
    };

    const formatDownProviderRow = (host: string, severity: string, duration: string) => {
      return `${(host || '').padEnd(40)} ${(severity || '').padEnd(10)} ${duration || ''}`;
    };

    const formatAlarmRow = (roomName: string, warnings: number, critical: number, unreachable: number) => {
      return `${(roomName || '').padEnd(30)} ${warnings.toString().padEnd(10)} ${critical.toString().padEnd(10)} ${unreachable.toString().padEnd(12)}`;
    };

    // Build comprehensive report starting with NetData alarms
    let report = `
===== INFRASTRUCTURE & PROVIDER COMPREHENSIVE ISSUES REPORT =====
Generated: ${new Date().toISOString()}

===== NETDATA INFRASTRUCTURE ALERTS =====
`;

    if (netdataAlarms.error) {
      report += `
Error fetching NetData alarms: ${netdataAlarms.error}
`;
    } else if (netdataAlarms.totals.warnings === 0 && netdataAlarms.totals.critical === 0 && netdataAlarms.totals.unreachable === 0) {
      report += `
No active alerts detected across all infrastructure ✅
- Total rooms monitored: ${netdataAlarms.totals.totalRooms}
- All systems operational
`;
    } else {
      report += `
ALERT SUMMARY:
- Total Warnings: ${netdataAlarms.totals.warnings}
- Total Critical: ${netdataAlarms.totals.critical}
- Total Unreachable: ${netdataAlarms.totals.unreachable}

                              WARNINGS   CRITICAL   UNREACHABLE
${netdataAlarms.roomsWithAlarms.map(room => 
        formatAlarmRow(
          room.roomName,
          room.warnings,
          room.critical,
          room.unreachable
        )
      ).join('\n')}
`;
    }

    report += `
===== AKASH GPU ALLOCATION ISSUES =====
`;

    if (gpuIssues.gpu_issues && Array.isArray(gpuIssues.gpu_issues) && gpuIssues.gpu_issues.length > 0) {
      report += `
HOST                                     NODE       ALLOCATABLE   ALLOCATED   CAPACITY  ISSUE
${gpuIssues.gpu_issues.map((provider: AkashProvider) =>  
        formatTableRow(
          provider.host || provider.provider || '', 
          provider.node || 'N/A',
          provider.allocatable?.toString() || '-',
          provider.allocated?.toString() || '-', 
          provider.capacity?.toString() || '-',
          provider.issue || provider.issue_type || 'GPU capacity vs. allocatable mismatch'
        )
      ).join('\n')}
`;
    } else {
      report += `
No GPU allocation issues detected
`;
    }

    report += `
===== AKASH CPU ALLOCATION ISSUES =====
`;

    if (cpuIssues.nodes_with_issues && cpuIssues.nodes_with_issues.length > 0) {
      report += `
HOST                                     NODE       ALLOCATABLE   ALLOCATED   CAPACITY  ISSUE
${cpuIssues.nodes_with_issues.map((node: AkashProvider) => 
        formatTableRow(
          node.host || node.provider || '',
          node.node || 'N/A', 
          node.allocatable?.toString() || '-',
          node.allocated?.toString() || '-',
          '-',
          'CPU over-allocation detected'
        )
      ).join('\n')}
`;
    } else {
      report += `
No CPU allocation issues detected
`;
    }

    report += `
===== AKASH MEMORY ALLOCATION ISSUES =====
`;

    if (memoryIssues.nodes_with_issues && memoryIssues.nodes_with_issues.length > 0) {
      report += `
HOST                                     NODE       ALLOCATABLE   ALLOCATED   CAPACITY  ISSUE
${memoryIssues.nodes_with_issues.map((node: AkashProvider) => 
        formatTableRow(
          node.host || node.provider || '',
          node.node || 'N/A',
          node.allocatable?.toString() || '-', 
          node.allocated?.toString() || '-',
          '-',
          'Memory over-allocation detected'
        )
      ).join('\n')}
`;
    } else {
      report += `
No memory allocation issues detected
`;
    }

    report += `
===== AKASH DOWN PROVIDERS =====
`;

    if (downProviders.down_providers && downProviders.down_providers.length > 0) {
      report += `
HOST                                     SEVERITY   FAILURE_DURATION
${downProviders.down_providers.map((provider: AkashProvider) => 
        formatDownProviderRow(
          provider.host || '',
          provider.severity || '',
          provider.failureDuration || ''
        )
      ).join('\n')}
`;
    } else {
      report += `
No down providers detected
`;
    }

    report += `
===== AKASH PARTIAL PROVIDER FAILURES =====
`;

    if (partialFailures.providers_with_partial_failures && partialFailures.providers_with_partial_failures.length > 0) {
      report += `
HOST                                     FAILED_IPS  ISSUE
${partialFailures.providers_with_partial_failures.map((provider: AkashProvider) => 
        `${(provider.host || provider.provider || '').padEnd(40)} ${(provider.failed_ips?.length || 0).toString().padEnd(11)} ${provider.issue || 'DNS resolution failures'}`
      ).join('\n')}
`;
    } else {
      report += `
No partial provider failures detected
`;
    }

    // Enhanced summary statistics
    const totalInfrastructureIssues = netdataAlarms.totals.warnings + netdataAlarms.totals.critical + netdataAlarms.totals.unreachable;
    const totalAkashIssues = 
      (gpuIssues.gpu_issues?.length || 0) +
      (cpuIssues.nodes_with_issues?.length || 0) + 
      (memoryIssues.nodes_with_issues?.length || 0) +
      (downProviders.down_providers?.length || 0) +
      (partialFailures.providers_with_partial_failures?.length || 0);
    
    const totalAllIssues = totalInfrastructureIssues + totalAkashIssues;

    report += `
===== COMPREHENSIVE SUMMARY =====
INFRASTRUCTURE MONITORING (NetData):
- Warning Alerts: ${netdataAlarms.totals.warnings}
- Critical Alerts: ${netdataAlarms.totals.critical}
- Unreachable Nodes: ${netdataAlarms.totals.unreachable}
- Total Infrastructure Issues: ${totalInfrastructureIssues}

PROVIDER NETWORK MONITORING (Akash):
- GPU Issues: ${gpuIssues.gpu_issues?.length || 0}
- CPU Issues: ${cpuIssues.nodes_with_issues?.length || 0}
- Memory Issues: ${memoryIssues.nodes_with_issues?.length || 0}
- Down Providers: ${downProviders.down_providers?.length || 0}
- Partial Failures: ${partialFailures.providers_with_partial_failures?.length || 0}
- Total Provider Issues: ${totalAkashIssues}

OVERALL HEALTH STATUS:
Total Issues Detected: ${totalAllIssues}
Infrastructure Health: ${totalInfrastructureIssues === 0 ? '✅ All Infrastructure Operational' : '⚠️ Infrastructure Issues Detected'}
Provider Network Health: ${totalAkashIssues === 0 ? '✅ All Providers Operational' : '⚠️ Provider Issues Detected'}
Combined Status: ${totalAllIssues === 0 ? '✅ ALL SYSTEMS OPERATIONAL' : '🚨 ATTENTION REQUIRED - Issues Detected'}
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
          text: `Error generating comprehensive issues report: ${error.message}`,
        },
      ],
    };
  }
}
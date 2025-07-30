import axios from "axios";

// Load configuration from environment
export const config = {
  netdata: {
    cloudBaseUrl: process.env.NETDATA_CLOUD_URL || 'https://app.netdata.cloud',
    spaceId: process.env.NETDATA_SPACE_ID || '4e5af321-fd71-4cd7-8456-aa96d7029ab8',
    apiToken: process.env.NETDATA_API_TOKEN,
    sandboxHost: "216.153.63.25", // CoreWeave sandbox host
    agentTimeout: 5000, // 5 second timeout for direct agent queries
    rateLimitDelay: 100, // 100ms delay between requests
  },
  akash: {
    providerApiUrl: 'https://providermon.akashnet.net',
    apiTimeout: 10000, // 10 second timeout
  }
};

// Add this after the config object (around line 15)
console.error("DEBUG - Environment variables:");
console.error("NETDATA_API_TOKEN present:", !!process.env.NETDATA_API_TOKEN);
console.error("NETDATA_API_TOKEN length:", process.env.NETDATA_API_TOKEN?.length || 0);
console.error("NETDATA_SPACE_ID:", process.env.NETDATA_SPACE_ID);
console.error("Config token present:", !!config.netdata.apiToken);

// Known room IDs mapping
export const ROOM_IDS = {
  'valdi-sdg-h100': '016d43f2-d5c0-4a78-913c-a0bc91e245ed',
  'colo-he-nucs': '2421c260-1423-4f1a-bb47-ad5dc9e765fd',
  'colo-he-proxmox2': '2d177350-fe36-4f06-a211-364ba9b02abe',
  'evergreen-rtx-4090': '36629903-e073-4df9-836f-2e1512b4871e',
  'cato-v100': '72789f00-8cc4-48e3-90a0-3ea87170eb6a',
  'all-nodes': '93e19508-b494-4999-957f-802b48a2ba0d',
  'valdi-wdc-h100': 'b62ef6bd-2007-4a7a-a633-b8b62caf1e9e',
  'colo-he-proxmox': 'bbf6d7ac-faf7-4037-9b44-db1e2404bab1',
  'nebulablock-dfw-4090': 'fb090f13-2e25-494f-960a-04a751f7bd0e',
  'coreweave-sandbox': 'ffc6dce8-079f-4dc4-9b34-2a6f1e95a467'
};

// Metric category definitions for targeted testing
export const METRIC_CATEGORIES = {
  network: [
    'net.', 'ip.', 'ipv4.', 'ipv6.', 'system.net', 'netfilter.', 
    'k8s.cgroup.net_', 'netdata.network'
  ],
  system: [
    'system.cpu', 'system.ram', 'system.load', 'system.processes', 
    'system.entropy', 'system.uptime', 'system.interrupts'
  ],
  disk: ['disk.', 'system.io'],
  memory: ['mem.', 'system.pgpgio'],
  docker: ['docker.', 'cgroup.'],
  kubernetes: ['k8s.'],
  applications: ['app.', 'user.', 'usergroup.'],
  sensors: ['sensors.', 'system.hw.sensor'],
  nvidia: ['nvidia_smi.'],
  netdata_internal: ['netdata.']
};

// Helper function to make authenticated NetData Cloud API requests
export async function makeCloudRequest(endpoint: string, params = {}) {
  if (!config.netdata.apiToken) {
    throw new Error('NetData API token is not configured');
  }

  const headers = {
    'Authorization': `Bearer ${config.netdata.apiToken}`,
    'Accept': 'application/json',
  };

  try {
    const response = await axios.get(`${config.netdata.cloudBaseUrl}/api/v2${endpoint}`, {
      headers,
      params,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(`NetData Cloud API error: ${error.response?.data?.message || error.message}`);
  }
}

// Helper function to make Akash Provider API requests
export async function makeAkashRequest(endpoint: string) {
  try {
    const response = await axios.get(`${config.akash.providerApiUrl}${endpoint}`, {
      timeout: config.akash.apiTimeout,
      headers: {
        'Accept': 'application/json',
      }
    });
    return response.data;
  } catch (error: any) {
    throw new Error(`Akash Provider API error: ${error.response?.data?.message || error.message}`);
  }
}

// Direct agent query for metric activity testing
export async function queryAgentMetric(context: string, afterSeconds = -300) {
  const url = `http://${config.netdata.sandboxHost}:19999/api/v1/data?context=${context}&after=${afterSeconds}&before=0`;
  
  try {
    const response = await axios.get(url, {
      timeout: config.netdata.agentTimeout,
    });

    // Check if we have actual data points
    const hasData = response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0;
    
    return {
      context,
      active: hasData,
      dataPoints: hasData ? response.data.data.length : 0,
      labels: response.data.labels || [],
      lastValue: hasData ? response.data.data[0] : null,
      error: null
    };
  } catch (error: any) {
    return { 
      context, 
      active: false, 
      dataPoints: 0,
      labels: [],
      lastValue: null,
      error: error.message 
    };
  }
}

// Filter contexts by category
export function filterContextsByCategory(contexts: string[], category: string) {
  const prefixes = METRIC_CATEGORIES[category as keyof typeof METRIC_CATEGORIES];
  if (!prefixes) {
    throw new Error(`Unknown category: ${category}. Available: ${Object.keys(METRIC_CATEGORIES).join(', ')}`);
  }

  return contexts.filter(context => 
    prefixes.some(prefix => context.startsWith(prefix))
  );
}

// Rate-limited batch testing
export async function testMetricsInBatches(contexts: string[], batchSize = 5) {
  const results = {
    active: [] as any[],
    inactive: [] as any[],
    errors: [] as any[],
    summary: {
      total: contexts.length,
      tested: 0,
      activeCount: 0,
      inactiveCount: 0,
      errorCount: 0
    }
  };

  for (let i = 0; i < contexts.length; i += batchSize) {
    const batch = contexts.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchPromises = batch.map(context => queryAgentMetric(context));
    const batchResults = await Promise.all(batchPromises);
    
    // Categorize results
    for (const result of batchResults) {
      results.summary.tested++;
      
      if (result.error) {
        results.errors.push(result);
        results.summary.errorCount++;
      } else if (result.active) {
        results.active.push(result);
        results.summary.activeCount++;
      } else {
        results.inactive.push(result);
        results.summary.inactiveCount++;
      }
    }
    
    // Rate limiting: pause between batches
    if (i + batchSize < contexts.length) {
      await new Promise(resolve => setTimeout(resolve, config.netdata.rateLimitDelay));
    }
  }

  return results;
}
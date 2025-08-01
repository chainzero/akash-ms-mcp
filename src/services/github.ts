import axios from "axios";

// Fallback list - only used if API discovery fails
const FALLBACK_WIKI_PAGES = [
  'Home', 'Overview', 'Index', 'README',
  'RPC-Nodes', 'RPC_Nodes', 'RPC', 'Nodes',
  'Infrastructure', 'Servers', 'Providers',
  'Network', 'Deployment', 'Configuration',
  'Monitoring', 'Operations', 'Maintenance',
  'DevOps-Phone-Numbers', 'Contact', 'Engineers'
];

// GitHub configuration - will use environment variables
function getGitHubConfig() {
  return {
    token: process.env.GITHUB_TOKEN,
    repoOwner: process.env.REPO_OWNER || 'ovrclk',
    repoName: process.env.REPO_NAME || 'server-mgmt',
  };
}

// GitHub tool definitions
export function getTools() {
  return [
    {
      name: "search_wiki",
      description: "Search across GitHub wiki pages for specific content",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search term to look for in wiki pages"
          }
        },
        required: ["query"],
      },
    },
    {
      name: "get_wiki_page",
      description: "Retrieve content from a specific GitHub wiki page",
      inputSchema: {
        type: "object",
        properties: {
          page_name: {
            type: "string",
            description: "Name of the wiki page to retrieve (e.g., 'Home', 'engineering/PageName')"
          }
        },
        required: ["page_name"],
      },
    },
    {
      name: "list_rpc_nodes",
      description: "Extract and list all RPC node information from the engineering wiki",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_wiki_pages_list",
      description: "Get list of all available wiki pages (dynamically discovered)",
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
export async function handleToolCall(name: string, args: any) {
  switch (name) {
    case "search_wiki":
      return await searchWiki(args);
    case "get_wiki_page":
      return await getWikiPage(args);
    case "list_rpc_nodes":
      return await listRpcNodes(args);
    case "get_wiki_pages_list":
      return await getWikiPagesList(args);
    default:
      throw new Error(`Unknown GitHub tool: ${name}`);
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Helper function to make authenticated requests to GitHub
async function makeGitHubRequest(url: string, options: any = {}) {
  const config = getGitHubConfig();

  if (!config.token) {
    throw new Error('GitHub token is not configured');
  }

  const headers = {
    'Authorization': `token ${config.token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Akash-MCP-Server',
    ...options.headers
  };

  try {
    const response = await axios.get(url, { headers, ...options });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // Page not found
    }
    throw new Error(`GitHub API error: ${error.response?.data?.message || error.message}`);
  }
}

// Helper function to get all wiki pages using Git Trees API
async function getAllWikiPages(): Promise<string[]> {
  const config = getGitHubConfig();
  
  try {
    // Get the default branch (usually master/main) tree for the wiki repo
    const treeUrl = `https://api.github.com/repos/${config.repoOwner}/${config.repoName}.wiki/git/trees/master?recursive=1`;
    const treeData = await makeGitHubRequest(treeUrl);
    
    if (!treeData || !treeData.tree) {
      return [];
    }
    
    // Extract all .md files from the tree
    const allPages: string[] = [];
    
    for (const item of treeData.tree) {
      if (item.type === 'blob' && item.path.endsWith('.md')) {
        // Remove .md extension and add to list
        allPages.push(item.path.replace('.md', ''));
      }
    }
    
    return allPages;
  } catch (error) {
    // If master doesn't work, try main branch
    try {
      const treeUrl = `https://api.github.com/repos/${config.repoOwner}/${config.repoName}.wiki/git/trees/main?recursive=1`;
      const treeData = await makeGitHubRequest(treeUrl);
      
      if (!treeData || !treeData.tree) {
        return [];
      }
      
      const allPages: string[] = [];
      
      for (const item of treeData.tree) {
        if (item.type === 'blob' && item.path.endsWith('.md')) {
          allPages.push(item.path.replace('.md', ''));
        }
      }
      
      return allPages;
    } catch (error2) {
      return []; // Both failed
    }
  }
}

// Helper function to get wiki page content
async function getWikiPageContent(pageName: string) {
  const config = getGitHubConfig();
  const url = `https://raw.githubusercontent.com/wiki/${config.repoOwner}/${config.repoName}/${pageName}.md`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `token ${config.token}`,
      }
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch wiki page: ${error.message}`);
  }
}

// Helper function to search wiki content dynamically
async function searchWikiContent(searchTerm: string) {
  // First, get all available wiki pages dynamically
  let allPages = await getAllWikiPages();
  
  if (allPages.length === 0) {
    // Fallback to our hardcoded list if API fails
    allPages = FALLBACK_WIKI_PAGES;
  }
  
  const results = [];
  
  for (const pageName of allPages) {
    try {
      const content = await getWikiPageContent(pageName);
      if (content && content.toLowerCase().includes(searchTerm.toLowerCase())) {
        results.push({
          page: pageName,
          content: content,
          preview: content.substring(0, 200) + '...'
        });
      }
    } catch (error) {
      // Skip pages that can't be accessed
      continue;
    }
  }
  
  return results;
}

// Helper function to extract RPC nodes from wiki content
async function extractRPCNodes() {
  // Get all pages dynamically, then filter for RPC-related ones
  let allPages = await getAllWikiPages();
  
  if (allPages.length === 0) {
    // Fallback to specific RPC pages
    allPages = ['RPC-Nodes', 'RPC_Nodes', 'RPC', 'Home', 'Overview'];
  }
  
  // Filter to likely RPC-related pages
  const rpcPages = allPages.filter(page => 
    page.toLowerCase().includes('rpc') || 
    page.toLowerCase().includes('node') ||
    page === 'Home' || 
    page === 'Overview'
  );
  
  const rpcInfo = {
    nodes: [] as string[],
    endpoints: [] as string[],
    raw_content: {} as Record<string, string>
  };

  for (const pageName of rpcPages) {
    try {
      const content = await getWikiPageContent(pageName);
      if (content) {
        rpcInfo.raw_content[pageName] = content;

        // Extract URLs that look like RPC/API endpoints
        const urlRegex = /(https?:\/\/[^\s\)]+(?:rpc|api|grpc)[^\s\)]*)/gi;
        const matches = content.match(urlRegex) || [];

        matches.forEach((url: string) => {
          if (!rpcInfo.endpoints.includes(url)) {
            rpcInfo.endpoints.push(url);
          }
        });

        // Look for structured RPC information
        const lines = content.split('\n');
        lines.forEach((line: string) => {
          if (line.toLowerCase().includes('rpc:') ||
              line.toLowerCase().includes('api:') ||
              line.toLowerCase().includes('grpc:')) {
            rpcInfo.nodes.push(line.trim());
          }
        });
      }
    } catch (error) {
      // Skip pages that can't be accessed
      continue;
    }
  }

  return rpcInfo;
}

// =============================================================================
// GITHUB WIKI TOOL IMPLEMENTATIONS
// =============================================================================

async function searchWiki(args: any) {
  const { query } = args;

  if (!query) {
    return {
      content: [{
        type: "text",
        text: "Error: query parameter is required"
      }]
    };
  }

  try {
    const results = await searchWikiContent(query);

    if (results.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No wiki pages found containing "${query}"`
        }]
      };
    }

    const searchResults = results.map(result => ({
      page: result.page,
      preview: result.preview,
      found_in: `Page: ${result.page}`
    }));

    return {
      content: [{
        type: "text",
        text: `Found ${results.length} wiki page(s) containing "${query}":\n\n${JSON.stringify(searchResults, null, 2)}`
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: "text",
        text: `Error searching wiki: ${error.message}`
      }]
    };
  }
}

async function getWikiPage(args: any) {
  const { page_name } = args;

  if (!page_name) {
    return {
      content: [{
        type: "text",
        text: "Error: page_name parameter is required"
      }]
    };
  }

  try {
    const content = await getWikiPageContent(page_name);

    if (!content) {
      // Try to get available pages to suggest alternatives
      const allPages = await getAllWikiPages();
      const pageList = allPages.length > 0 ? allPages.join(', ') : 'Home, Overview, DevOps-Phone-Numbers';
      
      return {
        content: [{
          type: "text",
          text: `Wiki page "${page_name}" not found. Available pages: ${pageList}`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Content from wiki page "${page_name}":\n\n${content}`
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: "text",
        text: `Error getting wiki page: ${error.message}`
      }]
    };
  }
}

async function listRpcNodes(args: any) {
  try {
    const rpcInfo = await extractRPCNodes();

    const summary = {
      total_endpoints: rpcInfo.endpoints.length,
      total_nodes: rpcInfo.nodes.length,
      endpoints: rpcInfo.endpoints,
      nodes: rpcInfo.nodes,
      pages_searched: Object.keys(rpcInfo.raw_content)
    };

    return {
      content: [{
        type: "text",
        text: `RPC Nodes Information:\n\n${JSON.stringify(summary, null, 2)}`
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: "text",
        text: `Error extracting RPC nodes: ${error.message}`
      }]
    };
  }
}

async function getWikiPagesList(args: any) {
  try {
    // Get all pages dynamically
    const allPages = await getAllWikiPages();
    
    if (allPages.length === 0) {
      // Fallback to common page names
      return {
        content: [{
          type: "text",
          text: `Unable to fetch wiki pages dynamically. Common wiki pages to try:\n${FALLBACK_WIKI_PAGES.join(', ')}\n\nNote: Use get_wiki_page tool to retrieve specific page content.`
        }]
      };
    }

    // Organize pages by directory structure
    const rootPages = allPages.filter(page => !page.includes('/'));
    const subPages = allPages.filter(page => page.includes('/'));
    
    let response = `Dynamically discovered wiki pages:\n\n`;
    
    if (rootPages.length > 0) {
      response += `Root Level Pages (${rootPages.length}):\n${rootPages.join(', ')}\n\n`;
    }
    
    if (subPages.length > 0) {
      response += `Subdirectory Pages (${subPages.length}):\n${subPages.join(', ')}\n\n`;
    }
    
    response += `Total pages found: ${allPages.length}\n\nUse get_wiki_page tool to retrieve specific page content.`;

    return {
      content: [{
        type: "text",
        text: response
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: "text",
        text: `Error listing wiki pages: ${error.message}\n\nTry common pages: Home, Overview, DevOps-Phone-Numbers`
      }]
    };
  }
}
# Akash Managed Services MCP Server

A comprehensive Model Context Protocol (MCP) server that provides infrastructure monitoring and provider network management through NetData Cloud and Akash Network APIs.

## Features

### 🌐 NetData Infrastructure Monitoring
- **Space & Node Management**: Get comprehensive information about your NetData spaces, rooms, and nodes
- **Infrastructure Overview**: Analyze GPU clusters, provider breakdown, and compute resources
- **Metric Activity Analysis**: Test and analyze metric activity across different categories (network, system, disk, memory, docker, kubernetes, applications, sensors, nvidia)
- **Real-time Monitoring**: Direct agent queries for accurate metric detection
- **Room-based Analysis**: Get contexts and nodes for specific infrastructure rooms

### ⚡ Akash Provider Network Monitoring
- **Provider Health Monitoring**: Track down providers and operational status
- **Resource Allocation Issues**: Monitor GPU, CPU, and memory allocation problems
- **Partial Failure Detection**: Identify providers with DNS resolution or gRPC connectivity issues
- **Comprehensive Reporting**: Combined infrastructure and provider health reports

### 🔧 Advanced Capabilities
- **Intelligent Sampling**: Efficient metric testing with configurable sample sizes
- **Rate-limited Queries**: Safe batch processing to avoid overwhelming systems
- **Cross-platform Analysis**: Unified monitoring across NetData and Akash ecosystems
- **Detailed Alarm Analysis**: Critical alert detection with host-level details

## Architecture

The server is organized using a modular architecture for maintainability:

```
src/
├── index.ts                 # Main server entry point
├── types.ts                 # Shared type definitions  
├── utils.ts                 # Shared utilities & configuration
└── services/
    ├── index.ts             # Service coordinator
    ├── netdata.ts           # NetData service implementation
    └── akash.ts             # Akash service implementation
```

## Installation

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd netdata-mcp-server
   npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file with your configuration:
   ```env
   # NetData Configuration
   NETDATA_CLOUD_URL=https://app.netdata.cloud
   NETDATA_SPACE_ID=your-space-id-here
   NETDATA_API_TOKEN=your-netdata-api-token-here
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

## Usage

### Running the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Available Tools

#### NetData Tools

| Tool | Description |
|------|-------------|
| `get_space_info` | Get basic information about your NetData space |
| `get_nodes_info` | Get information about nodes/rooms in your NetData space |
| `get_infrastructure_overview` | Get comprehensive overview of entire NetData infrastructure |
| `get_room_contexts` | Get all available metric contexts for a specific room |
| `get_room_nodes` | Get all nodes in a specific room |
| `test_category_metrics_activity` | Test metric activity for a specific category |
| `get_active_metrics_summary` | Get summary of active metrics across all categories |

#### Akash Tools

| Tool | Description |
|------|-------------|
| `get_akash_providers_down` | Get list of Akash providers that are currently down |
| `get_akash_gpu_issues` | Get list of Akash providers with GPU allocation issues |
| `get_akash_cpu_issues` | Get list of Akash providers with CPU allocation issues |
| `get_akash_memory_issues` | Get list of Akash providers with memory allocation issues |
| `get_akash_partial_failures` | Get list of Akash providers with partial failures |
| `get_akash_all_issues_report` | Get comprehensive report of all issues |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NETDATA_CLOUD_URL` | NetData Cloud API base URL | `https://app.netdata.cloud` |
| `NETDATA_SPACE_ID` | Your NetData space identifier | Required |
| `NETDATA_API_TOKEN` | NetData API authentication token | Required |

### Known Room IDs

The server includes predefined room mappings for:
- `valdi-sdg-h100` - Valdi H100 GPU cluster
- `colo-he-nucs` - Colocation NUC cluster  
- `evergreen-rtx-4090` - RTX 4090 cluster
- `cato-v100` - V100 GPU cluster
- `coreweave-sandbox` - CoreWeave sandbox environment
- And more...

## Examples

### Get Infrastructure Overview
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_infrastructure_overview",
    "arguments": {}
  }
}
```

### Test Network Metrics Activity
```json
{
  "method": "tools/call", 
  "params": {
    "name": "test_category_metrics_activity",
    "arguments": {
      "room_name": "valdi-sdg-h100",
      "category": "network"
    }
  }
}
```

### Get Comprehensive Issues Report
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_akash_all_issues_report", 
    "arguments": {}
  }
}
```

## Metric Categories

The server supports analysis across these metric categories:

- **Network**: `net.`, `ip.`, `ipv4.`, `ipv6.`, `system.net`, `netfilter.`
- **System**: `system.cpu`, `system.ram`, `system.load`, `system.processes`
- **Disk**: `disk.`, `system.io`
- **Memory**: `mem.`, `system.pgpgio`
- **Docker**: `docker.`, `cgroup.`
- **Kubernetes**: `k8s.`
- **Applications**: `app.`, `user.`, `usergroup.`
- **Sensors**: `sensors.`, `system.hw.sensor`
- **NVIDIA**: `nvidia_smi.`
- **NetData Internal**: `netdata.`

## Methodology

### Metric Activity Testing
- **Infrastructure Assumption**: Uniform configuration across all nodes
- **Representative Testing**: Uses sandbox host for safe, non-production testing
- **Extrapolation**: Results apply to entire infrastructure due to identical setup
- **Rate Limiting**: Intelligent batching to prevent system overload

### Safety Features
- **Non-invasive Monitoring**: Read-only operations, no system modifications
- **Timeout Protection**: Configurable timeouts prevent hanging requests
- **Error Handling**: Graceful degradation when services are unavailable
- **Batch Processing**: Rate-limited queries to respect API limits

## API Integrations

### NetData Cloud API
- **Spaces**: Manage NetData organizational spaces
- **Rooms**: Group nodes by logical infrastructure segments
- **Contexts**: Access metric definitions and metadata
- **Alarms**: Real-time alert and health monitoring

### Akash Provider API
- **Provider Status**: Monitor decentralized cloud provider health
- **Resource Allocation**: Track GPU, CPU, and memory utilization
- **Network Health**: Detect connectivity and DNS issues
- **Failure Analysis**: Comprehensive provider failure reporting

## Development

### Adding New Tools

1. **Define the tool** in the appropriate service (`netdata.ts` or `akash.ts`)
2. **Add to tool list** in the `getTools()` function
3. **Implement handler** in the `handleToolCall()` function
4. **Add types** to `types.ts` if needed
5. **Update documentation**

### Project Structure

- **Modular Design**: Separate services for different API integrations
- **Type Safety**: Comprehensive TypeScript definitions
- **Shared Utilities**: Common functions and configurations
- **Error Handling**: Consistent error patterns across all tools

## Troubleshooting

### Common Issues

1. **API Token Issues**:
   - Verify `NETDATA_API_TOKEN` is correctly set
   - Check token permissions and expiration

2. **Room Not Found**:
   - Use `get_nodes_info` to see available rooms
   - Check room name spelling (case-sensitive)

3. **Connection Timeouts**:
   - Check network connectivity to NetData Cloud
   - Verify firewall settings for API access

4. **Empty Metric Results**:
   - Try different room names or categories
   - Check if metrics are actively collecting data

### Debug Tools

Use these tools for troubleshooting:
- `debug_api_call` - Basic API connectivity test
- `test_room_parameter` - Parameter passing verification
- `test_direct_room_contexts` - Direct API call testing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the existing patterns
4. Add tests for new functionality  
5. Submit a pull request

## License

[Add your license information here]

## Version History

- **v2.10.1** - Refactored modular architecture, enhanced error handling
- **v2.10.0** - Added comprehensive Akash provider monitoring
- **v2.9.x** - Enhanced NetData metric analysis capabilities
- **v2.8.x** - Initial infrastructure monitoring implementation
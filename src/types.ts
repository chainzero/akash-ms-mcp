// Shared type definitions

export interface ToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

export interface MetricResult {
  context: string;
  active: boolean;
  dataPoints: number;
  labels: string[];
  lastValue: any;
  error: string | null;
}

export interface MetricTestResults {
  active: MetricResult[];
  inactive: MetricResult[];
  errors: MetricResult[];
  summary: {
    total: number;
    tested: number;
    activeCount: number;
    inactiveCount: number;
    errorCount: number;
  };
}

export interface NetDataAlarmData {
  totals: {
    warnings: number;
    critical: number;
    unreachable: number;
    totalRooms: number;
    roomsWithIssues: number;
  };
  roomsWithAlarms: Array<{
    roomID: string;
    roomName: string;
    warnings: number;
    critical: number;
    unreachable: number;
  }>;
  criticalAlarmDetails: Array<{
    host: string;
    alertName: string;
    status: string;
    description: string;
    chart: string;
    room: string;
  }>;
  allRooms: any[];
  error?: string;
}

export interface AkashProvider {
  host?: string;
  provider?: string;
  node?: string;
  allocatable?: number | string;
  allocated?: number | string;
  capacity?: number | string;
  issue?: string;
  issue_type?: string;
  severity?: string;
  failureDuration?: string;
  failures?: number;
  failed_ips?: string[];
}
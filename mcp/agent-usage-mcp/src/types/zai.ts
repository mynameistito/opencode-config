export interface QuotaLimit {
  type: "Token Usage (5h window)" | "MCP Usage (Monthly)" | string;
  percentage: number;
  used?: number;
  total?: number;
}

export interface QuotaResult {
  limits: QuotaLimit[];
}

export interface ModelUsage {
  model: string;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
}

export interface ModelUsageResult {
  period_hours: number;
  total_tokens?: number;
  models: ModelUsage[];
}

export interface ToolUsageResult {
  period_hours: number;
  web_search_count: number;
  web_reader_count: number;
}

export interface FullUsageResult {
  quota: QuotaResult;
  model_usage: ModelUsageResult;
  tool_usage: ToolUsageResult;
}

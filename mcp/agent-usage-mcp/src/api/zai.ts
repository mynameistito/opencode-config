import type {
  ModelUsageResult,
  QuotaResult,
  ToolUsageResult,
} from "../types/zai.js";
import { config } from "../utils/config.js";
import { getTimeWindow } from "../utils/time.js";
import {
  ModelUsageResponseSchema,
  QuotaResponseSchema,
  ToolUsageResponseSchema,
} from "../utils/validation.js";
import { httpGet } from "./http.js";

function getAuthHeaders(): Record<string, string> {
  if (!config.zaiApiKey) {
    throw new Error("OC_ZAI_API_KEY environment variable is not set");
  }
  return {
    Authorization: `Bearer ${config.zaiApiKey}`,
    "Accept-Language": "en-US,en",
    "Content-Type": "application/json",
  };
}

function mapQuotaType(limitType: string): string {
  if (limitType === "TOKENS_LIMIT") {
    return "Token Usage (5h window)";
  }
  if (limitType === "TIME_LIMIT") {
    return "MCP Usage (Monthly)";
  }
  return limitType;
}

export async function fetchQuota(): Promise<QuotaResult> {
  const response = await httpGet(
    config.zaiApiHost,
    "/api/monitor/usage/quota/limit",
    getAuthHeaders(),
    QuotaResponseSchema
  );

  const limits = response.data?.limits ?? [];
  return {
    limits: limits.map((limit) => ({
      type: mapQuotaType(limit.type),
      percentage: limit.percentage ?? 0,
      ...(limit.used !== undefined ? { used: limit.used } : {}),
      ...(limit.total !== undefined ? { total: limit.total } : {}),
    })),
  };
}

export async function fetchModelUsage(
  hours: number
): Promise<ModelUsageResult> {
  const { startTime, endTime } = getTimeWindow(hours);
  const response = await httpGet(
    config.zaiApiHost,
    `/api/monitor/usage/model-usage?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`,
    getAuthHeaders(),
    ModelUsageResponseSchema
  );

  const models = response.data?.modelUsages ?? [];
  const result: ModelUsageResult = {
    period_hours: hours,
    models: models.map((m) => ({
      model: m.modelName ?? m.model ?? "unknown",
      tokens: m.totalTokensUsage ?? m.tokensUsage ?? 0,
      input_tokens: m.inputTokensUsage ?? 0,
      output_tokens: m.outputTokensUsage ?? 0,
    })),
  };
  if (response.data?.totalUsage?.totalTokensUsage !== undefined) {
    result.total_tokens = response.data.totalUsage.totalTokensUsage;
  }
  return result;
}

export async function fetchToolUsage(hours: number): Promise<ToolUsageResult> {
  const { startTime, endTime } = getTimeWindow(hours);
  const response = await httpGet(
    config.zaiApiHost,
    `/api/monitor/usage/tool-usage?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`,
    getAuthHeaders(),
    ToolUsageResponseSchema
  );

  return {
    period_hours: hours,
    web_search_count: response.data?.totalUsage?.totalNetworkSearchCount ?? 0,
    web_reader_count: response.data?.totalUsage?.totalWebReadMcpCount ?? 0,
  };
}

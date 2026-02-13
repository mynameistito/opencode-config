import { fetchModelUsage, fetchQuota, fetchToolUsage } from "../api/zai.js";
import type {
  FullUsageResult,
  ModelUsageResult,
  QuotaResult,
  ToolUsageResult,
} from "../types/zai.js";
import { validateHours } from "../utils/time.js";

export async function getQuota(): Promise<QuotaResult> {
  return await fetchQuota();
}

export async function getModelUsage(hours: unknown): Promise<ModelUsageResult> {
  return await fetchModelUsage(validateHours(hours));
}

export async function getToolUsage(hours: unknown): Promise<ToolUsageResult> {
  return await fetchToolUsage(validateHours(hours));
}

export async function getFullUsage(hours: unknown): Promise<FullUsageResult> {
  const validHours = validateHours(hours);
  const [quota, model_usage, tool_usage] = await Promise.all([
    getQuota(),
    getModelUsage(validHours),
    getToolUsage(validHours),
  ]);
  return { quota, model_usage, tool_usage };
}

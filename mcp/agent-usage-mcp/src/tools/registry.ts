import type { ToolDefinition } from "../types/mcp.js";
import {
  getAntigravityAccountQuota,
  getAntigravityQuota,
} from "./antigravity.js";
import { getFullUsage, getModelUsage, getQuota, getToolUsage } from "./zai.js";

export const TOOLS: ToolDefinition[] = [
  {
    name: "get_usage",
    description:
      "Get a complete overview of Z.AI account usage including quota limits, model token usage, and tool usage (web search, web reader). This is the recommended tool for a full usage summary.",
    inputSchema: {
      type: "object",
      properties: {
        hours: {
          type: "number",
          description:
            "Number of hours to look back for usage data (default: 24). Quota limits are always current regardless of this value.",
          default: 24,
        },
      },
    },
  },
  {
    name: "get_quota",
    description:
      "Get your Z.AI account quota limits, including token usage (5h window), MCP monthly usage, and percentage utilized.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_model_usage",
    description:
      "Get token usage breakdown by model for your Z.AI account, including input and output tokens.",
    inputSchema: {
      type: "object",
      properties: {
        hours: {
          type: "number",
          description:
            "Number of hours to look back (default: 24). Must be greater than 0.",
          default: 24,
        },
      },
    },
  },
  {
    name: "get_tool_usage",
    description:
      "Get usage count for Z.AI tools including web search and web reader MCP.",
    inputSchema: {
      type: "object",
      properties: {
        hours: {
          type: "number",
          description:
            "Number of hours to look back (default: 24). Must be greater than 0.",
          default: 24,
        },
      },
    },
  },
  {
    name: "get_antigravity_quota",
    description:
      "Get Antigravity (Google Cloud Code) quota for all configured accounts. Returns available models and Gemini CLI quota across all accounts with a summary.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_antigravity_account_quota",
    description:
      "Get Antigravity quota for a specific account by email or index (0-based).",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: ["string", "number"],
          description:
            "Either the account email (string) or index (0, 1, 2, etc.).",
        },
      },
      required: ["account"],
    },
  },
];

export function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "get_usage":
      return getFullUsage(args.hours);
    case "get_quota":
      return getQuota();
    case "get_model_usage":
      return getModelUsage(args.hours);
    case "get_tool_usage":
      return getToolUsage(args.hours);
    case "get_antigravity_quota":
      return getAntigravityQuota();
    case "get_antigravity_account_quota":
      return getAntigravityAccountQuota(args.account);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

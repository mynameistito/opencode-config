import { executeTool, TOOLS } from "./tools/registry.js";
import type {
  JsonRpcRequest,
  McpInitializeResult,
  McpToolResult,
} from "./types/mcp.js";
import { config } from "./utils/config.js";

export function makeResponse(
  id: string | number | null,
  result: unknown
): string {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

export function makeError(
  id: string | number | null,
  code: number,
  message: string
): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
}

export async function handleMessage(
  msg: JsonRpcRequest
): Promise<string | null> {
  // Notifications (no id) don't need responses
  if (msg.id === undefined) {
    return null;
  }

  try {
    switch (msg.method) {
      case "initialize": {
        const result: McpInitializeResult = {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: config.serverName,
            version: config.serverVersion,
          },
        };
        return makeResponse(msg.id, result);
      }

      case "ping":
        return makeResponse(msg.id, {});

      case "tools/list":
        return makeResponse(msg.id, { tools: TOOLS });

      case "tools/call": {
        const params = msg.params as {
          name: string;
          arguments: Record<string, unknown>;
        };
        const result = await executeTool(params.name, params.arguments ?? {});
        const toolResult: McpToolResult = {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
        return makeResponse(msg.id, toolResult);
      }

      default:
        return makeError(msg.id, -32_601, `Method not found: ${msg.method}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return makeError(msg.id, -32_000, message);
  }
}

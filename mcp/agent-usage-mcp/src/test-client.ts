import { type ChildProcess, spawn } from "node:child_process";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<
      string,
      { type: string | string[]; description?: string; default?: unknown }
    >;
  };
}

class MCPTestClient {
  private readonly server: ChildProcess;
  private requestId = 0;
  private readonly pendingResponses = new Map<
    number | string,
    {
      resolve: (value: JsonRpcResponse) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(command: string, args: string[]) {
    this.server = spawn(command, args, {
      stdio: ["pipe", "pipe", "inherit"],
    });

    this.server.on("error", (error) => {
      console.error("Server error:", error);
    });

    this.server.on("close", (code) => {
      console.log(`Server exited with code ${code}`);
    });

    this.server.stdout?.on("data", (data: Buffer) => {
      this.handleResponse(data.toString());
    });

    this.server.on("exit", () => {
      for (const [id, { reject }] of this.pendingResponses) {
        reject(new Error(`Server closed before response for request ${id}`));
      }
      this.pendingResponses.clear();
    });
  }

  private handleResponse(data: string): void {
    for (const line of data.split("\n").filter(Boolean)) {
      try {
        const response: JsonRpcResponse = JSON.parse(line);
        const pending = this.pendingResponses.get(response.id);
        if (pending) {
          pending.resolve(response);
          this.pendingResponses.delete(response.id);
        }
      } catch (error) {
        console.error("Failed to parse response:", line, error);
      }
    }
  }

  private sendRequest(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    };

    return new Promise((resolve, reject) => {
      this.pendingResponses.set(id, {
        resolve: (res) => {
          if (res.error) {
            reject(
              new Error(`RPC Error ${res.error.code}: ${res.error.message}`)
            );
          } else {
            resolve(res.result);
          }
        },
        reject,
      });

      this.server.stdin?.write(`${JSON.stringify(request)}\n`);
    });
  }

  async initialize(): Promise<void> {
    await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0",
      },
    });
  }

  async listTools(): Promise<ToolDefinition[]> {
    const result = (await this.sendRequest("tools/list")) as {
      tools: ToolDefinition[];
    };
    return result.tools;
  }

  async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<unknown> {
    const result = (await this.sendRequest("tools/call", {
      name,
      arguments: args,
    })) as {
      content: Array<{ type: string; text: string }>;
    };
    if (result.content?.[0]?.type === "text") {
      return JSON.parse(result.content[0].text);
    }
    return result;
  }

  close(): void {
    this.server.kill();
  }
}

async function testZaiUsageTools(client: MCPTestClient): Promise<void> {
  console.log("\n=== Testing Z.AI Usage Tools ===\n");

  console.log("1. get_quota (no parameters)");
  try {
    const result = await client.callTool("get_quota");
    console.log("✓ Success:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(
      `✗ Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  console.log("\n2. get_model_usage (default: 24 hours)");
  try {
    const result = await client.callTool("get_model_usage");
    console.log("✓ Success:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(
      `✗ Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  console.log("\n3. get_model_usage (custom: 48 hours)");
  try {
    const result = await client.callTool("get_model_usage", { hours: 48 });
    console.log("✓ Success:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(
      `✗ Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  console.log("\n4. get_tool_usage (default: 24 hours)");
  try {
    const result = await client.callTool("get_tool_usage");
    console.log("✓ Success:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(
      `✗ Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  console.log("\n5. get_tool_usage (custom: 72 hours)");
  try {
    const result = await client.callTool("get_tool_usage", { hours: 72 });
    console.log("✓ Success:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(
      `✗ Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  console.log("\n6. get_usage (default: 24 hours) - aggregated view");
  try {
    const result = await client.callTool("get_usage");
    console.log("✓ Success:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(
      `✗ Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  console.log("\n7. get_usage (custom: 12 hours)");
  try {
    const result = await client.callTool("get_usage", { hours: 12 });
    console.log("✓ Success:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(
      `✗ Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function testAntigravityTools(client: MCPTestClient): Promise<void> {
  console.log("\n=== Testing Antigravity Quota Tools ===\n");

  console.log("8. get_antigravity_quota (all accounts)");
  try {
    const result = await client.callTool("get_antigravity_quota");
    console.log("✓ Success:");
    const summary = result as {
      total_accounts: number;
      enabled_accounts: number;
      accounts: unknown[];
      summary: Record<
        string,
        { best_remaining_pct: number; accounts_available: number }
      >;
    };
    console.log(`  Total accounts: ${summary.total_accounts}`);
    console.log(`  Enabled accounts: ${summary.enabled_accounts}`);
    console.log(`  Summary: ${JSON.stringify(summary.summary, null, 2)}`);
    if (summary.accounts.length > 0) {
      console.log("\n  First account details:");
      console.log(
        `    ${JSON.stringify(summary.accounts[0], null, 4).split("\n").join("\n    ")}`
      );
    }
  } catch (error) {
    console.log(
      `✗ Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  console.log("\n9. get_antigravity_account_quota (by index: 0)");
  try {
    const result = await client.callTool("get_antigravity_account_quota", {
      account: 0,
    });
    console.log("✓ Success:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(
      `✗ Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  console.log("\n10. get_antigravity_account_quota (by string index: '0')");
  try {
    const result = await client.callTool("get_antigravity_account_quota", {
      account: "0",
    });
    console.log("✓ Success:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(
      `✗ Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function testEdgeCases(client: MCPTestClient): Promise<void> {
  console.log("\n=== Testing Edge Cases ===\n");

  console.log("11. get_model_usage with invalid hours (negative)");
  try {
    const result = await client.callTool("get_model_usage", { hours: -1 });
    console.log("✗ Should have failed but got:", JSON.stringify(result));
  } catch (error) {
    console.log(
      `✓ Correctly rejected: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  console.log("\n12. get_antigravity_account_quota with invalid account index");
  try {
    const result = await client.callTool("get_antigravity_account_quota", {
      account: 999,
    });
    console.log("✗ Should have failed but got:", JSON.stringify(result));
  } catch (error) {
    console.log(
      `✓ Correctly rejected: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  console.log("\n13. Unknown tool call");
  try {
    const result = await client.callTool("unknown_tool");
    console.log("✗ Should have failed but got:", JSON.stringify(result));
  } catch (error) {
    console.log(
      `✓ Correctly rejected: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function main(): Promise<void> {
  console.log("=== MCP Z.AI Usage Tools Test Client ===\n");
  console.log("Starting MCP server...");

  const client = new MCPTestClient("bun", ["src/index.ts"]);

  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("Initializing connection...");
    await client.initialize();
    const tools = await client.listTools();
    console.log(`✓ Connected. Server exposes ${tools.length} tools:`);
    for (const tool of tools) {
      console.log(`  - ${tool.name}: ${tool.description}`);
    }

    await testZaiUsageTools(client);
    await testAntigravityTools(client);
    await testEdgeCases(client);

    console.log("\n=== All Tests Complete ===");
  } catch (error) {
    console.error(
      "\n❌ Fatal error:",
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error("Uncaught error:", error);
  process.exit(1);
});

#!/usr/bin/env bun
import readline from "node:readline";
import { handleMessage } from "./server.js";
import type { JsonRpcRequest } from "./types/index.js";

let pendingRequests = 0;
let stdinClosed = false;

function sendMessage(data: string): void {
  process.stdout.write(`${data}\n`);
}

function checkExit(): void {
  if (stdinClosed && pendingRequests === 0) {
    process.exit(0);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  let msg: unknown;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    sendMessage(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32_700, message: "Parse error" },
      })
    );
    return;
  }

  pendingRequests++;
  try {
    const response = await handleMessage(msg as JsonRpcRequest);
    if (response) {
      sendMessage(response);
    }
  } finally {
    pendingRequests--;
    checkExit();
  }
});

rl.on("close", () => {
  stdinClosed = true;
  checkExit();
});

process.on("unhandledRejection", (err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Unhandled rejection: ${message}\n`);
});

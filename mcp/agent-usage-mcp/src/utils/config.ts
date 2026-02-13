import os from "node:os";
import path from "node:path";

export const config = {
  // Z.AI
  zaiApiKey: process.env.OC_ZAI_API_KEY,
  zaiApiHost: "api.z.ai",

  // Antigravity
  agClientId:
    "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
  agClientSecret: process.env.AG_CLIENT_SECRET,
  agApiHost: "cloudcode-pa.googleapis.com",
  agAccountsFile: path.join(
    os.homedir(),
    ".config",
    "opencode",
    "antigravity-accounts.json"
  ),

  // Server
  serverName: "zai-usage",
  serverVersion: "2.0.0",
  requestTimeout: 15_000, // 15 seconds
} as const;

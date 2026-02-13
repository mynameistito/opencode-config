import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import https from "node:https";
import os from "node:os";
import type {
  AccountQuotaResult,
  AllAccountsQuotaResult,
  AntigravityAccount,
  AntigravityModel,
  GeminiCliBucket,
} from "../types/antigravity.js";
import { config } from "../utils/config.js";
import {
  AntigravityAccountsFileSchema,
  OAuthTokenResponseSchema,
} from "../utils/validation.js";
import { httpPost } from "./http.js";

export function loadAccounts(): AntigravityAccount[] {
  if (!fs.existsSync(config.agAccountsFile)) {
    throw new Error(
      `Antigravity accounts file not found at ${config.agAccountsFile}. Run 'opencode auth login' first.`
    );
  }
  const raw = fs.readFileSync(config.agAccountsFile, "utf8");
  const parsed = AntigravityAccountsFileSchema.parse(JSON.parse(raw));
  if (parsed.accounts.length === 0) {
    throw new Error("No Antigravity accounts configured");
  }
  return parsed.accounts.map((acc) => ({
    email: acc.email,
    refreshToken: acc.refreshToken,
    ...(acc.projectId !== undefined ? { projectId: acc.projectId } : {}),
    ...(acc.enabled !== undefined ? { enabled: acc.enabled } : {}),
  }));
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<string> {
  if (!config.agClientSecret) {
    throw new Error("AG_CLIENT_SECRET environment variable is not set");
  }

  const body = new URLSearchParams({
    client_id: config.agClientId,
    client_secret: config.agClientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }).toString();

  const response = await httpPost(
    "oauth2.googleapis.com",
    "/token",
    { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    OAuthTokenResponseSchema
  );

  return response.access_token;
}

async function fetchAntigravityModels(
  accessToken: string,
  projectId?: string
): Promise<unknown> {
  const body = projectId ? JSON.stringify({ project: projectId }) : "{}";

  const response = await new Promise<{
    status: number;
    data: unknown;
  }>((resolve, reject) => {
    const req = https.request(
      {
        hostname: config.agApiHost,
        port: 443,
        path: "/v1internal:fetchAvailableModels",
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent":
            "Mozilla/5.0 Antigravity/1.15.8 Chrome/138.0.7204.235 Electron/37.3.1",
          "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
          "Client-Metadata":
            '{"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}',
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res: IncomingMessage) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 500, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 500, data });
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(config.requestTimeout, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.end(body);
  });

  if (response.status !== 200) {
    throw new Error(
      `fetchAvailableModels HTTP ${response.status}: ${JSON.stringify(response.data).substring(0, 300)}`
    );
  }
  return response.data;
}

async function fetchGeminiCliQuota(
  accessToken: string,
  projectId?: string
): Promise<unknown> {
  const platform = os.platform();
  const arch = os.arch();
  const body = projectId ? JSON.stringify({ project: projectId }) : "{}";

  const response = await new Promise<{
    status: number;
    data: unknown;
  }>((resolve, reject) => {
    const req = https.request(
      {
        hostname: config.agApiHost,
        port: 443,
        path: "/v1internal:retrieveUserQuota",
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": `GeminiCLI/1.0.0/gemini-2.5-pro (${platform}; ${arch})`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res: IncomingMessage) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 500, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 500, data });
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(config.requestTimeout, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.end(body);
  });

  if (response.status !== 200) {
    throw new Error(
      `retrieveUserQuota HTTP ${response.status}: ${JSON.stringify(response.data).substring(0, 300)}`
    );
  }
  return response.data;
}

function parseAntigravityModels(data: unknown): AntigravityModel[] {
  if (typeof data !== "object" || data === null || !("models" in data)) {
    return [];
  }

  const dataObj = data as Record<string, unknown>;
  if (typeof dataObj.models !== "object" || dataObj.models === null) {
    return [];
  }

  const models: AntigravityModel[] = [];
  for (const [name, info] of Object.entries(dataObj.models)) {
    const infoObj = info as Record<string, unknown>;
    const entry: AntigravityModel = createAntigravityModelEntry(name, infoObj);
    models.push(entry);
  }
  return models;
}

function createAntigravityModelEntry(
  name: string,
  infoObj: Record<string, unknown>
): AntigravityModel {
  const entry: AntigravityModel = {
    model: name,
    remaining_fraction: null,
    remaining_pct: null,
    reset_time: null,
  };

  const quotaInfo = infoObj.quotaInfo as Record<string, unknown> | undefined;
  if (quotaInfo === undefined || typeof quotaInfo !== "object") {
    return entry;
  }

  if (typeof quotaInfo.remainingFraction === "number") {
    entry.remaining_fraction = quotaInfo.remainingFraction;
    entry.remaining_pct = Math.round(quotaInfo.remainingFraction * 100);
  }
  if (typeof quotaInfo.resetTime === "string") {
    entry.reset_time = quotaInfo.resetTime;
  }
  return entry;
}

function parseGeminiCliQuota(data: unknown): GeminiCliBucket[] {
  const buckets: GeminiCliBucket[] = [];
  if (typeof data === "object" && data !== null && "buckets" in data) {
    const dataObj = data as Record<string, unknown>;
    if (Array.isArray(dataObj.buckets)) {
      for (const b of dataObj.buckets) {
        if (typeof b === "object" && b !== null) {
          const bucket = b as Record<string, unknown>;
          const entry: GeminiCliBucket = {
            model:
              typeof bucket.modelId === "string" ? bucket.modelId : "unknown",
            token_type:
              typeof bucket.tokenType === "string" ? bucket.tokenType : null,
            remaining_fraction:
              typeof bucket.remainingFraction === "number"
                ? bucket.remainingFraction
                : null,
            remaining_pct:
              typeof bucket.remainingFraction === "number"
                ? Math.round(bucket.remainingFraction * 100)
                : null,
            remaining_amount:
              typeof bucket.remainingAmount === "string"
                ? bucket.remainingAmount
                : null,
            reset_time:
              typeof bucket.resetTime === "string" ? bucket.resetTime : null,
          };
          buckets.push(entry);
        }
      }
    }
  }
  return buckets;
}

export async function getAntigravityAccountQuota(
  account: AntigravityAccount,
  index: number
): Promise<AccountQuotaResult> {
  const result: AccountQuotaResult = {
    account_index: index,
    email: account.email || `account_${index}`,
    enabled: account.enabled !== false,
    projectId: account.projectId || null,
    antigravity_models: [],
    gemini_cli_quota: [],
    errors: [],
  };

  if (!result.enabled) {
    result.errors.push("Account is disabled");
    return result;
  }

  if (!account.refreshToken) {
    result.errors.push("No refresh token stored for this account");
    return result;
  }

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(account.refreshToken);
  } catch (err) {
    result.errors.push(
      `Token refresh failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return result;
  }

  const [agResult, gcResult] = await Promise.allSettled([
    fetchAntigravityModels(accessToken, account.projectId),
    fetchGeminiCliQuota(accessToken, account.projectId),
  ]);

  if (agResult.status === "fulfilled") {
    result.antigravity_models = parseAntigravityModels(agResult.value);
  } else {
    result.errors.push(
      `Antigravity models: ${agResult.reason instanceof Error ? agResult.reason.message : String(agResult.reason)}`
    );
  }

  if (gcResult.status === "fulfilled") {
    result.gemini_cli_quota = parseGeminiCliQuota(gcResult.value);
  } else {
    result.errors.push(
      `Gemini CLI quota: ${gcResult.reason instanceof Error ? gcResult.reason.message : String(gcResult.reason)}`
    );
  }

  return result;
}

export async function getAntigravityQuotaAll(): Promise<AllAccountsQuotaResult> {
  const accounts = loadAccounts();
  const results = await Promise.all(
    accounts.map((acc, i) => getAntigravityAccountQuota(acc, i))
  );

  // Build summary across all accounts
  const modelSummary: Record<
    string,
    {
      best_remaining_pct: number;
      accounts_available: number;
    }
  > = {};

  for (const acct of results) {
    if (!acct.enabled) {
      continue;
    }
    for (const m of acct.antigravity_models) {
      if (!(m.model in modelSummary)) {
        modelSummary[m.model] = {
          best_remaining_pct: -1,
          accounts_available: 0,
        };
      }
      const entry = modelSummary[m.model];
      if (
        entry !== undefined &&
        m.remaining_pct !== null &&
        m.remaining_pct > 0
      ) {
        entry.accounts_available++;
        entry.best_remaining_pct = Math.max(
          entry.best_remaining_pct,
          m.remaining_pct
        );
      }
    }
    for (const b of acct.gemini_cli_quota) {
      const key = `gemini-cli:${b.model}`;
      if (!(key in modelSummary)) {
        modelSummary[key] = { best_remaining_pct: -1, accounts_available: 0 };
      }
      const entry = modelSummary[key];
      if (
        entry !== undefined &&
        b.remaining_pct !== null &&
        b.remaining_pct > 0
      ) {
        entry.accounts_available++;
        entry.best_remaining_pct = Math.max(
          entry.best_remaining_pct,
          b.remaining_pct
        );
      }
    }
  }

  return {
    total_accounts: accounts.length,
    enabled_accounts: accounts.filter((a) => a.enabled !== false).length,
    accounts: results,
    summary: modelSummary,
  };
}

const NUMERIC_STRING_REGEX = /^\d+$/;

export function getAntigravityQuotaSingle(
  identifier: string | number
): Promise<AccountQuotaResult> {
  const accounts = loadAccounts();
  let index: number;

  if (typeof identifier === "number") {
    index = identifier;
  } else if (
    typeof identifier === "string" &&
    NUMERIC_STRING_REGEX.test(identifier)
  ) {
    index = Number(identifier);
  } else {
    index = accounts.findIndex(
      (a) =>
        a.email && a.email.toLowerCase() === String(identifier).toLowerCase()
    );
    if (index === -1) {
      throw new Error(`Account not found: ${identifier}`);
    }
  }

  if (index < 0 || index >= accounts.length) {
    throw new Error(
      `Account index ${index} out of range (0-${accounts.length - 1})`
    );
  }

  const account = accounts[index];
  if (account === undefined) {
    throw new Error(`Account at index ${index} not found`);
  }

  return getAntigravityAccountQuota(account, index);
}

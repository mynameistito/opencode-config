#!/usr/bin/env node

/**
 * Z.AI Usage MCP Server
 * A Model Context Protocol server that exposes Z.AI usage statistics as tools.
 * Implements JSON-RPC 2.0 over stdio transport.
 */

const https = require("node:https");
const readline = require("node:readline");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SERVER_INFO = {
	name: "zai-usage",
	version: "2.0.0",
};

const API_KEY = process.env.OC_ZAI_API_KEY;

// --- Antigravity constants ---

const AG_CLIENT_ID =
	"1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const AG_CLIENT_SECRET = process.env.AG_CLIENT_SECRET;
const AG_API_HOST = "cloudcode-pa.googleapis.com";
const AG_ACCOUNTS_FILE = path.join(
	os.homedir(),
	".config",
	"opencode",
	"antigravity-accounts.json",
);

// --- HTTPS fetch helper ---

function fetchData(path) {
	if (!API_KEY) {
		return Promise.reject(
			new Error("OC_ZAI_API_KEY environment variable is not set"),
		);
	}
	return new Promise((resolve, reject) => {
		const options = {
			hostname: "api.z.ai",
			port: 443,
			path: path,
			method: "GET",
			headers: {
				Authorization: `Bearer ${API_KEY}`,
				"Accept-Language": "en-US,en",
				"Content-Type": "application/json",
			},
		};

		const req = https.request(options, (res) => {
			let data = "";
			res.on("data", (chunk) => {
				data += chunk;
			});
			res.on("end", () => {
				if (res.statusCode === 200) {
					try {
						resolve(JSON.parse(data));
					} catch {
						reject(
							new Error(`Invalid JSON response: ${data.substring(0, 200)}`),
						);
					}
				} else {
					reject(
						new Error(`HTTP ${res.statusCode}: ${data.substring(0, 500)}`),
					);
				}
			});
		});

		req.on("error", (err) => reject(err));
		req.setTimeout(15000, () => {
			req.destroy();
			reject(new Error("Request timed out after 15s"));
		});
		req.end();
	});
}

// --- Time helpers ---

function formatDate(d) {
	return d.toISOString().replace(/\.\d+Z$/, "");
}

function getTimeWindow(hours) {
	const now = new Date();
	const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
	return {
		startTime: formatDate(start),
		endTime: formatDate(now),
	};
}

// --- Tool implementations ---

async function getQuota() {
	if (!API_KEY) {
		return { error: "OC_ZAI_API_KEY environment variable is not set" };
	}
	const data = await fetchData("/api/monitor/usage/quota/limit");
	const result = { limits: [] };
	if (data.data?.limits) {
		for (const limit of data.data.limits) {
			if (limit.type === "TOKENS_LIMIT") {
				result.limits.push({
					type: "Token Usage (5h window)",
					percentage: limit.percentage || 0,
					used: limit.used,
					total: limit.total,
				});
			} else if (limit.type === "TIME_LIMIT") {
				result.limits.push({
					type: "MCP Usage (Monthly)",
					percentage: limit.percentage || 0,
					used: limit.used,
					total: limit.total,
				});
			} else {
				result.limits.push({
					type: limit.type,
					percentage: limit.percentage || 0,
					used: limit.used,
					total: limit.total,
				});
			}
		}
	}
	return result;
}

async function getModelUsage(hours) {
	if (!API_KEY) {
		return { error: "OC_ZAI_API_KEY environment variable is not set" };
	}
	const { startTime, endTime } = getTimeWindow(hours);
	const data = await fetchData(
		`/api/monitor/usage/model-usage?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`,
	);
	const result = { period_hours: hours, models: [] };
	if (data.data?.totalUsage) {
		result.total_tokens = data.data.totalUsage.totalTokensUsage || 0;
	}
	if (data.data?.modelUsages) {
		for (const model of data.data.modelUsages) {
			result.models.push({
				model: model.modelName || model.model,
				tokens: model.totalTokensUsage || model.tokensUsage || 0,
				input_tokens: model.inputTokensUsage || 0,
				output_tokens: model.outputTokensUsage || 0,
			});
		}
	}
	return result;
}

async function getToolUsage(hours) {
	if (!API_KEY) {
		return { error: "OC_ZAI_API_KEY environment variable is not set" };
	}
	const { startTime, endTime } = getTimeWindow(hours);
	const data = await fetchData(
		`/api/monitor/usage/tool-usage?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`,
	);
	const result = { period_hours: hours };
	if (data.data?.totalUsage) {
		result.web_search_count = data.data.totalUsage.totalNetworkSearchCount || 0;
		result.web_reader_count = data.data.totalUsage.totalWebReadMcpCount || 0;
	} else {
		result.web_search_count = 0;
		result.web_reader_count = 0;
	}
	return result;
}

async function getFullUsage(hours) {
	if (!API_KEY) {
		return { error: "OC_ZAI_API_KEY environment variable is not set" };
	}
	const [quota, modelUsage, toolUsage] = await Promise.all([
		getQuota(),
		getModelUsage(hours),
		getToolUsage(hours),
	]);
	return { quota, model_usage: modelUsage, tool_usage: toolUsage };
}

// --- Antigravity helpers ---

function httpsPost(hostname, urlPath, headers, body) {
	return new Promise((resolve, reject) => {
		const payload = typeof body === "string" ? body : JSON.stringify(body);
		const options = {
			hostname,
			port: 443,
			path: urlPath,
			method: "POST",
			headers: {
				"Content-Type": headers["Content-Type"] || "application/json",
				"Content-Length": Buffer.byteLength(payload),
				...headers,
			},
		};

		const req = https.request(options, (res) => {
			let data = "";
			res.on("data", (chunk) => {
				data += chunk;
			});
			res.on("end", () => {
				try {
					resolve({ status: res.statusCode, data: JSON.parse(data) });
				} catch {
					resolve({ status: res.statusCode, data, raw: true });
				}
			});
		});

		req.on("error", (err) => reject(err));
		req.setTimeout(15000, () => {
			req.destroy();
			reject(new Error("Request timed out after 15s"));
		});
		req.end(payload);
	});
}

function loadAntigravityAccounts() {
	if (!fs.existsSync(AG_ACCOUNTS_FILE)) {
		throw new Error(
			`Antigravity accounts file not found at ${AG_ACCOUNTS_FILE}. Run 'opencode auth login' first.`,
		);
	}
	const raw = fs.readFileSync(AG_ACCOUNTS_FILE, "utf8");
	const accounts = JSON.parse(raw);
	if (!Array.isArray(accounts) || accounts.length === 0) {
		throw new Error("No Antigravity accounts configured");
	}
	return accounts;
}

async function refreshAccessToken(refreshToken) {
	if (!AG_CLIENT_SECRET) {
		throw new Error("AG_CLIENT_SECRET environment variable is not set");
	}
	const body = new URLSearchParams({
		client_id: AG_CLIENT_ID,
		client_secret: AG_CLIENT_SECRET,
		refresh_token: refreshToken,
		grant_type: "refresh_token",
	}).toString();

	const res = await httpsPost(
		"oauth2.googleapis.com",
		"/token",
		{ "Content-Type": "application/x-www-form-urlencoded" },
		body,
	);

	if (res.status !== 200) {
		const msg =
			res.data?.error_description || res.data?.error || "Unknown error";
		throw new Error(`Token refresh failed: ${msg}`);
	}
	return res.data.access_token;
}

async function fetchAntigravityModels(accessToken, projectId) {
	const res = await httpsPost(
		AG_API_HOST,
		"/v1internal:fetchAvailableModels",
		{
			Authorization: `Bearer ${accessToken}`,
			"User-Agent":
				"Mozilla/5.0 Antigravity/1.15.8 Chrome/138.0.7204.235 Electron/37.3.1",
			"X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
			"Client-Metadata":
				'{"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}',
		},
		projectId ? { project: projectId } : {},
	);

	if (res.status !== 200) {
		throw new Error(
			`fetchAvailableModels HTTP ${res.status}: ${JSON.stringify(res.data).substring(0, 300)}`,
		);
	}
	return res.data;
}

async function fetchGeminiCliQuota(accessToken, projectId) {
	const platform = os.platform();
	const arch = os.arch();
	const res = await httpsPost(
		AG_API_HOST,
		"/v1internal:retrieveUserQuota",
		{
			Authorization: `Bearer ${accessToken}`,
			"User-Agent": `GeminiCLI/1.0.0/gemini-2.5-pro (${platform}; ${arch})`,
		},
		projectId ? { project: projectId } : {},
	);

	if (res.status !== 200) {
		throw new Error(
			`retrieveUserQuota HTTP ${res.status}: ${JSON.stringify(res.data).substring(0, 300)}`,
		);
	}
	return res.data;
}

function parseAntigravityModels(data) {
	const models = [];
	if (data.models) {
		for (const [name, info] of Object.entries(data.models)) {
			const entry = { model: name };
			if (info.quotaInfo) {
				entry.remaining_fraction = info.quotaInfo.remainingFraction ?? null;
				entry.remaining_pct =
					info.quotaInfo.remainingFraction != null
						? Math.round(info.quotaInfo.remainingFraction * 100)
						: null;
				entry.reset_time = info.quotaInfo.resetTime || null;
			}
			models.push(entry);
		}
	}
	return models;
}

function parseGeminiCliQuota(data) {
	const buckets = [];
	if (data.buckets) {
		for (const b of data.buckets) {
			buckets.push({
				model: b.modelId || "unknown",
				token_type: b.tokenType || null,
				remaining_fraction: b.remainingFraction ?? null,
				remaining_pct:
					b.remainingFraction != null
						? Math.round(b.remainingFraction * 100)
						: null,
				remaining_amount: b.remainingAmount || null,
				reset_time: b.resetTime || null,
			});
		}
	}
	return buckets;
}

async function getAntigravityAccountQuota(account, index) {
	const result = {
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

	let accessToken;
	try {
		accessToken = await refreshAccessToken(account.refreshToken);
	} catch (err) {
		result.errors.push(`Token refresh failed: ${err.message}`);
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
			`Antigravity models: ${agResult.reason?.message ?? String(agResult.reason)}`,
		);
	}

	if (gcResult.status === "fulfilled") {
		result.gemini_cli_quota = parseGeminiCliQuota(gcResult.value);
	} else {
		result.errors.push(
			`Gemini CLI quota: ${gcResult.reason?.message ?? String(gcResult.reason)}`,
		);
	}

	return result;
}

async function getAntigravityQuotaAll() {
	const accounts = loadAntigravityAccounts();
	const results = await Promise.all(
		accounts.map((acc, i) => getAntigravityAccountQuota(acc, i)),
	);

	// Build summary across all accounts
	const modelSummary = {};
	for (const acct of results) {
		if (!acct.enabled) continue;
		for (const m of acct.antigravity_models) {
			if (!modelSummary[m.model]) {
				modelSummary[m.model] = {
					best_remaining_pct: -1,
					accounts_available: 0,
				};
			}
			if (m.remaining_pct != null && m.remaining_pct > 0) {
				modelSummary[m.model].accounts_available++;
				modelSummary[m.model].best_remaining_pct = Math.max(
					modelSummary[m.model].best_remaining_pct,
					m.remaining_pct,
				);
			}
		}
		for (const b of acct.gemini_cli_quota) {
			const key = `gemini-cli:${b.model}`;
			if (!modelSummary[key]) {
				modelSummary[key] = { best_remaining_pct: -1, accounts_available: 0 };
			}
			if (b.remaining_pct != null && b.remaining_pct > 0) {
				modelSummary[key].accounts_available++;
				modelSummary[key].best_remaining_pct = Math.max(
					modelSummary[key].best_remaining_pct,
					b.remaining_pct,
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

async function getAntigravityQuotaSingle(identifier) {
	const accounts = loadAntigravityAccounts();
	let index;

	if (typeof identifier === "number") {
		index = identifier;
	} else if (typeof identifier === "string" && /^\d+$/.test(identifier)) {
		index = Number(identifier);
	} else {
		index = accounts.findIndex(
			(a) =>
				a.email && a.email.toLowerCase() === String(identifier).toLowerCase(),
		);
		if (index === -1) {
			throw new Error(`Account not found: ${identifier}`);
		}
	}

	if (index < 0 || index >= accounts.length) {
		throw new Error(
			`Account index ${index} out of range (0-${accounts.length - 1})`,
		);
	}

	return getAntigravityAccountQuota(accounts[index], index);
}

function validateHours(hours) {
	const parsed = Number(hours);
	if (typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0) {
		return parsed;
	}
	return 24;
}

// --- Tool definitions ---

const TOOLS = [
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
			"Get current Z.AI account quota limits including token usage percentage (5-hour window) and MCP usage percentage (monthly).",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "get_model_usage",
		description:
			"Get Z.AI model token usage breakdown by model for a specified time period.",
		inputSchema: {
			type: "object",
			properties: {
				hours: {
					type: "number",
					description: "Number of hours to look back (default: 24)",
					default: 24,
				},
			},
		},
	},
	{
		name: "get_tool_usage",
		description:
			"Get Z.AI tool usage counts (web search and web reader) for a specified time period.",
		inputSchema: {
			type: "object",
			properties: {
				hours: {
					type: "number",
					description: "Number of hours to look back (default: 24)",
					default: 24,
				},
			},
		},
	},
	{
		name: "get_antigravity_quota",
		description:
			"Get Antigravity (Google Cloud Code) quota for ALL configured accounts. Shows remaining quota per model (Claude, Gemini) for each Google account, plus Gemini CLI quota. Also provides a summary showing which models have quota available across accounts.",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "get_antigravity_account_quota",
		description:
			"Get Antigravity quota for a SPECIFIC account by email address or account index (0-based). Shows Antigravity model quota and Gemini CLI quota for that single account.",
		inputSchema: {
			type: "object",
			properties: {
				account: {
					oneOf: [
						{ type: "string", description: "Account email address" },
						{ type: "number", description: "Account index (0-based)" },
					],
					description:
						"The account to check - either an email address or a 0-based index number",
				},
			},
			required: ["account"],
		},
	},
];

// --- JSON-RPC / MCP protocol handler ---

function makeResponse(id, result) {
	return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function makeError(id, code, message) {
	return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

function makeParseError() {
	return JSON.stringify({
		jsonrpc: "2.0",
		id: null,
		error: { code: -32700, message: "Parse error" },
	});
}

async function handleMessage(msg) {
	// Notifications (no id) don't need responses
	if (msg.id === undefined) {
		return null;
	}

	switch (msg.method) {
		case "initialize":
			return makeResponse(msg.id, {
				protocolVersion: "2024-11-05",
				capabilities: {
					tools: {},
				},
				serverInfo: SERVER_INFO,
			});

		case "ping":
			return makeResponse(msg.id, {});

		case "tools/list":
			return makeResponse(msg.id, { tools: TOOLS });

		case "tools/call": {
			const toolName = msg.params?.name;
			const args = msg.params?.arguments ?? {};
			try {
				let result;
				switch (toolName) {
					case "get_usage":
						result = await getFullUsage(validateHours(args.hours));
						break;
					case "get_quota":
						result = await getQuota();
						break;
					case "get_model_usage":
						result = await getModelUsage(validateHours(args.hours));
						break;
					case "get_tool_usage":
						result = await getToolUsage(validateHours(args.hours));
						break;
					case "get_antigravity_quota":
						result = await getAntigravityQuotaAll();
						break;
					case "get_antigravity_account_quota":
						result = await getAntigravityQuotaSingle(args.account);
						break;
					default:
						return makeError(msg.id, -32601, `Unknown tool: ${toolName}`);
				}
				return makeResponse(msg.id, {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				});
			} catch (err) {
				return makeError(msg.id, -32000, err?.message ?? String(err));
			}
		}

		default:
			return makeError(msg.id, -32601, `Method not found: ${msg.method}`);
	}
}

// --- stdio transport ---

let pendingRequests = 0;
let stdinClosed = false;

function sendMessage(data) {
	process.stdout.write(`${data}\n`);
}

function checkExit() {
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
	if (!trimmed) return;

	let msg;
	try {
		msg = JSON.parse(trimmed);
	} catch {
		sendMessage(makeParseError());
		return;
	}

	pendingRequests++;
	try {
		const response = await handleMessage(msg);
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

// Prevent unhandled rejections from crashing the server
process.on("unhandledRejection", (err) => {
	process.stderr.write(`Unhandled rejection: ${err?.message ?? String(err)}\n`);
});

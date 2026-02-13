import https from "node:https";
import type { z } from "zod";
import { config } from "../utils/config.js";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function httpGet<T>(
  hostname: string,
  path: string,
  headers: Record<string, string>,
  schema: z.ZodType<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        port: 443,
        path,
        method: "GET",
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              const validated = schema.parse(json);
              resolve(validated);
            } catch (err) {
              reject(new Error(`Invalid response: ${err}`));
            }
          } else {
            reject(
              new HttpError(
                res.statusCode ?? 500,
                `HTTP ${res.statusCode}: ${data.substring(0, 500)}`
              )
            );
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(config.requestTimeout, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.end();
  });
}

export function httpPost<T>(
  hostname: string,
  path: string,
  headers: Record<string, string>,
  body: string,
  schema: z.ZodType<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        port: 443,
        path,
        method: "POST",
        headers: {
          "Content-Length": Buffer.byteLength(body),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              const validated = schema.parse(json);
              resolve(validated);
            } catch (err) {
              reject(new Error(`Invalid response: ${err}`));
            }
          } else {
            reject(
              new HttpError(
                res.statusCode ?? 500,
                `HTTP ${res.statusCode}: ${data.substring(0, 500)}`
              )
            );
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
}

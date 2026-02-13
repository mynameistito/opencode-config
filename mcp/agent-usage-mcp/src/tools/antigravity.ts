import {
  getAntigravityQuotaAll,
  getAntigravityQuotaSingle,
} from "../api/antigravity.js";
import type {
  AccountQuotaResult,
  AllAccountsQuotaResult,
} from "../types/antigravity.js";

export function getAntigravityAccountQuota(
  account: unknown
): Promise<AccountQuotaResult> {
  return getAntigravityQuotaSingle(account as string | number);
}

export function getAntigravityQuota(): Promise<AllAccountsQuotaResult> {
  return getAntigravityQuotaAll();
}

export interface AntigravityAccount {
  email: string;
  refreshToken: string;
  projectId?: string;
  enabled?: boolean;
}

export interface AntigravityModel {
  model: string;
  remaining_fraction: number | null;
  remaining_pct: number | null;
  reset_time: string | null;
}

export interface GeminiCliBucket {
  model: string;
  token_type: string | null;
  remaining_fraction: number | null;
  remaining_pct: number | null;
  remaining_amount: string | null;
  reset_time: string | null;
}

export interface AccountQuotaResult {
  account_index: number;
  email: string;
  enabled: boolean;
  projectId: string | null;
  antigravity_models: AntigravityModel[];
  gemini_cli_quota: GeminiCliBucket[];
  errors: string[];
}

export interface AllAccountsQuotaResult {
  total_accounts: number;
  enabled_accounts: number;
  accounts: AccountQuotaResult[];
  summary: Record<
    string,
    {
      best_remaining_pct: number;
      accounts_available: number;
    }
  >;
}

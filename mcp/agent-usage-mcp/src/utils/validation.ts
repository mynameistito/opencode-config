import { z } from "zod";

// Z.AI API response schemas
export const QuotaResponseSchema = z.object({
  data: z
    .object({
      limits: z.array(
        z.object({
          type: z.string(),
          percentage: z.number().optional(),
          used: z.number().optional(),
          total: z.number().optional(),
        })
      ),
    })
    .optional(),
});

export const ModelUsageResponseSchema = z.object({
  data: z
    .object({
      totalUsage: z
        .object({
          totalTokensUsage: z.number().optional(),
        })
        .optional(),
      modelUsages: z
        .array(
          z.object({
            modelName: z.string().optional(),
            model: z.string().optional(),
            totalTokensUsage: z.number().optional(),
            tokensUsage: z.number().optional(),
            inputTokensUsage: z.number().optional(),
            outputTokensUsage: z.number().optional(),
          })
        )
        .optional(),
    })
    .optional(),
});

export const ToolUsageResponseSchema = z.object({
  data: z
    .object({
      totalUsage: z
        .object({
          totalNetworkSearchCount: z.number().optional(),
          totalWebReadMcpCount: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

// Antigravity response schemas
export const OAuthTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
  token_type: z.string().optional(),
});

export const AntigravityAccountsFileSchema = z.object({
  version: z.number(),
  accounts: z.array(
    z.object({
      email: z.string(),
      refreshToken: z.string(),
      projectId: z.string().optional(),
      enabled: z.boolean().optional(),
    })
  ),
  activeIndex: z.number().optional(),
  activeIndexByFamily: z.record(z.string(), z.number()).optional(),
});

export const AntigravityAccountsSchema = z.array(
  z.object({
    email: z.string(),
    refreshToken: z.string(),
    projectId: z.string().optional(),
    enabled: z.boolean().optional(),
  })
);

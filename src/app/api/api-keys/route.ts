import { NextRequest } from "next/server";
import { ApiKeyManager } from "@/modules/api-keys";
import { withApiMiddleware, rateLimits, ApiUtils } from "@/modules/api";
import { z } from "zod";

// Schema for creating API keys
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
});

// GET /api/api-keys - List user's API keys
export const GET = withApiMiddleware(
  {
    auth: true,
    rateLimit: rateLimits.default,
  },
  async (request: NextRequest, { userId }) => {
    try {
      const apiKeys = await ApiKeyManager.listApiKeys(userId!);

      return ApiUtils.createResponse({
        success: true,
        data: apiKeys,
        message: `Found ${apiKeys.length} API keys`,
      });
    } catch (error) {
      console.error("Failed to list API keys:", error);
      return ApiUtils.createErrorResponse("Failed to list API keys", 500);
    }
  },
);

// POST /api/api-keys - Create new API key
export const POST = withApiMiddleware(
  {
    auth: true,
    rateLimit: rateLimits.auth,
    validation: createApiKeySchema,
  },
  async (request: NextRequest, { userId, data }) => {
    try {
      const { name } = data!;

      const result = await ApiKeyManager.createApiKey({
        name,
        userId: userId!,
      });

      return ApiUtils.createResponse({
        success: true,
        data: {
          apiKey: result.apiKey, // Only returned once
          keyData: result.keyData,
        },
        message: "API key created successfully",
      });
    } catch (error) {
      console.error("Failed to create API key:", error);
      return ApiUtils.createErrorResponse("Failed to create API key", 500);
    }
  },
);

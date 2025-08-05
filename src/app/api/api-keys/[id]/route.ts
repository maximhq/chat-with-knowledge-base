import { NextRequest } from "next/server";
import { ApiKeyManager } from "@/modules/api-keys";
import { withApiMiddleware, ApiUtils } from "@/modules/api";

// DELETE /api/api-keys/[id] - Revoke/delete an API key
export const DELETE = withApiMiddleware(
  {
    auth: true,
  },
  async (request: NextRequest, { userId }) => {
    try {
      const url = new URL(request.url);
      const keyId = url.pathname.split("/").pop();

      if (!keyId) {
        return ApiUtils.createErrorResponse("API key ID is required", 400);
      }

      const success = await ApiKeyManager.revokeApiKey(keyId, userId!);

      if (!success) {
        return ApiUtils.createErrorResponse(
          "API key not found or not owned by user",
          404,
        );
      }

      return ApiUtils.createResponse({
        success: true,
        data: null,
        message: "API key revoked successfully",
      });
    } catch (error) {
      console.error("Failed to revoke API key:", error);
      return ApiUtils.createErrorResponse("Failed to revoke API key", 500);
    }
  },
);

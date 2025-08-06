// API routes for external link management
import { NextRequest } from "next/server";
import { ExternalLinkStorage } from "@/modules/storage";
import { withApiMiddleware, ApiUtils } from "@/modules/api";

// DELETE /api/links/:id - Delete external link
export const DELETE = withApiMiddleware(
  { auth: true },
  async (request: NextRequest) => {
    const url = new URL(request.url);
    const id = url.pathname.split("/").pop();
    if (!id) {
      return ApiUtils.createErrorResponse("Link ID is required", 400);
    }
    try {
      const link = await ExternalLinkStorage.delete(id);
      return ApiUtils.createResponse({
        success: true,
        data: link,
        message: "Link deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting link:", error);
      return ApiUtils.createErrorResponse("Failed to delete link", 500);
    }
  }
);

// API routes for external link management
import { NextRequest } from "next/server";
import { ExternalLinkStorage } from "@/modules/storage";
import { withApiMiddleware, schemas, ApiUtils } from "@/modules/api";

// GET /api/links - Get all links for authenticated user
export const GET = withApiMiddleware(
  { auth: true },
  async (request: NextRequest, { userId }) => {
    try {
      const links = await ExternalLinkStorage.findByUserId(userId!);
      return ApiUtils.createResponse({
        success: true,
        data: links,
        message: `Found ${links.length} links`,
      });
    } catch (error) {
      console.error("Error fetching links:", error);
      return ApiUtils.createErrorResponse("Failed to fetch links", 500);
    }
  }
);

// POST /api/links - Add new external link
export const POST = withApiMiddleware(
  {
    auth: true,
    validation: schemas.createLink,
  },
  async (request: NextRequest, { userId, data }) => {
    try {
      const link = await ExternalLinkStorage.create({
        url: data!.url,
        title: data!.title || null,
        content: null,
        userId: userId!,
      });

      return ApiUtils.createResponse(
        {
          success: true,
          data: link,
          message: "Link added successfully",
        },
        201
      );
    } catch (error) {
      console.error("Error creating link:", error);
      return ApiUtils.createErrorResponse("Failed to add link", 500);
    }
  }
);

// DELETE /api/links/:id - Delete external link
export const DELETE = withApiMiddleware(
  { auth: true },
  async (request: NextRequest) => {
    const id = request.nextUrl.searchParams.get("id");
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

// API routes for thread messages
import { NextRequest } from "next/server";
import { MessageManager } from "@/modules/messages";
import { withApiMiddleware, ApiUtils } from "@/modules/api";

// GET /api/threads/[id]/messages - Get messages for a thread
export const GET = withApiMiddleware(
  { auth: true },
  async (request: NextRequest, { userId }) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const threadId = pathParts[pathParts.length - 2]; // Get threadId from path

    if (!threadId) {
      return ApiUtils.createErrorResponse("Thread ID is required", 400);
    }

    const result = await MessageManager.getThreadMessages(threadId, userId!);
    return ApiUtils.createResponse(result);
  },
);

// POST /api/threads/[id]/messages - Send a message to a thread
export const POST = withApiMiddleware(
  { auth: true },
  async (request: NextRequest, { userId }) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const threadId = pathParts[pathParts.length - 2]; // Get threadId from path

    if (!threadId) {
      return ApiUtils.createErrorResponse("Thread ID is required", 400);
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string") {
      return ApiUtils.createErrorResponse("Message content is required", 400);
    }

    const result = await MessageManager.sendMessage(threadId, userId!, content);
    return ApiUtils.createResponse(result, result.success ? 201 : 400);
  },
);

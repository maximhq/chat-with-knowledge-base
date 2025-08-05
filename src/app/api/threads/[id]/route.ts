// API routes for individual thread operations
import { NextRequest } from "next/server";
import { ThreadManager } from "@/modules/threads";
import {
  withApiMiddleware,
  schemas,
  rateLimits,
  ApiUtils,
} from "@/modules/api";

// GET /api/threads/[id] - Get specific thread
export const GET = withApiMiddleware(
  { auth: true, rateLimit: rateLimits.default },
  async (request: NextRequest, { userId }) => {
    const url = new URL(request.url);
    const threadId = url.pathname.split("/").pop();

    if (!threadId) {
      return ApiUtils.createErrorResponse("Thread ID is required", 400);
    }

    const result = await ThreadManager.getThread(threadId, userId!);
    return ApiUtils.createResponse(result, result.success ? 200 : 404);
  },
);

// PUT /api/threads/[id] - Update thread
export const PUT = withApiMiddleware(
  {
    auth: true,
    rateLimit: rateLimits.default,
    validation: schemas.updateThread,
  },
  async (request: NextRequest, { userId, data }) => {
    const url = new URL(request.url);
    const threadId = url.pathname.split("/").pop();

    if (!threadId) {
      return ApiUtils.createErrorResponse("Thread ID is required", 400);
    }

    const result = await ThreadManager.updateThreadTitle(
      threadId,
      userId!,
      data!.title,
    );
    return ApiUtils.createResponse(result);
  },
);

// DELETE /api/threads/[id] - Delete thread
export const DELETE = withApiMiddleware(
  { auth: true, rateLimit: rateLimits.default },
  async (request: NextRequest, { userId }) => {
    const url = new URL(request.url);
    const threadId = url.pathname.split("/").pop();

    if (!threadId) {
      return ApiUtils.createErrorResponse("Thread ID is required", 400);
    }

    const result = await ThreadManager.deleteThread(threadId, userId!);
    return ApiUtils.createResponse(result);
  },
);

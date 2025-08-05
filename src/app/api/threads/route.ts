// API routes for thread management
import { NextRequest } from "next/server";
import { ThreadManager } from "@/modules/threads";
import {
  withApiMiddleware,
  schemas,
  rateLimits,
  ApiUtils,
} from "@/modules/api";

// GET /api/threads - Get all threads for authenticated user
export const GET = withApiMiddleware(
  { auth: true, rateLimit: rateLimits.default },
  async (request: NextRequest, { userId }) => {
    const result = await ThreadManager.getUserThreads(userId!);
    return ApiUtils.createResponse(result);
  },
);

// POST /api/threads - Create new thread
export const POST = withApiMiddleware(
  {
    auth: true,
    rateLimit: rateLimits.default,
    validation: schemas.createThread,
  },
  async (request: NextRequest, { userId, data }) => {
    const result = await ThreadManager.createThread(userId!, data?.title);
    return ApiUtils.createResponse(result, result.success ? 201 : 400);
  },
);

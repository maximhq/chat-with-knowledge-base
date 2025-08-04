// API Module - REST endpoints with validation, auth checks, and rate limiting
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/modules/auth";
import type { ApiResponse } from "@/types";
import { z } from "zod";

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Validation schemas
export const schemas = {
  // Thread schemas
  createThread: z.object({
    title: z.string().min(1).max(100).optional(),
  }),

  updateThread: z.object({
    title: z.string().min(1).max(100),
  }),

  // Message schemas
  createMessage: z.object({
    content: z.string().min(1).max(10000),
    role: z.enum(["USER", "ASSISTANT", "SYSTEM"]),
  }),

  // Chat schemas
  chatRequest: z.object({
    message: z.string().min(1).max(10000),
    threadId: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    stream: z.boolean().optional(),
  }),

  // File upload schemas
  fileUpload: z.object({
    filename: z.string().min(1).max(255),
    mimeType: z.string(),
    size: z.number().positive(),
  }),

  // External link schemas
  createLink: z.object({
    url: z.string().url(),
    title: z.string().max(255).optional(),
  }),

  updateLink: z.object({
    title: z.string().max(255).optional(),
    content: z.string().optional(),
  }),
};

// Rate limiting configuration
export const rateLimits = {
  default: { requests: 100, windowMs: 15 * 60 * 1000 }, // 100 requests per 15 minutes
  chat: { requests: 50, windowMs: 15 * 60 * 1000 }, // 50 chat requests per 15 minutes
  upload: { requests: 20, windowMs: 15 * 60 * 1000 }, // 20 uploads per 15 minutes
  auth: { requests: 10, windowMs: 15 * 60 * 1000 }, // 10 auth requests per 15 minutes
};

// API utilities
export class ApiUtils {
  /**
   * Create standardized API response
   */
  static createResponse<T>(
    data: ApiResponse<T>,
    status: number = 200
  ): NextResponse {
    return NextResponse.json(data, { status });
  }

  /**
   * Create error response
   */
  static createErrorResponse(
    error: string,
    status: number = 400
  ): NextResponse {
    return NextResponse.json(
      {
        success: false,
        error,
      },
      { status }
    );
  }

  /**
   * Validate request body against schema
   */
  static validateRequest<T>(
    body: unknown,
    schema: z.ZodSchema<T>
  ): { success: true; data: T } | { success: false; errors: string[] } {
    try {
      const data = schema.parse(body);
      return { success: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(
          (err) => `${err.path.join(".")}: ${err.message}`
        );
        return { success: false, errors };
      }
      return { success: false, errors: ["Invalid request data"] };
    }
  }

  /**
   * Extract user ID from session using NextAuth.js v5
   */
  static async getUserId(request: NextRequest): Promise<string | null> {
    try {
      const session = await auth();
      return session?.user?.id || null;
    } catch (error) {
      console.error("Error getting user ID:", error);
      return null;
    }
  }

  /**
   * Get client IP address
   */
  static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIP = request.headers.get("x-real-ip");

    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }

    if (realIP) {
      return realIP;
    }

    return "unknown";
  }

  /**
   * Parse request body safely
   */
  static async parseRequestBody(request: NextRequest): Promise<unknown> {
    try {
      const contentType = request.headers.get("content-type");

      if (contentType?.includes("application/json")) {
        return await request.json();
      }

      if (contentType?.includes("multipart/form-data")) {
        return await request.formData();
      }

      return await request.text();
    } catch (error) {
      console.error("Error parsing request body:", error);
      return null;
    }
  }
}

// Rate limiting middleware
export class RateLimiter {
  /**
   * Check rate limit for a client
   */
  static checkRateLimit(
    clientId: string,
    limit: { requests: number; windowMs: number }
  ): { allowed: boolean; resetTime?: number; remaining?: number } {
    const now = Date.now();
    const key = `${clientId}:${Math.floor(now / limit.windowMs)}`;

    const current = rateLimitStore.get(key);

    if (!current) {
      rateLimitStore.set(key, { count: 1, resetTime: now + limit.windowMs });
      return { allowed: true, remaining: limit.requests - 1 };
    }

    if (current.count >= limit.requests) {
      return {
        allowed: false,
        resetTime: current.resetTime,
        remaining: 0,
      };
    }

    current.count++;
    return {
      allowed: true,
      remaining: limit.requests - current.count,
    };
  }

  /**
   * Clean up expired rate limit entries
   */
  static cleanup(): void {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }
}

// API middleware functions
export async function requireAuth(): Promise<ApiResponse<null> | null> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Authentication required",
        data: null,
      };
    }

    return null; // No error, user is authenticated
  } catch (error) {
    console.error("Auth check error:", error);
    return {
      success: false,
      error: "Authentication failed",
      data: null,
    };
  }
}

export function withRateLimit(
  limit: { requests: number; windowMs: number },
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const clientIP = ApiUtils.getClientIP(request);
      const rateCheck = RateLimiter.checkRateLimit(clientIP, limit);

      if (!rateCheck.allowed) {
        const resetTime = rateCheck.resetTime
          ? new Date(rateCheck.resetTime).toISOString()
          : undefined;

        return NextResponse.json(
          {
            success: false,
            error: "Rate limit exceeded",
            resetTime,
          },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": limit.requests.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": resetTime || "",
            },
          }
        );
      }

      const response = await handler(request);

      // Add rate limit headers
      response.headers.set("X-RateLimit-Limit", limit.requests.toString());
      response.headers.set(
        "X-RateLimit-Remaining",
        (rateCheck.remaining || 0).toString()
      );

      return response;
    } catch (error) {
      console.error("Rate limit middleware error:", error);
      return ApiUtils.createErrorResponse("Internal server error", 500);
    }
  };
}

export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (request: NextRequest, data: T) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const body = await ApiUtils.parseRequestBody(request);
      const validation = ApiUtils.validateRequest(body, schema);

      if (!validation.success) {
        return ApiUtils.createErrorResponse(
          `Validation failed: ${validation.errors.join(", ")}`,
          400
        );
      }

      return await handler(request, validation.data);
    } catch (error) {
      console.error("Validation middleware error:", error);
      return ApiUtils.createErrorResponse("Invalid request data", 400);
    }
  };
}

// Combined middleware
export function withApiMiddleware<T>(
  options: {
    auth?: boolean;
    rateLimit?: { requests: number; windowMs: number };
    validation?: z.ZodSchema<T>;
  },
  handler: (
    request: NextRequest,
    context: { userId?: string; data?: T }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const context: { userId?: string; data?: T } = {};

      // Rate limiting
      if (options.rateLimit) {
        const clientIP = ApiUtils.getClientIP(request);
        const rateCheck = RateLimiter.checkRateLimit(
          clientIP,
          options.rateLimit
        );

        if (!rateCheck.allowed) {
          return ApiUtils.createErrorResponse("Rate limit exceeded", 429);
        }
      }

      // Authentication
      if (options.auth) {
        const userId = await ApiUtils.getUserId(request);
        if (!userId) {
          return ApiUtils.createErrorResponse("Authentication required", 401);
        }
        context.userId = userId;
      }

      // Validation
      if (options.validation) {
        const body = await ApiUtils.parseRequestBody(request);
        const validation = ApiUtils.validateRequest(body, options.validation);

        if (!validation.success) {
          return ApiUtils.createErrorResponse(
            `Validation failed: ${validation.errors.join(", ")}`,
            400
          );
        }
        context.data = validation.data;
      }

      return await handler(request, context);
    } catch (error) {
      console.error("API middleware error:", error);
      return ApiUtils.createErrorResponse("Internal server error", 500);
    }
  };
}

// Health check endpoint
export async function healthCheck(): Promise<NextResponse> {
  try {
    // Check database connection
    const { DatabaseUtils } = await import("@/modules/storage");
    const dbHealth = await DatabaseUtils.healthCheck();

    // Check LLM service
    const { chatService } = await import("@/modules/llm");
    const llmHealth = await chatService.healthCheck();

    // Check MCP server
    const { mcpServer } = await import("@/modules/mcp");
    const mcpHealth = await mcpServer.healthCheck();

    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        llm: llmHealth,
        mcp: Object.values(mcpHealth).every(Boolean),
      },
    };

    const allHealthy = Object.values(health.services).every(Boolean);

    return NextResponse.json(health, {
      status: allHealthy ? 200 : 503,
    });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
      },
      { status: 503 }
    );
  }
}

// Cleanup function (should be called periodically)
export function cleanup(): void {
  RateLimiter.cleanup();
}

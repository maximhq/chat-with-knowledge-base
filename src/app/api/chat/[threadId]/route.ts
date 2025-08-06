import { NextRequest } from "next/server";
import { withApiMiddleware, ApiUtils } from "@/modules/api";
import { prisma } from "@/modules/storage";
import { z } from "zod";

// Validation schema for the chat request
const chatSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(4000, "Message too long"),
});

// POST /api/chat/[threadId]
export const POST = withApiMiddleware(
  {
    auth: true,
    validation: chatSchema,
  },
  async (request: NextRequest, { data }) => {
    try {
      // Extract threadId from URL params
      const url = new URL(request.url);
      const pathSegments = url.pathname.split("/");
      const threadId = pathSegments[pathSegments.length - 1];

      // Validate threadId format
      if (!threadId || typeof threadId !== "string") {
        return ApiUtils.createErrorResponse("Invalid thread ID", 400);
      }

      const { message } = data!;

      // Check if thread exists and has documents
      const thread = await prisma.thread.findUnique({
        where: { id: threadId },
      });

      if (!thread) {
        return ApiUtils.createErrorResponse("Thread not found", 404);
      }

      // Use RAG to generate response with context from thread documents
      let response: string;
      try {
        const ragManager = await import("@/modules/rag").then((m) =>
          m.createRAGManager()
        );
        const result = await ragManager.generateResponse(message, threadId);

        if (!result.response) {
          throw new Error("No response generated");
        }

        response = result.response;
      } catch (error) {
        console.error("RAG generation failed for chat:", error);
        return ApiUtils.createErrorResponse(
          "I'm sorry, I couldn't process your question at the moment. Please try again later.",
          500
        );
      }

      return ApiUtils.createResponse({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error("Chat API error:", error);
      return ApiUtils.createErrorResponse("Internal server error", 500);
    }
  }
);

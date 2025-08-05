import { NextRequest } from "next/server";
import { MessageManager } from "@/modules/messages";
import { chatService } from "@/modules/llm";
import { withApiMiddleware, schemas, ApiUtils } from "@/modules/api";
import { MessageRole } from "@/types";

// POST /api/chat - Send message and get AI response
export const POST = withApiMiddleware(
  {
    auth: true,
    validation: schemas.chatRequest,
  },
  async (request: NextRequest, { userId, data }) => {
    try {
      const { message, threadId, model, temperature } = data!;

      // Add user message to thread
      const userMessageResult = await MessageManager.addMessage(
        threadId!,
        message,
        MessageRole.USER,
        userId!,
      );

      if (!userMessageResult.success) {
        return ApiUtils.createErrorResponse(
          userMessageResult.error || "Failed to save user message",
          400,
        );
      }

      // Use RAG to generate response with context (handles context retrieval internally)
      let ragResponse: string | null = null;
      try {
        const ragManager = await import("@/modules/rag").then((m) =>
          m.createRAGManager(),
        );
        const result = await ragManager.generateResponse(message, threadId!);
        ragResponse = result.response;
      } catch (error) {
        console.warn(
          "RAG generation failed, falling back to regular chat:",
          error,
        );
        ragResponse = null;
      }

      // Use RAG response if available, otherwise fall back to regular chat
      let finalResponse: string;

      if (ragResponse) {
        // Use RAG-generated response
        finalResponse = ragResponse;
      } else {
        // Fall back to regular chat without context
        const response = await chatService.processMessage(
          [{ role: "user", content: message }],
          [],
          { model, temperature },
        );

        if (!response.success) {
          return ApiUtils.createErrorResponse(
            response.error || "Failed to process message",
            500,
          );
        }

        finalResponse = response.data!.content;
      }

      // Save assistant message
      const assistantMessageResult = await MessageManager.addMessage(
        threadId!,
        finalResponse,
        MessageRole.ASSISTANT,
        userId!,
      );

      if (!assistantMessageResult.success) {
        console.error(
          "Failed to save assistant message:",
          assistantMessageResult.error,
        );
      }

      return ApiUtils.createResponse({
        success: true,
        data: {
          content: finalResponse,
          messageId: assistantMessageResult.data?.id,
        },
      });
    } catch (error) {
      console.error("Chat API error:", error);
      return ApiUtils.createErrorResponse("Internal server error", 500);
    }
  },
);

// API route for chat functionality with streaming support
import { NextRequest } from 'next/server';
import { MessageManager } from '@/modules/messages';
import { chatService } from '@/modules/llm';
import { mcpServer } from '@/modules/mcp';
import { withApiMiddleware, schemas, rateLimits, ApiUtils } from '@/modules/api';

// POST /api/chat - Send message and get AI response
export const POST = withApiMiddleware(
  { 
    auth: true, 
    rateLimit: rateLimits.chat,
    validation: schemas.chatRequest
  },
  async (request: NextRequest, { userId, data }) => {
    try {
      const { message, threadId, model, temperature, stream = true } = data!;

      // Add user message to thread
      const userMessageResult = await MessageManager.addMessage(
        threadId!,
        message,
        'USER',
        userId!
      );

      if (!userMessageResult.success) {
        return ApiUtils.createErrorResponse(userMessageResult.error || 'Failed to save user message', 400);
      }

      // Get conversation context
      const messagesResult = await MessageManager.getThreadMessages(threadId!, userId!);
      if (!messagesResult.success) {
        return ApiUtils.createErrorResponse('Failed to get conversation history', 500);
      }

      // Get relevant context from knowledge base
      const contextResult = await mcpServer.getContext(message, userId!, {
        maxChunks: 5,
        minRelevanceScore: 0.2
      });

      const context = contextResult.success ? contextResult.data : [];

      // Format messages for LLM
      const formattedMessages = MessageManager.formatMessagesForLLM(messagesResult.data!);

      if (stream) {
        // Return streaming response
        const encoder = new TextEncoder();
        let assistantMessageId: string | null = null;
        let assistantContent = '';

        const stream = new ReadableStream({
          async start(controller) {
            try {
              await chatService.processStreamingMessage(
                formattedMessages,
                context,
                // onChunk
                (chunk: string) => {
                  assistantContent += chunk;
                  const data = JSON.stringify({ content: chunk, done: false });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                },
                // onComplete
                async () => {
                  try {
                    // Save assistant message
                    const assistantMessageResult = await MessageManager.addMessage(
                      threadId!,
                      assistantContent,
                      'ASSISTANT',
                      userId!
                    );

                    if (assistantMessageResult.success) {
                      assistantMessageId = assistantMessageResult.data!.id;
                    }

                    const data = JSON.stringify({ 
                      content: '', 
                      done: true, 
                      messageId: assistantMessageId 
                    });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                  } catch (error) {
                    console.error('Error saving assistant message:', error);
                    controller.error(error);
                  }
                },
                // onError
                (error: Error) => {
                  console.error('Streaming error:', error);
                  const data = JSON.stringify({ 
                    content: '', 
                    done: true, 
                    error: error.message 
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  controller.close();
                },
                { model, temperature }
              );
            } catch (error) {
              console.error('Chat processing error:', error);
              controller.error(error);
            }
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        // Return non-streaming response
        const response = await chatService.processMessage(
          formattedMessages,
          context,
          { model, temperature }
        );

        if (!response.success) {
          return ApiUtils.createErrorResponse(response.error || 'Failed to process message', 500);
        }

        // Save assistant message
        const assistantMessageResult = await MessageManager.addMessage(
          threadId!,
          response.data!.content,
          'ASSISTANT',
          userId!
        );

        if (!assistantMessageResult.success) {
          console.error('Failed to save assistant message:', assistantMessageResult.error);
        }

        return ApiUtils.createResponse({
          success: true,
          data: {
            content: response.data!.content,
            messageId: assistantMessageResult.data?.id,
            usage: response.data!.usage
          }
        });
      }
    } catch (error) {
      console.error('Chat API error:', error);
      return ApiUtils.createErrorResponse('Internal server error', 500);
    }
  }
);

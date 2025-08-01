// Message Handling Module - Per-thread message history with markdown and streaming support
import { MessageStorage, ThreadStorage } from '@/modules/storage';
import { ThreadManager } from '@/modules/threads';
import type { Message, MessageRole, ApiResponse, ChatStreamResponse } from '@/types';

export class MessageManager {
  /**
   * Add a new message to a thread
   */
  static async addMessage(
    threadId: string,
    content: string,
    role: MessageRole,
    userId: string
  ): Promise<ApiResponse<Message>> {
    try {
      // Verify thread ownership
      const thread = await ThreadStorage.findById(threadId);
      if (!thread) {
        return {
          success: false,
          error: 'Thread not found'
        };
      }

      if (thread.userId !== userId) {
        return {
          success: false,
          error: 'Access denied'
        };
      }

      // Create the message
      const message = await MessageStorage.create({
        threadId,
        content: content.trim(),
        role
      });

      // Update thread's updatedAt timestamp
      await ThreadManager.touchThread(threadId);

      // If this is the first user message, update thread title
      if (role === 'USER') {
        const messages = await MessageStorage.findByThreadId(threadId);
        const userMessages = messages.filter(m => m.role === 'USER');
        
        if (userMessages.length === 1) {
          const title = await ThreadManager.generateThreadTitle(content);
          await ThreadStorage.update(threadId, { title });
        }
      }

      return {
        success: true,
        data: message,
        message: 'Message added successfully'
      };
    } catch (error) {
      console.error('Error adding message:', error);
      return {
        success: false,
        error: 'Failed to add message'
      };
    }
  }

  /**
   * Get all messages for a thread
   */
  static async getThreadMessages(
    threadId: string,
    userId: string
  ): Promise<ApiResponse<Message[]>> {
    try {
      // Verify thread ownership
      const thread = await ThreadStorage.findById(threadId);
      if (!thread) {
        return {
          success: false,
          error: 'Thread not found'
        };
      }

      if (thread.userId !== userId) {
        return {
          success: false,
          error: 'Access denied'
        };
      }

      const messages = await MessageStorage.findByThreadId(threadId);

      return {
        success: true,
        data: messages,
        message: `Found ${messages.length} messages`
      };
    } catch (error) {
      console.error('Error fetching thread messages:', error);
      return {
        success: false,
        error: 'Failed to fetch messages'
      };
    }
  }

  /**
   * Delete a message
   */
  static async deleteMessage(
    messageId: string,
    userId: string
  ): Promise<ApiResponse<void>> {
    try {
      const message = await MessageStorage.findById(messageId);
      if (!message) {
        return {
          success: false,
          error: 'Message not found'
        };
      }

      // Verify thread ownership
      const thread = await ThreadStorage.findById(message.threadId);
      if (!thread || thread.userId !== userId) {
        return {
          success: false,
          error: 'Access denied'
        };
      }

      await MessageStorage.delete(messageId);

      return {
        success: true,
        message: 'Message deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting message:', error);
      return {
        success: false,
        error: 'Failed to delete message'
      };
    }
  }

  /**
   * Format messages for LLM consumption
   */
  static formatMessagesForLLM(messages: Message[]): Array<{ role: string; content: string }> {
    return messages.map(message => ({
      role: message.role.toLowerCase(),
      content: message.content
    }));
  }

  /**
   * Validate message content
   */
  static validateMessageContent(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!content || typeof content !== 'string') {
      errors.push('Message content is required');
    } else {
      const trimmed = content.trim();
      if (trimmed.length === 0) {
        errors.push('Message content cannot be empty');
      } else if (trimmed.length > 10000) {
        errors.push('Message content cannot exceed 10,000 characters');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Process markdown in message content
   */
  static processMarkdown(content: string): string {
    // Basic markdown processing - in production, use a proper markdown library
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/\n/g, '<br>');
  }

  /**
   * Extract code blocks from message content
   */
  static extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const codeBlocks: Array<{ language: string; code: string }> = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }

    return codeBlocks;
  }

  /**
   * Get conversation context for LLM (last N messages)
   */
  static getConversationContext(
    messages: Message[], 
    maxMessages: number = 20
  ): Message[] {
    return messages.slice(-maxMessages);
  }

  /**
   * Calculate token count estimate (rough approximation)
   */
  static estimateTokenCount(content: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(content.length / 4);
  }

  /**
   * Truncate conversation to fit token limit
   */
  static truncateConversation(
    messages: Message[], 
    maxTokens: number = 4000
  ): Message[] {
    let totalTokens = 0;
    const truncatedMessages: Message[] = [];

    // Start from the most recent messages
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = this.estimateTokenCount(message.content);
      
      if (totalTokens + messageTokens > maxTokens) {
        break;
      }
      
      totalTokens += messageTokens;
      truncatedMessages.unshift(message);
    }

    return truncatedMessages;
  }
}

// Streaming message handler for real-time responses
export class StreamingMessageHandler {
  private static activeStreams = new Map<string, AbortController>();

  /**
   * Start a streaming response
   */
  static startStream(messageId: string): AbortController {
    const controller = new AbortController();
    this.activeStreams.set(messageId, controller);
    return controller;
  }

  /**
   * Stop a streaming response
   */
  static stopStream(messageId: string): void {
    const controller = this.activeStreams.get(messageId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(messageId);
    }
  }

  /**
   * Process streaming chunk
   */
  static processStreamChunk(
    chunk: string,
    messageId: string
  ): ChatStreamResponse {
    try {
      // Parse the streaming chunk (format depends on LLM provider)
      const data = JSON.parse(chunk);
      
      return {
        content: data.content || '',
        done: data.done || false,
        messageId
      };
    } catch (error) {
      console.error('Error processing stream chunk:', error);
      return {
        content: '',
        done: true,
        messageId
      };
    }
  }

  /**
   * Clean up inactive streams
   */
  static cleanup(): void {
    for (const [messageId, controller] of this.activeStreams.entries()) {
      if (controller.signal.aborted) {
        this.activeStreams.delete(messageId);
      }
    }
  }
}

export { MessageManager as default, StreamingMessageHandler };

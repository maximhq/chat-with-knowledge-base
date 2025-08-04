// Thread Management Module - CRUD operations for chat threads
import { ThreadStorage, MessageStorage } from "@/modules/storage";
import type { Thread, Message, ApiResponse } from "@/types";

export class ThreadManager {
  /**
   * Create a new thread
   */
  static async createThread(
    userId: string,
    title: string = "New Chat"
  ): Promise<ApiResponse<Thread>> {
    try {
      const thread = await ThreadStorage.create({
        title,
        userId,
      });

      return {
        success: true,
        data: thread,
        message: "Thread created successfully",
      };
    } catch (error) {
      console.error("Error creating thread:", error);
      return {
        success: false,
        error: "Failed to create thread",
      };
    }
  }

  /**
   * Get all threads for a user
   */
  static async getUserThreads(userId: string): Promise<ApiResponse<Thread[]>> {
    try {
      const threads = await ThreadStorage.findByUserId(userId);

      return {
        success: true,
        data: threads,
        message: `Found ${threads.length} threads`,
      };
    } catch (error) {
      console.error("Error fetching user threads:", error);
      return {
        success: false,
        error: "Failed to fetch threads",
      };
    }
  }

  /**
   * Get a specific thread with messages
   */
  static async getThread(
    threadId: string,
    userId: string
  ): Promise<ApiResponse<Thread>> {
    try {
      const thread = await ThreadStorage.findById(threadId);

      if (!thread) {
        return {
          success: false,
          error: "Thread not found",
        };
      }

      // Verify ownership
      if (thread.userId !== userId) {
        return {
          success: false,
          error: "Access denied",
        };
      }

      return {
        success: true,
        data: thread,
        message: "Thread retrieved successfully",
      };
    } catch (error) {
      console.error("Error fetching thread:", error);
      return {
        success: false,
        error: "Failed to fetch thread",
      };
    }
  }

  /**
   * Update thread title
   */
  static async updateThreadTitle(
    threadId: string,
    userId: string,
    title: string
  ): Promise<ApiResponse<Thread>> {
    try {
      // First verify ownership
      const existingThread = await ThreadStorage.findById(threadId);

      if (!existingThread) {
        return {
          success: false,
          error: "Thread not found",
        };
      }

      if (existingThread.userId !== userId) {
        return {
          success: false,
          error: "Access denied",
        };
      }

      const updatedThread = await ThreadStorage.update(threadId, { title });

      return {
        success: true,
        data: updatedThread,
        message: "Thread title updated successfully",
      };
    } catch (error) {
      console.error("Error updating thread title:", error);
      return {
        success: false,
        error: "Failed to update thread title",
      };
    }
  }

  /**
   * Delete a thread
   */
  static async deleteThread(
    threadId: string,
    userId: string
  ): Promise<ApiResponse<void>> {
    try {
      // First verify ownership
      const existingThread = await ThreadStorage.findById(threadId);

      if (!existingThread) {
        return {
          success: false,
          error: "Thread not found",
        };
      }

      if (existingThread.userId !== userId) {
        return {
          success: false,
          error: "Access denied",
        };
      }

      await ThreadStorage.delete(threadId);

      return {
        success: true,
        message: "Thread deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting thread:", error);
      return {
        success: false,
        error: "Failed to delete thread",
      };
    }
  }

  /**
   * Generate thread title from first message
   */
  static async generateThreadTitle(content: string): Promise<string> {
    // Simple title generation - in production, you might use an LLM for this
    const words = content.trim().split(" ");
    const title = words.slice(0, 6).join(" ");

    if (title.length > 50) {
      return title.substring(0, 47) + "...";
    }

    return title || "New Chat";
  }

  /**
   * Update thread's updatedAt timestamp (called when new messages are added)
   */
  static async touchThread(threadId: string): Promise<void> {
    try {
      await ThreadStorage.update(threadId, { updatedAt: new Date() });
    } catch (error) {
      console.error("Error touching thread:", error);
    }
  }

  /**
   * Get thread preview (first few words of the latest message)
   */
  static getThreadPreview(thread: Thread): string {
    if (!thread.messages || thread.messages.length === 0) {
      return "No messages yet";
    }

    const latestMessage = thread.messages[thread.messages.length - 1];
    const preview = latestMessage.content.trim();

    if (preview.length > 60) {
      return preview.substring(0, 57) + "...";
    }

    return preview;
  }

  /**
   * Validate thread data
   */
  static validateThreadData(data: { title?: string }): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (data.title !== undefined) {
      if (typeof data.title !== "string") {
        errors.push("Title must be a string");
      } else if (data.title.trim().length === 0) {
        errors.push("Title cannot be empty");
      } else if (data.title.length > 100) {
        errors.push("Title cannot exceed 100 characters");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export default ThreadManager;

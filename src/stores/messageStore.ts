import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { Message } from "@/types";
import { MessageRole } from "@/types";

interface MessageState {
  // State - organized by threadId
  messagesByThread: Record<string, Message[]>;
  isLoading: boolean;
  isStreaming: boolean;
  streamingThreadId: string | null;
  error: string | null;

  // Actions
  setMessages: (threadId: string, messages: Message[]) => void;
  addMessage: (threadId: string, message: Message) => void;
  updateMessage: (
    threadId: string,
    messageId: string,
    updates: Partial<Message>,
  ) => void;
  appendToMessage: (
    threadId: string,
    messageId: string,
    content: string,
  ) => void;
  clearMessages: (threadId: string) => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean, threadId?: string) => void;
  setError: (error: string | null) => void;

  // Async actions
  fetchMessages: (threadId: string) => Promise<void>;
  sendMessage: (threadId: string, content: string) => Promise<void>;
}

export const useMessageStore = create<MessageState>()(
  devtools(
    subscribeWithSelector(
      immer((set) => ({
        // Initial state
        messagesByThread: {},
        isLoading: false,
        isStreaming: false,
        streamingThreadId: null,
        error: null,

        // Synchronous actions
        setMessages: (threadId, messages) =>
          set((state) => {
            state.messagesByThread[threadId] = messages;
          }),

        addMessage: (threadId, message) =>
          set((state) => {
            if (!state.messagesByThread[threadId]) {
              state.messagesByThread[threadId] = [];
            }
            state.messagesByThread[threadId].push(message);
          }),

        updateMessage: (threadId, messageId, updates) =>
          set((state) => {
            const messages = state.messagesByThread[threadId];
            if (messages) {
              const index = messages.findIndex((m) => m.id === messageId);
              if (index !== -1) {
                Object.assign(messages[index], updates);
              }
            }
          }),

        appendToMessage: (threadId, messageId, content) =>
          set((state) => {
            const messages = state.messagesByThread[threadId];
            if (messages) {
              const message = messages.find((m) => m.id === messageId);
              if (message) {
                message.content += content;
              }
            }
          }),

        clearMessages: (threadId) =>
          set((state) => {
            delete state.messagesByThread[threadId];
          }),

        setLoading: (loading) =>
          set((state) => {
            state.isLoading = loading;
          }),

        setStreaming: (streaming, threadId) =>
          set((state) => {
            state.isStreaming = streaming;
            state.streamingThreadId = streaming ? threadId || null : null;
          }),

        setError: (error) =>
          set((state) => {
            state.error = error;
          }),

        // Async actions
        fetchMessages: async (threadId) => {
          if (!threadId) return;

          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await fetch(`/api/threads/${threadId}/messages`);
            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                set((state) => {
                  state.messagesByThread[threadId] = data.data;
                  state.isLoading = false;
                });
              } else {
                throw new Error(data.error || "Failed to fetch messages");
              }
            } else {
              throw new Error("Failed to fetch messages");
            }
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "Unknown error";
              state.isLoading = false;
            });
          }
        },

        sendMessage: async (threadId, content) => {
          if (!threadId || !content.trim()) return;

          // Add user message immediately
          const userMessage: Message = {
            id: `temp-${Date.now()}`,
            threadId,
            content: content.trim(),
            role: MessageRole.USER,
            createdAt: new Date(),
          };

          set((state) => {
            if (!state.messagesByThread[threadId]) {
              state.messagesByThread[threadId] = [];
            }
            state.messagesByThread[threadId].push(userMessage);
            state.isStreaming = true;
            state.streamingThreadId = threadId;
          });

          try {
            const response = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: content,
                threadId,
              }),
            });

            if (!response.ok) {
              throw new Error("Failed to send message");
            }

            // Handle JSON response (non-streaming)
            const responseData = await response.json();

            if (!responseData.success) {
              throw new Error(responseData.error || "Failed to get response");
            }

            // Add assistant message with the complete response
            const assistantMessage: Message = {
              id:
                responseData.data?.messageId || `temp-assistant-${Date.now()}`,
              threadId,
              content: responseData.data?.content || "",
              role: MessageRole.ASSISTANT,
              createdAt: new Date(),
            };

            set((state) => {
              state.messagesByThread[threadId].push(assistantMessage);
              state.isStreaming = false;
              state.streamingThreadId = null;
            });
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error
                  ? error.message
                  : "Failed to send message";
              state.isStreaming = false;
              state.streamingThreadId = null;
            });
          }
        },
      })),
    ),
    { name: "message-store" },
  ),
);

// Empty array constant to prevent re-renders
const EMPTY_MESSAGES: Message[] = [];

// Selectors for optimized re-renders
export const useThreadMessages = (threadId: string | null) =>
  useMessageStore((state) => {
    if (!threadId) return EMPTY_MESSAGES;
    return state.messagesByThread[threadId] || EMPTY_MESSAGES;
  });

export const useIsStreamingForThread = (threadId: string | null) =>
  useMessageStore(
    (state) => state.isStreaming && state.streamingThreadId === threadId,
  );

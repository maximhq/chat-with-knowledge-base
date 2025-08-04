import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { Thread } from "@/types";

interface ThreadState {
  // State
  threads: Thread[];
  selectedThreadId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setThreads: (threads: Thread[]) => void;
  addThread: (thread: Thread) => void;
  updateThread: (threadId: string, updates: Partial<Thread>) => void;
  deleteThread: (threadId: string) => void;
  selectThread: (threadId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Async actions
  fetchThreads: () => Promise<void>;
  createThread: (title?: string) => Promise<Thread | null>;
  removeThread: (threadId: string) => Promise<void>;
}

export const useThreadStore = create<ThreadState>()(
  devtools(
    subscribeWithSelector(
      immer((set) => ({
        // Initial state
        threads: [],
        selectedThreadId: null,
        isLoading: false,
        error: null,

        // Synchronous actions
        setThreads: (threads) =>
          set((state) => {
            state.threads = threads;
          }),

        addThread: (thread) =>
          set((state) => {
            state.threads.unshift(thread);
          }),

        updateThread: (threadId, updates) =>
          set((state) => {
            const index = state.threads.findIndex((t) => t.id === threadId);
            if (index !== -1) {
              Object.assign(state.threads[index], updates);
            }
          }),

        deleteThread: (threadId) =>
          set((state) => {
            state.threads = state.threads.filter((t) => t.id !== threadId);
            if (state.selectedThreadId === threadId) {
              state.selectedThreadId = null;
            }
          }),

        selectThread: (threadId) =>
          set((state) => {
            state.selectedThreadId = threadId;
          }),

        setLoading: (loading) =>
          set((state) => {
            state.isLoading = loading;
          }),

        setError: (error) =>
          set((state) => {
            state.error = error;
          }),

        // Async actions
        fetchThreads: async () => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await fetch("/api/threads");
            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                set((state) => {
                  state.threads = data.data;
                  state.isLoading = false;
                });
              } else {
                throw new Error(data.error || "Failed to fetch threads");
              }
            } else {
              throw new Error("Failed to fetch threads");
            }
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "Unknown error";
              state.isLoading = false;
            });
          }
        },

        createThread: async (title = "New Chat") => {
          try {
            const response = await fetch("/api/threads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title }),
            });

            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                const newThread = data.data;
                set((state) => {
                  state.threads.unshift(newThread);
                  state.selectedThreadId = newThread.id;
                });
                return newThread;
              }
            }
            throw new Error("Failed to create thread");
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error
                  ? error.message
                  : "Failed to create thread";
            });
            return null;
          }
        },

        removeThread: async (threadId) => {
          try {
            const response = await fetch(`/api/threads/${threadId}`, {
              method: "DELETE",
            });

            if (response.ok) {
              set((state) => {
                state.threads = state.threads.filter((t) => t.id !== threadId);
                if (state.selectedThreadId === threadId) {
                  state.selectedThreadId = null;
                }
              });
            } else {
              throw new Error("Failed to delete thread");
            }
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error
                  ? error.message
                  : "Failed to delete thread";
            });
          }
        },
      }))
    ),
    { name: "thread-store" }
  )
);

// Selectors for optimized re-renders
export const useSelectedThread = () =>
  useThreadStore(
    (state) =>
      state.threads.find((t) => t.id === state.selectedThreadId) || null
  );

export const useThreadsCount = () =>
  useThreadStore((state) => state.threads.length);

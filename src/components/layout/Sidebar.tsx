"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useThreadStore } from "@/stores";
import type { Thread } from "@/types";

interface SidebarProps {
  selectedThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onNewThread: () => void;
}

export function Sidebar({
  selectedThreadId,
  onThreadSelect,
  onNewThread,
}: SidebarProps) {
  const { data: session } = useSession();
  const threads = useThreadStore((state) => state.threads);
  const isLoading = useThreadStore((state) => state.isLoading);
  const fetchThreads = useThreadStore((state) => state.fetchThreads);
  const createThread = useThreadStore((state) => state.createThread);
  const removeThread = useThreadStore((state) => state.removeThread);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const handleNewThread = async () => {
    const newThread = await createThread("New Chat");
    if (newThread) {
      onThreadSelect(newThread.id);
    }
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this thread?")) {
      return;
    }

    await removeThread(threadId);
    if (selectedThreadId === threadId) {
      onNewThread();
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return "Today";
    } else if (diffDays === 2) {
      return "Yesterday";
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return d.toLocaleDateString();
    }
  };

  const getThreadPreview = (thread: Thread) => {
    if (thread.messages && thread.messages.length > 0) {
      const lastMessage = thread.messages[thread.messages.length - 1];
      return (
        lastMessage.content.substring(0, 60) +
        (lastMessage.content.length > 60 ? "..." : "")
      );
    }
    return "No messages yet";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 border-b border-gray-200 dark:border-gray-700">
        <div className="h-14 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Chats
          </h2>
          <Button onClick={handleNewThread} size="sm" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No chats yet</p>
              <p className="text-xs mt-1">Start a new conversation</p>
            </div>
          ) : (
            <div className="space-y-1">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => onThreadSelect(thread.id)}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedThreadId === thread.id
                      ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {thread.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {getThreadPreview(thread)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        {formatDate(thread.updatedAt)}
                      </p>
                    </div>

                    {/* Thread Actions */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <Button
                        onClick={(e) => handleDeleteThread(thread.id, e)}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {session?.user?.email?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {session?.user?.email}
            </span>
          </div>
          <Button
            onClick={() => signOut()}
            size="sm"
            variant="ghost"
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;

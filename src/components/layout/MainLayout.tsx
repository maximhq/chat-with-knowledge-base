"use client";

import React, { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { AuthGuard } from "./AuthGuard";
import { Toaster } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThreadStore, useUIStore, useActiveTab } from "@/stores";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Settings } from "lucide-react";

interface MainLayoutProps {
  threadId?: string;
}

export function MainLayout({ threadId }: MainLayoutProps) {
  const { data: session, status } = useSession();
  const selectedThreadId = useThreadStore((state) => state.selectedThreadId);
  const selectThread = useThreadStore((state) => state.selectThread);
  const activeTab = useActiveTab();
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const router = useRouter();
  const pathname = usePathname();

  // Thread validation state
  const [isValidatingThread, setIsValidatingThread] = useState(false);

  // Validate thread exists in database
  useEffect(() => {
    const validateThread = async () => {
      if (!threadId || !session?.user) {
        setIsValidatingThread(false);
        return;
      }

      setIsValidatingThread(true);

      try {
        const response = await fetch(`/api/threads/${threadId}`);

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Thread is valid, proceed with selection
            if (threadId !== selectedThreadId) {
              selectThread(threadId);
              setActiveTab("messages");
            }
            setIsValidatingThread(false);
          } else {
            // Thread not found or access denied, redirect to home
            console.log("Thread validation failed:", data.error);
            router.push("/");
          }
        } else {
          // Any error status (404, 403, etc.), redirect to home
          console.log(
            `Thread validation failed with status ${response.status}`
          );
          router.push("/");
        }
      } catch (error) {
        console.error("Thread validation error:", error);
        // Network error, redirect to home
        router.push("/");
      }
    };

    validateThread();
  }, [
    threadId,
    session?.user,
    selectedThreadId,
    selectThread,
    setActiveTab,
    router,
  ]);

  // Handle URL-based thread selection for home page
  useEffect(() => {
    if (!threadId && selectedThreadId && pathname === "/") {
      // URL has no threadId but store has a selected thread
      // Check if the selected thread still exists before redirecting
      const threads = useThreadStore.getState().threads;
      const threadExists = threads.some((t) => t.id === selectedThreadId);
      if (threadExists) {
        router.push(`/thread/${selectedThreadId}`);
      } else {
        // Thread doesn't exist, clear the selection
        selectThread(null);
      }
    }
  }, [threadId, selectedThreadId, pathname, router, selectThread]);

  // Handle thread selection with URL navigation
  const handleThreadSelect = (newThreadId: string | null) => {
    if (newThreadId) {
      router.push(`/thread/${newThreadId}`);
    } else {
      // Clear store state first to prevent race conditions
      selectThread(null);
      setActiveTab("messages");
      // Then redirect
      router.push("/");
    }
  };

  if (status === "loading" || isValidatingThread) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {/* Sidebar - Thread List */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <Sidebar
            selectedThreadId={selectedThreadId}
            onThreadSelect={handleThreadSelect}
          />
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <div className="h-14 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between px-6">
            <div className="flex items-center space-x-4">
              {/* Tab Navigation */}
              {selectedThreadId && (
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab("messages")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === "messages"
                        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Messages
                  </button>
                  <button
                    onClick={() => setActiveTab("knowledge-base")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === "knowledge-base"
                        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Knowledge Base
                  </button>
                </div>
              )}
            </div>

            {/* User Menu */}
            {session?.user?.email && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {session?.user?.email?.[0]?.toUpperCase() || "U"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Signed in as
                      </p>
                      <p className="text-sm font-medium leading-none">
                        {session?.user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Workspace Content */}
          <div className="flex-1 overflow-hidden">
            <Workspace
              activeTab={activeTab}
              selectedThreadId={selectedThreadId}
              onThreadSelect={handleThreadSelect}
            />
          </div>
        </div>

        {/* Toast Notifications */}
        <Toaster position="top-right" />
      </div>
    </AuthGuard>
  );
}

export default MainLayout;

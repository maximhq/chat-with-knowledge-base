"use client";

import React from "react";
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

interface MainLayoutProps {
  children?: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { data: session, status } = useSession();
  const selectedThreadId = useThreadStore((state) => state.selectedThreadId);
  const selectThread = useThreadStore((state) => state.selectThread);
  const activeTab = useActiveTab();
  const setActiveTab = useUIStore((state) => state.setActiveTab);

  if (status === "loading") {
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
            onThreadSelect={selectThread}
            onNewThread={() => {
              selectThread(null);
              setActiveTab("messages");
            }}
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
              onThreadSelect={selectThread}
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

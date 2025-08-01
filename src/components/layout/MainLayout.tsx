'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Sidebar } from './Sidebar';
import { Workspace } from './Workspace';
import { AuthGuard } from './AuthGuard';
import { Toaster } from '@/components/ui/sonner';

interface MainLayoutProps {
  children?: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { data: session, status } = useSession();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'messages' | 'knowledge-base'>('messages');

  if (status === 'loading') {
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
            onThreadSelect={setSelectedThreadId}
            onNewThread={() => {
              setSelectedThreadId(null);
              setActiveTab('messages');
            }}
          />
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <div className="h-14 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between px-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Chat with Knowledge Base
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Tab Navigation */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('messages')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'messages'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Messages
                </button>
                <button
                  onClick={() => setActiveTab('knowledge-base')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'knowledge-base'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Knowledge Base
                </button>
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {session?.user?.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Workspace Content */}
          <div className="flex-1 overflow-hidden">
            <Workspace
              activeTab={activeTab}
              selectedThreadId={selectedThreadId}
              onThreadSelect={setSelectedThreadId}
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

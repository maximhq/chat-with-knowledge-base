'use client';

import React from 'react';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { KnowledgeBaseInterface } from '@/components/knowledge-base/KnowledgeBaseInterface';

interface WorkspaceProps {
  activeTab: 'messages' | 'knowledge-base';
  selectedThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
}

export function Workspace({ activeTab, selectedThreadId, onThreadSelect }: WorkspaceProps) {
  return (
    <div className="h-full bg-white dark:bg-gray-900">
      {activeTab === 'messages' ? (
        <ChatInterface
          threadId={selectedThreadId}
          onThreadSelect={onThreadSelect}
        />
      ) : (
        <KnowledgeBaseInterface />
      )}
    </div>
  );
}

export default Workspace;

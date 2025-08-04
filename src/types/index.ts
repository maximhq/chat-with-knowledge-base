// Core application types for modular architecture

import { MessageRole, FileStatus } from '@prisma/client';

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Thread {
  id: string;
  title: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  messages?: Message[];
}

export interface Message {
  id: string;
  threadId: string;
  content: string;
  role: MessageRole;
  createdAt: Date;
}

// Export Prisma types for use in other modules
export { MessageRole, FileStatus };

export interface Document {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  userId: string;
  status: FileStatus;
  createdAt: Date;
  updatedAt: Date;
  chunks?: DocumentChunk[];
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: string; // JSON string of vector embeddings
  chunkIndex: number;
  createdAt: Date;
}

export interface ExternalLink {
  id: string;
  url: string;
  title: string | null;
  content: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Chat streaming types
export interface ChatStreamResponse {
  content: string;
  done: boolean;
  messageId?: string;
}

// File upload types
export interface FileUploadProgress {
  filename: string;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

// MCP (Multi-Context Provider) types
export interface ContextProvider {
  id: string;
  name: string;
  type: 'document' | 'link' | 'memory';
  enabled: boolean;
}

export interface ContextChunk {
  id: string;
  content: string;
  source: string;
  relevanceScore: number;
  metadata?: Record<string, unknown>;
}

// LLM Gateway types
export interface LLMRequest {
  messages: Array<{
    role: string;
    content: string;
  }>;
  context?: ContextChunk[];
  stream?: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

// UI Component types
export interface TabConfig {
  id: string;
  label: string;
  icon?: React.ComponentType;
  component: React.ComponentType;
}

export interface SidebarItem {
  id: string;
  title: string;
  preview?: string;
  timestamp: Date;
  active?: boolean;
}

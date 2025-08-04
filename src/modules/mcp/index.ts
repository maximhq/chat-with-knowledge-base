// MCP Server (Multi-Context Provider) - Extensible context injection system
import { DocumentChunkStorage, ExternalLinkStorage } from "@/modules/storage";
import type {
  ContextProvider,
  ContextChunk,
  ApiResponse,
  ExternalLink,
} from "@/types";

// Base interface for context providers
export interface IContextProvider {
  id: string;
  name: string;
  type: "document" | "link" | "memory";
  enabled: boolean;
  getContext(
    query: string,
    userId: string,
    limit?: number
  ): Promise<ContextChunk[]>;
}

// Document context provider
class DocumentContextProvider implements IContextProvider {
  id = "documents";
  name = "Document Knowledge Base";
  type = "document" as const;
  enabled = true;

  async getContext(
    query: string,
    userId: string,
    limit: number = 5
  ): Promise<ContextChunk[]> {
    try {
      // In production, this would use vector similarity search
      // For now, we'll use a simple text search approach
      const chunks = await DocumentChunkStorage.searchSimilar("", limit * 2);

      // Filter chunks that contain query terms (basic text matching)
      const queryTerms = query
        .toLowerCase()
        .split(" ")
        .filter((term) => term.length > 2);
      const relevantChunks = chunks.filter((chunk) => {
        const content = chunk.content.toLowerCase();
        return queryTerms.some((term) => content.includes(term));
      });

      return relevantChunks.slice(0, limit).map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        source: `Document chunk ${chunk.chunkIndex + 1}`,
        relevanceScore: this.calculateRelevanceScore(chunk.content, query),
        metadata: {
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          type: "document",
        },
      }));
    } catch (error) {
      console.error("Error getting document context:", error);
      return [];
    }
  }

  private calculateRelevanceScore(content: string, query: string): number {
    const queryTerms = query
      .toLowerCase()
      .split(" ")
      .filter((term) => term.length > 2);
    const contentLower = content.toLowerCase();

    let score = 0;
    for (const term of queryTerms) {
      const matches = (contentLower.match(new RegExp(term, "g")) || []).length;
      score += matches;
    }

    // Normalize score (0-1)
    return Math.min(score / queryTerms.length, 1);
  }
}

// External link context provider
class LinkContextProvider implements IContextProvider {
  id = "links";
  name = "External Links";
  type = "link" as const;
  enabled = true;

  async getContext(
    query: string,
    userId: string,
    limit: number = 3
  ): Promise<ContextChunk[]> {
    try {
      const links = await ExternalLinkStorage.findByUserId(userId);

      // Filter links that match the query
      const queryTerms = query
        .toLowerCase()
        .split(" ")
        .filter((term) => term.length > 2);
      const relevantLinks = links.filter((link) => {
        const searchText = `${link.title || ""} ${
          link.content || ""
        }`.toLowerCase();
        return queryTerms.some((term) => searchText.includes(term));
      });

      return relevantLinks.slice(0, limit).map((link) => ({
        id: link.id,
        content: link.content || link.title || link.url,
        source: link.title || link.url,
        relevanceScore: this.calculateRelevanceScore(link, query),
        metadata: {
          url: link.url,
          title: link.title,
          type: "link",
        },
      }));
    } catch (error) {
      console.error("Error getting link context:", error);
      return [];
    }
  }

  private calculateRelevanceScore(link: ExternalLink, query: string): number {
    const queryTerms = query
      .toLowerCase()
      .split(" ")
      .filter((term) => term.length > 2);
    const searchText = `${link.title || ""} ${
      link.content || ""
    }`.toLowerCase();

    let score = 0;
    for (const term of queryTerms) {
      if (searchText.includes(term)) {
        score += 1;
      }
    }

    return score / queryTerms.length;
  }
}

// Memory context provider (for conversation history)
class MemoryContextProvider implements IContextProvider {
  id = "memory";
  name = "Conversation Memory";
  type = "memory" as const;
  enabled = true;

  async getContext(
    query: string,
    userId: string,
    limit: number = 3
  ): Promise<ContextChunk[]> {
    try {
      // This would integrate with conversation history or external memory systems
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      console.error("Error getting memory context:", error);
      return [];
    }
  }
}

// Main MCP Server class
export class MCPServer {
  private providers: Map<string, IContextProvider> = new Map();
  private static instance: MCPServer;

  constructor() {
    // Initialize default providers
    this.registerProvider(new DocumentContextProvider());
    this.registerProvider(new LinkContextProvider());
    this.registerProvider(new MemoryContextProvider());
  }

  static getInstance(): MCPServer {
    if (!MCPServer.instance) {
      MCPServer.instance = new MCPServer();
    }
    return MCPServer.instance;
  }

  /**
   * Register a new context provider
   */
  registerProvider(provider: IContextProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Unregister a context provider
   */
  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId);
  }

  /**
   * Get all registered providers
   */
  getProviders(): ContextProvider[] {
    return Array.from(this.providers.values()).map((provider) => ({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      enabled: provider.enabled,
    }));
  }

  /**
   * Enable/disable a provider
   */
  setProviderEnabled(providerId: string, enabled: boolean): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.enabled = enabled;
    }
  }

  /**
   * Get context from all enabled providers
   */
  async getContext(
    query: string,
    userId: string,
    options: {
      maxChunks?: number;
      providers?: string[];
      minRelevanceScore?: number;
    } = {}
  ): Promise<ApiResponse<ContextChunk[]>> {
    try {
      const {
        maxChunks = 10,
        providers: requestedProviders,
        minRelevanceScore = 0.1,
      } = options;

      const contextChunks: ContextChunk[] = [];
      const enabledProviders = Array.from(this.providers.values())
        .filter((provider) => provider.enabled)
        .filter(
          (provider) =>
            !requestedProviders || requestedProviders.includes(provider.id)
        );

      // Get context from each enabled provider
      for (const provider of enabledProviders) {
        try {
          const chunks = await provider.getContext(
            query,
            userId,
            Math.ceil(maxChunks / enabledProviders.length)
          );
          contextChunks.push(...chunks);
        } catch (error) {
          console.error(
            `Error getting context from provider ${provider.id}:`,
            error
          );
        }
      }

      // Filter by relevance score and sort
      const filteredChunks = contextChunks
        .filter((chunk) => chunk.relevanceScore >= minRelevanceScore)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxChunks);

      return {
        success: true,
        data: filteredChunks,
        message: `Retrieved ${filteredChunks.length} context chunks from ${enabledProviders.length} providers`,
      };
    } catch (error) {
      console.error("Error getting context:", error);
      return {
        success: false,
        error: "Failed to retrieve context",
      };
    }
  }

  /**
   * Get context summary for display
   */
  getContextSummary(chunks: ContextChunk[]): string {
    if (chunks.length === 0) {
      return "No relevant context found.";
    }

    const sources = chunks
      .map((chunk) => chunk.source)
      .filter((source, index, arr) => arr.indexOf(source) === index);
    return `Found ${chunks.length} relevant context chunks from ${
      sources.length
    } sources: ${sources.slice(0, 3).join(", ")}${
      sources.length > 3 ? "..." : ""
    }`;
  }

  /**
   * Format context for LLM consumption
   */
  formatContextForLLM(chunks: ContextChunk[]): string {
    if (chunks.length === 0) {
      return "";
    }

    const contextText = chunks
      .map(
        (chunk, index) =>
          `[Context ${index + 1}] ${chunk.source}:\n${chunk.content}`
      )
      .join("\n\n");

    return `Here is relevant context from the knowledge base:\n\n${contextText}\n\nPlease use this context to help answer the user's question.`;
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<{ [providerId: string]: boolean }> {
    const health: { [providerId: string]: boolean } = {};

    for (const [id, provider] of this.providers) {
      try {
        // Simple test query
        await provider.getContext("test", "test-user", 1);
        health[id] = true;
      } catch (error) {
        console.error(`Health check failed for provider ${id}:`, error);
        health[id] = false;
      }
    }

    return health;
  }
}

// Export singleton instance
export const mcpServer = MCPServer.getInstance();

// Export types and classes
export {
  DocumentContextProvider,
  LinkContextProvider,
  MemoryContextProvider,
  MCPServer as default,
};

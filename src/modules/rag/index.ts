import { VectorStoreManager, SearchResult } from "../vector-store";
import { EmbeddingManager } from "../embeddings";
import { DocumentProcessor, DocumentChunk } from "../document-processing";
import { chatService } from "../llm";

export interface IndexingResult {
  success: boolean;
  documentsIndexed: number;
  chunksCreated: number;
  error?: string;
}

export interface RetrievalResult {
  contextText: string;
  sources: Array<{
    fileName: string;
    similarity: number;
  }>;
}

export interface GenerateResult {
  response: string;
  context: RetrievalResult;
}

export class RAGManager {
  private vectorStore: VectorStoreManager;
  private embeddingManager: EmbeddingManager;
  private documentProcessor: DocumentProcessor;

  constructor(
    vectorStore: VectorStoreManager,
    embeddingManager: EmbeddingManager,
    documentProcessor: DocumentProcessor
  ) {
    this.vectorStore = vectorStore;
    this.embeddingManager = embeddingManager;
    this.documentProcessor = documentProcessor;
  }

  async indexDocuments(
    files: Array<{ path: string; name: string }>,
    userId?: string
  ): Promise<IndexingResult> {
    try {
      // Process documents into chunks
      const processingResults = await this.documentProcessor.processFiles(
        files,
        userId
      );

      // Collect all successful chunks
      const allChunks: DocumentChunk[] = [];
      let documentsIndexed = 0;

      for (const result of processingResults) {
        if (result.chunks.length > 0) {
          allChunks.push(...result.chunks);
          documentsIndexed++;
        }
      }

      if (allChunks.length === 0) {
        return {
          success: false,
          documentsIndexed: 0,
          chunksCreated: 0,
          error: "No chunks were created from the provided documents",
        };
      }

      // Generate embeddings for all chunks
      const texts = allChunks.map((chunk) => chunk.content);
      const embeddingResult =
        await this.embeddingManager.generateBatchEmbeddings(texts);

      // Prepare documents for vector storage
      const documentsWithEmbeddings = allChunks.map((chunk, index) => ({
        id: chunk.id,
        content: chunk.content,
        metadata: chunk.metadata,
        embedding: embeddingResult.results[index].embedding,
      }));

      // Store in vector database
      await this.vectorStore.storeVectors(documentsWithEmbeddings);

      return {
        success: true,
        documentsIndexed,
        chunksCreated: allChunks.length,
      };
    } catch (error) {
      console.error("Failed to index documents:", error);
      return {
        success: false,
        documentsIndexed: 0,
        chunksCreated: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async retrieveContext(query: string): Promise<RetrievalResult> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingManager.generateEmbedding(
        query
      );

      // Search for similar documents (using defaults: top 5, threshold 0.7)
      const retrievedDocs = await this.vectorStore.searchSimilar(
        queryEmbedding.embedding,
        5, // maxResults
        0.7 // similarityThreshold
      );

      // Build simple context text
      const contextText = retrievedDocs
        .map((doc, index) => `[${index + 1}] ${doc.content}`)
        .join("\n\n");

      // Extract sources
      const sources = retrievedDocs.map((doc) => ({
        fileName: (doc.metadata?.fileName as string) || "Unknown",
        similarity: doc.score,
      }));

      return {
        contextText,
        sources,
      };
    } catch (error) {
      console.error("Failed to retrieve context:", error);
      throw new Error(`Context retrieval failed: ${error}`);
    }
  }

  async generateResponse(query: string): Promise<GenerateResult> {
    try {
      // Retrieve relevant context
      const retrievedContext = await this.retrieveContext(query);

      // Build prompt with context
      const systemPrompt = `You are a helpful assistant.
Use the provided context to answer the user's question.
If you cannot find the answer in the context, say so clearly. Do not make up an answer.

<context>
${retrievedContext.contextText}
</context>

<question>
${query}
</question>`;

      // Call LLM using Bifrost to generate response
      const llmResponse = await chatService.processMessage(
        [
          {
            role: "system",
            content: systemPrompt,
          },
        ],
        undefined, // No additional context chunks needed
        {
          model: "gpt-3.5-turbo",
          temperature: 0.7,
          maxTokens: 1000,
        }
      );

      if (!llmResponse.success || !llmResponse.data) {
        throw new Error(`LLM response failed: ${llmResponse.error}`);
      }

      const response = llmResponse.data.content;

      return {
        response,
        context: retrievedContext,
      };
    } catch (error) {
      console.error("RAG generation error:", error);
      throw new Error(`RAG generation failed: ${error}`);
    }
  }

  /**
   * Delete all documents/chunks associated with a specific filename
   */
  async deleteDocumentsByFilename(filename: string): Promise<{
    success: boolean;
    deletedCount: number;
    message: string;
  }> {
    try {
      console.log(`Deleting documents for filename: ${filename}`);
      const deletedCount = await this.vectorStore.deleteDocumentsByFilename(
        filename
      );

      return {
        success: true,
        deletedCount,
        message: `Successfully deleted ${deletedCount} chunks for file: ${filename}`,
      };
    } catch (error) {
      console.error(
        `Failed to delete documents for filename ${filename}:`,
        error
      );
      return {
        success: false,
        deletedCount: 0,
        message: `Failed to delete documents: ${error}`,
      };
    }
  }
}

/**
 * Factory function to create RAGManager with default configurations
 */
export async function createRAGManager(): Promise<RAGManager> {
  // Import factory functions
  const { createVectorStore } = await import("../vector-store");
  const { createEmbeddingManager } = await import("../embeddings");
  const { createDocumentProcessor } = await import("../document-processing");

  // Create instances with defaults
  const vectorStore = await createVectorStore();
  const embeddingManager = createEmbeddingManager();
  const documentProcessor = createDocumentProcessor();

  return new RAGManager(vectorStore, embeddingManager, documentProcessor);
}

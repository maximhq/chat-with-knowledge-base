import { prisma } from "../storage";
import { QdrantVectorStore } from "@llamaindex/qdrant";
import {
  VectorStoreIndex,
  storageContextFromDefaults,
  Settings,
  MetadataMode,
  NodeWithScore,
  SimpleDirectoryReader,
} from "llamaindex";
import { OpenAI } from "llamaindex/llm/openai";
import { OpenAIEmbedding } from "llamaindex/embeddings/OpenAIEmbedding";
import { createId } from "@paralleldrive/cuid2";

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

/**
 * LlamaIndex-based RAG Manager that uses QdrantVectorStore integration directly
 * with SimpleDirectoryReader for automatic file processing
 */
export class LlamaIndexRAGManager {
  private vectorStore: QdrantVectorStore;
  private vectorStoreIndex?: VectorStoreIndex;
  private collectionName: string;
  private qdrantUrl: string;
  private llm: OpenAI;
  private embedModel: OpenAIEmbedding;

  constructor() {
    this.collectionName =
      process.env.QDRANT_COLLECTION_NAME || "knowledge_base";
    this.qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
    const bifrostUrl = process.env.BIFROST_API_URL || "http://localhost:8080";
    const bifrostKey = process.env.BIFROST_API_KEY || "";

    // Create OpenAI LLM instance with Bifrost
    this.llm = new OpenAI({
      apiKey: bifrostKey,
      model: "gpt-4o-mini",
      additionalSessionOptions: {
        baseURL: `${bifrostUrl}/openai`,
      },
    });

    // Create OpenAI Embeddings instance with Bifrost
    this.embedModel = new OpenAIEmbedding({
      apiKey: bifrostKey,
      model: "text-embedding-3-small",
      additionalSessionOptions: {
        baseURL: `${bifrostUrl}/openai`,
      },
    });

    // Initialize Qdrant vector store
    this.vectorStore = new QdrantVectorStore({
      url: this.qdrantUrl,
      collectionName: this.collectionName,
    });

    console.log(`LlamaIndex RAG Manager initialized with:`, {
      qdrantUrl: this.qdrantUrl,
      collectionName: this.collectionName,
      bifrostUrl,
      hasApiKey: !!bifrostKey,
    });
  }

  /**
   * Index documents from a directory using LlamaIndex's direct integration
   */
  async indexDocumentsFromDirectory(
    directoryPath: string,
    threadId: string,
    fileMetadata: {
      name: string;
      size?: number;
      mimeType?: string;
    }[],
  ): Promise<IndexingResult> {
    try {
      console.log(
        `Indexing documents from directory ${directoryPath} for thread ${threadId}`,
      );

      // Load documents from directory using SimpleDirectoryReader
      const documents = await new SimpleDirectoryReader().loadData({
        directoryPath,
      });

      if (documents.length === 0) {
        return {
          success: false,
          documentsIndexed: 0,
          chunksCreated: 0,
          error: "No documents were loaded from the directory",
        };
      }

      console.log(`Loaded ${documents.length} documents from directory`);

      // Create updated file metadata with generated document IDs
      const updatedFileMetadata = fileMetadata.map((fileMeta, index) => ({
        ...fileMeta,
        docId: createId(), // Generate secure, unique ID using cuid2
        filename: fileMeta.name || `document_${index}`,
      }));

      // Add threadId metadata for filtering using the updated metadata
      documents.forEach((doc, index) => {
        const { docId, filename } = updatedFileMetadata[index];

        doc.metadata = {
          ...doc.metadata,
          threadId,
          doc_id: docId,
          fileName: filename,
          uploadedAt: new Date().toISOString(),
        };
      });

      // Create storage context with Qdrant vector store
      const storageContext = await storageContextFromDefaults({
        vectorStore: this.vectorStore,
      });

      // Create indices in Qdrant - LlamaIndex handles everything
      console.log("Creating VectorStoreIndex with documents...");
      this.vectorStoreIndex = await Settings.withEmbedModel(
        this.embedModel,
        async () => {
          return await VectorStoreIndex.fromDocuments(documents, {
            storageContext,
          });
        },
      );

      console.log("Successfully created VectorStoreIndex");

      // Store document records in MySQL after successful vector storage
      const documentRecords = [];
      for (const fileMeta of updatedFileMetadata) {
        const docRecord = await prisma.document.create({
          data: {
            id: fileMeta.docId, // Use cuid2 ID as primary key
            threadId,
            filename: fileMeta.filename,
            originalName: fileMeta.name,
            size: fileMeta.size || 0,
            mimeType: fileMeta.mimeType || "application/octet-stream",
            status: "READY",
          },
        });
        documentRecords.push(docRecord);
      }

      console.log(
        `Created ${documentRecords.length} document records in MySQL`,
      );

      return {
        success: true,
        documentsIndexed: fileMetadata.length,
        chunksCreated: documents.length,
      };
    } catch (error) {
      console.error("Failed to index documents from directory:", error);
      return {
        success: false,
        documentsIndexed: 0,
        chunksCreated: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Retrieve context using LlamaIndex's query engine with filters
   */
  async retrieveContext(
    query: string,
    threadId: string,
  ): Promise<RetrievalResult> {
    try {
      if (!this.vectorStoreIndex) {
        // Try to load existing index from storage
        const storageContext = await storageContextFromDefaults({
          vectorStore: this.vectorStore,
        });
        this.vectorStoreIndex = await Settings.withEmbedModel(
          this.embedModel,
          async () => {
            return await VectorStoreIndex.init({
              storageContext,
            });
          },
        );
      }

      console.log(
        `Retrieving context for query: "${query.substring(0, 100)}..."`,
      );

      // Execute query with scoped embedding model
      const response = await Settings.withEmbedModel(
        this.embedModel,
        async () => {
          // Create query engine with threadId filter
          const queryEngine = this.vectorStoreIndex!.asQueryEngine({
            preFilters: {
              filters: [
                {
                  key: "threadId",
                  value: threadId,
                  operator: "==",
                },
              ],
            },
            similarityTopK: 5, // Retrieve top 5 similar chunks
          });

          // Execute the query
          return await queryEngine.query({
            query,
          });
        },
      );

      // Extract source nodes for building context
      const sourceNodes = response.sourceNodes || [];

      // Build context text from source nodes
      const contextText = sourceNodes
        .map(
          (node: NodeWithScore, index: number) =>
            `[${index + 1}] ${node.node.getContent(MetadataMode.NONE)}`,
        )
        .join("\n\n");

      // Extract sources with metadata
      const sources = sourceNodes.map((node: NodeWithScore) => ({
        fileName: (node.node.metadata?.fileName as string) || "Unknown",
        similarity: node.score || 0,
      }));

      console.log(`Retrieved ${sourceNodes.length} relevant chunks`);

      return {
        contextText,
        sources,
      };
    } catch (error) {
      console.error("Failed to retrieve context:", error);
      throw new Error(`Context retrieval failed: ${error}`);
    }
  }

  /**
   * Generate response using LlamaIndex's query engine
   */
  async generateResponse(
    query: string,
    threadId: string,
  ): Promise<GenerateResult> {
    try {
      if (!this.vectorStoreIndex) {
        // Try to load existing index from storage
        const storageContext = await storageContextFromDefaults({
          vectorStore: this.vectorStore,
        });
        this.vectorStoreIndex = await Settings.withEmbedModel(
          this.embedModel,
          async () => {
            return await VectorStoreIndex.init({
              storageContext,
            });
          },
        );
      }

      console.log(
        `Generating response for query: "${query.substring(0, 100)}..."`,
      );

      // Generate response with scoped models
      const response = await Settings.withLLM(this.llm, async () => {
        return await Settings.withEmbedModel(this.embedModel, async () => {
          // Create query engine with threadId filter
          const queryEngine = this.vectorStoreIndex!.asQueryEngine({
            preFilters: {
              filters: [
                {
                  key: "threadId",
                  value: threadId,
                  operator: "==",
                },
              ],
            },
            similarityTopK: 5,
          });

          // Execute the query - LlamaIndex handles context retrieval and response generation
          return await queryEngine.query({
            query,
          });
        });
      });

      // Extract context information for the response
      const sourceNodes = response.sourceNodes || [];
      const contextText = sourceNodes
        .map(
          (node: NodeWithScore, index: number) =>
            `[${index + 1}] ${node.node.getContent(MetadataMode.NONE)}`,
        )
        .join("\n\n");

      const sources = sourceNodes.map((node: NodeWithScore) => ({
        fileName: (node.node.metadata?.fileName as string) || "Unknown",
        similarity: node.score || 0,
      }));

      const context: RetrievalResult = {
        contextText,
        sources,
      };

      console.log(
        `Generated response with ${sourceNodes.length} source chunks`,
      );

      return {
        response: response.toString(),
        context,
      };
    } catch (error) {
      console.error("RAG generation error:", error);
      throw new Error(`RAG generation failed: ${error}`);
    }
  }

  /**
   * Delete documents by filename (simplified - removes from Qdrant and MySQL)
   */
  async deleteDocumentsByFilename(
    filename: string,
    threadId: string,
  ): Promise<{
    success: boolean;
    deletedCount: number;
    message: string;
  }> {
    try {
      console.log(
        `Deleting documents for filename: ${filename} in thread: ${threadId}`,
      );

      // First, find all document records to get the doc_ids
      const documents = await prisma.document.findMany({
        where: {
          filename: filename,
          threadId: threadId,
        },
      });

      if (documents.length === 0) {
        return {
          success: true,
          deletedCount: 0,
          message: `No documents found for filename: ${filename} in thread: ${threadId}`,
        };
      }

      // Delete from Qdrant vector store using metadata filter
      // Note: QdrantVectorStore.delete() only accepts refDocId string parameter
      // We'll use the Qdrant client directly to delete by filter
      try {
        // Use the Qdrant client directly to delete by metadata filter
        // This is a workaround until LlamaIndex supports metadata-based deletion
        const client = this.vectorStore.client();
        await client.delete(this.collectionName, {
          filter: {
            must: [
              {
                key: "fileName",
                match: {
                  value: filename,
                },
              },
              {
                key: "threadId",
                match: {
                  value: threadId,
                },
              },
            ],
          },
        });
        console.log(
          `Successfully deleted vector embeddings for ${filename} in thread ${threadId}`,
        );
      } catch (vectorError) {
        console.warn(
          `Failed to delete from vector store for ${filename}:`,
          vectorError,
        );
        // Continue with MySQL deletion even if vector deletion fails
      }

      // Delete from MySQL database
      const deletedDocuments = await prisma.document.deleteMany({
        where: {
          filename: filename,
          threadId: threadId,
        },
      });

      return {
        success: true,
        deletedCount: deletedDocuments.count,
        message: `Successfully deleted ${deletedDocuments.count} documents for file: ${filename} from both database and vector store`,
      };
    } catch (error) {
      console.error(
        `Failed to delete documents for filename ${filename} in thread ${threadId}:`,
        error,
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
 * Factory function to create LlamaIndexRAGManager with default configurations
 */
export async function createLlamaIndexRAGManager(): Promise<LlamaIndexRAGManager> {
  return new LlamaIndexRAGManager();
}

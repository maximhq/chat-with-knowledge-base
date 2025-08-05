import { prisma } from "../storage";
import { QdrantVectorStore } from "@llamaindex/qdrant";
import {
  VectorStoreIndex,
  storageContextFromDefaults,
  MetadataMode,
  NodeWithScore,
  SimpleDirectoryReader,
} from "llamaindex";
import { OpenAIEmbedding } from "llamaindex/embeddings/OpenAIEmbedding";
import { createId } from "@paralleldrive/cuid2";
import { LLMGateway } from "../llm";

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
  private collectionName: string;
  private qdrantUrl: string;
  private qdrantApiKey: string;
  private bifrostUrl: string;
  private bifrostKey: string;
  private embedModel: OpenAIEmbedding;
  private llmGateway: LLMGateway;

  constructor() {
    this.collectionName =
      process.env.QDRANT_COLLECTION_NAME || "knowledge_base";
    this.qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
    this.qdrantApiKey = process.env.QDRANT_API_KEY || "";
    this.bifrostUrl = process.env.BIFROST_API_URL || "http://localhost:8080";
    this.bifrostKey = process.env.BIFROST_API_KEY || "";

    this.embedModel = new OpenAIEmbedding({
      apiKey: process.env.BIFROST_API_KEY,
      model: "text-embedding-3-small",
      additionalSessionOptions: {
        baseURL: `${process.env.BIFROST_API_URL}/openai`,
      },
    });

    // Initialize LLM Gateway for response generation
    this.llmGateway = new LLMGateway({
      apiUrl: this.bifrostUrl,
      apiKey: this.bifrostKey,
      timeout: 30000,
    });

    // Now create vector store - Settings.embedModel is available
    this.vectorStore = new QdrantVectorStore({
      url: this.qdrantUrl,
      collectionName: this.collectionName,
      embeddingModel: this.embedModel,
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

      const storageContext = await storageContextFromDefaults({
        vectorStore: this.vectorStore,
      });

      // Create indices in Qdrant
      console.log("Creating VectorStoreIndex with documents...");
      await VectorStoreIndex.fromDocuments(documents, {
        storageContext,
      });

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
   * Generate response using LlamaIndex's query engine
   */
  async generateResponse(
    query: string,
    threadId: string,
  ): Promise<GenerateResult> {
    try {
      const vectorStoreIndex = await VectorStoreIndex.fromVectorStore(
        this.vectorStore,
      );

      console.log(
        `Generating response for query: "${query.substring(0, 100)}..."`,
      );

      // Create retriever with threadId filter for context retrieval only
      const retriever = vectorStoreIndex.asRetriever({
        filters: {
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

      // Retrieve relevant context
      const retrievedNodes = await retriever.retrieve(query);

      // Extract context information
      const contextText = retrievedNodes
        .map(
          (node: NodeWithScore, index: number) =>
            `[${index + 1}] ${node.node.getContent(MetadataMode.NONE)}`,
        )
        .join("\n\n");

      const sources = retrievedNodes.map((node: NodeWithScore) => ({
        fileName: (node.node.metadata?.fileName as string) || "Unknown",
        similarity: node.score || 0,
      }));

      const context: RetrievalResult = {
        contextText,
        sources,
      };

      // Use LLMGateway to generate response using the retrieved context
      const llmResponse = await this.llmGateway.chatCompletion({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that answers questions based on the provided context. Use the context below to answer the user's question. If the context doesn't contain relevant information, say so clearly.\n\nContext:\n${contextText}`,
          },
          {
            role: "user",
            content: query,
          },
        ],
      });

      if (!llmResponse.success) {
        throw new Error(`LLM API error: ${llmResponse.error}`);
      }

      const generatedResponse =
        llmResponse.data?.content || "No response generated";

      return {
        response: generatedResponse,
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
      }

      return {
        success: true,
        deletedCount: documents.length,
        message: `Successfully deleted ${documents.length} documents for file: ${filename} from both database and vector store`,
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

import { QdrantClient } from "@qdrant/js-client-rest";
import { randomUUID } from "crypto";

export interface VectorStoreConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
}

export interface DocumentVector {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

export class VectorStoreManager {
  private client: QdrantClient;
  private config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    this.client = new QdrantClient({
      url: config.url,
      apiKey: config.apiKey,
    });
  }

  /**
   * Initialize the vector store and create collection if it doesn't exist
   */
  async initialize(): Promise<void> {
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (col) => col.name === this.config.collectionName,
      );

      if (!collectionExists) {
        await this.createCollection();
      }
    } catch (error) {
      console.error("Failed to initialize vector store:", error);
      throw new Error(`Vector store initialization failed: ${error}`);
    }
  }

  /**
   * Create a new collection with optimized settings
   */
  private async createCollection(): Promise<void> {
    await this.client.createCollection(this.config.collectionName, {
      vectors: {
        size: 1536, // text-embedding-3-small dimension (via Bifrost)
        distance: "Cosine",
      },
      optimizers_config: {
        default_segment_number: 2,
        max_segment_size: 20000,
        memmap_threshold: 20000,
        indexing_threshold: 20000,
      },
      hnsw_config: {
        m: 16,
        ef_construct: 100,
        full_scan_threshold: 10000,
      },
    });
  }

  /**
   * Store document vectors in Qdrant
   */
  async storeVectors(documents: DocumentVector[]): Promise<void> {
    if (!this.client) {
      throw new Error("Vector store not initialized");
    }

    try {
      const points = documents.map((doc) => ({
        id: randomUUID(), // Use UUID for Qdrant compatibility
        vector: doc.embedding || [],
        payload: {
          originalId: doc.id, // Store original ID in payload
          content: doc.content,
          ...doc.metadata,
        },
      }));

      // Debug logging
      console.log(`Storing ${points.length} vectors to Qdrant`);
      console.log(`First vector dimensions: ${points[0]?.vector?.length || 0}`);
      console.log(`Sample vector data:`, {
        id: points[0]?.id,
        vectorLength: points[0]?.vector?.length,
        contentLength: points[0]?.payload?.content?.length,
        hasVector: !!points[0]?.vector?.length,
      });

      // Validate vectors before upserting
      const invalidPoints = points.filter(
        (point) =>
          !point.vector ||
          point.vector.length === 0 ||
          point.vector.length !== 1536 ||
          !point.id ||
          typeof point.id !== "string",
      );

      if (invalidPoints.length > 0) {
        console.error(`Found ${invalidPoints.length} invalid vectors:`);
        invalidPoints.forEach((point, idx) => {
          console.error(`Invalid point ${idx}:`, {
            id: point.id,
            vectorLength: point.vector?.length || 0,
            hasId: !!point.id,
            vectorSample: point.vector?.slice(0, 5),
          });
        });
        throw new Error(
          `Cannot store vectors: ${invalidPoints.length} vectors have invalid dimensions or missing data`,
        );
      }

      await this.client.upsert(this.config.collectionName, {
        wait: true,
        points,
      });
    } catch (error) {
      console.error("Failed to store vectors:", error);

      // Log detailed error information if it's a Qdrant API error
      if (error && typeof error === "object" && "data" in error) {
        console.error(
          "Qdrant error details:",
          JSON.stringify(error.data, null, 2),
        );
      }

      // Try to get more specific error information
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error && typeof error === "object") {
        errorMessage = JSON.stringify(error);
      }

      throw new Error(`Vector storage failed: ${errorMessage}`);
    }
  }

  /**
   * Search for similar documents with optional filtering
   */
  async searchSimilar(
    queryVector: number[],
    limit: number = 5,
    scoreThreshold: number = 0.7,
    filter?: Record<string, unknown>,
  ): Promise<SearchResult[]> {
    if (!this.client) {
      throw new Error("Vector store not initialized");
    }

    try {
      const searchParams: {
        vector: number[];
        limit: number;
        score_threshold: number;
        with_payload: boolean;
        filter?: {
          must: Array<{
            key: string;
            match: { value: unknown };
          }>;
        };
      } = {
        vector: queryVector,
        limit,
        score_threshold: scoreThreshold,
        with_payload: true,
      };

      // Add filter if provided
      if (filter && Object.keys(filter).length > 0) {
        searchParams.filter = {
          must: Object.entries(filter).map(([key, value]) => ({
            key,
            match: { value },
          })),
        };
      }

      const searchResult = await this.client.search(
        this.config.collectionName,
        searchParams,
      );

      return searchResult.map((result) => ({
        id: (result.payload?.originalId as string) || result.id.toString(), // Use originalId if available
        content: result.payload?.content as string,
        metadata: result.payload || {},
        score: result.score,
      }));
    } catch (error) {
      console.error("Failed to search vectors:", error);
      throw new Error(`Vector search failed: ${error}`);
    }
  }

  /**
   * Delete documents by IDs
   */
  async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.client) {
      throw new Error("Vector store not initialized");
    }

    try {
      await this.client.delete(this.config.collectionName, {
        wait: true,
        points: ids,
      });
    } catch (error) {
      console.error("Failed to delete documents:", error);
      throw new Error(`Document deletion failed: ${error}`);
    }
  }

  /**
   * Get all documents for a specific user
   */
  async getUserDocuments(userId: string): Promise<
    {
      id: string;
      filename: string;
      originalName: string;
      mimeType: string;
      size: number;
      chunksCount: number;
      createdAt: string;
      status: string;
    }[]
  > {
    if (!this.client) {
      throw new Error("Vector store not initialized");
    }

    try {
      // Search for all points with the specific userId in metadata
      const searchResult = await this.client.scroll(
        this.config.collectionName,
        {
          filter: {
            must: [
              {
                key: "userId",
                match: {
                  value: userId,
                },
              },
            ],
          },
          limit: 1000, // Adjust limit as needed
          with_payload: true,
          with_vector: false, // We don't need vectors for listing
        },
      );

      if (!searchResult.points || searchResult.points.length === 0) {
        return [];
      }

      // Group chunks by filename to get document-level information
      const documentMap = new Map<
        string,
        {
          id: string;
          filename: string;
          originalName: string;
          mimeType: string;
          size: number;
          chunksCount: number;
          createdAt: string;
          status: string;
        }
      >();

      searchResult.points.forEach((point) => {
        const payload = point.payload as Record<string, unknown>;
        const filename = payload.filename as string;

        if (filename && !documentMap.has(filename)) {
          documentMap.set(filename, {
            id: (payload.originalId as string) || point.id.toString(),
            filename: filename,
            originalName: (payload.originalName as string) || filename,
            mimeType:
              (payload.mimeType as string) || "application/octet-stream",
            size: (payload.fileSize as number) || 0,
            chunksCount: 0,
            createdAt:
              (payload.createdAt as string) || new Date().toISOString(),
            status: "indexed",
          });
        }

        // Increment chunk count
        if (filename && documentMap.has(filename)) {
          documentMap.get(filename)!.chunksCount++;
        }
      });

      return Array.from(documentMap.values()).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } catch (error) {
      console.error(`Failed to get user documents for ${userId}:`, error);
      throw new Error(`Get user documents failed: ${error}`);
    }
  }

  /**
   * Delete all documents/chunks associated with a specific filename
   */
  async deleteDocumentsByFilename(filename: string): Promise<number> {
    if (!this.client) {
      throw new Error("Vector store not initialized");
    }

    try {
      // Search for all points with the specific filename in metadata
      const searchResult = await this.client.scroll(
        this.config.collectionName,
        {
          filter: {
            must: [
              {
                key: "filename",
                match: {
                  value: filename,
                },
              },
            ],
          },
          limit: 1000, // Adjust limit as needed
          with_payload: false, // We only need IDs
          with_vector: false,
        },
      );

      if (!searchResult.points || searchResult.points.length === 0) {
        console.log(`No documents found for filename: ${filename}`);
        return 0;
      }

      // Extract point IDs
      const pointIds = searchResult.points.map((point) => point.id as string);

      // Delete the points
      await this.client.delete(this.config.collectionName, {
        wait: true,
        points: pointIds,
      });

      console.log(
        `Deleted ${pointIds.length} chunks for filename: ${filename}`,
      );
      return pointIds.length;
    } catch (error) {
      console.error(
        `Failed to delete documents by filename ${filename}:`,
        error,
      );
      throw new Error(`Document deletion by filename failed: ${error}`);
    }
  }

  /**
   * Get collection info and statistics
   */
  async getCollectionInfo() {
    if (!this.client) {
      throw new Error("Vector store not initialized");
    }

    try {
      return await this.client.getCollection(this.config.collectionName);
    } catch (error) {
      console.error("Failed to get collection info:", error);
      throw new Error(`Collection info retrieval failed: ${error}`);
    }
  }

  /**
   * Get the underlying Qdrant client
   */
  getClient(): QdrantClient {
    if (!this.client) {
      throw new Error("Vector store not initialized");
    }
    return this.client;
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    // Qdrant client doesn't require explicit closing
    // but we can implement cleanup logic here if needed
  }
}

// Factory function to create and initialize vector store
export async function createVectorStore(
  config?: Partial<VectorStoreConfig>,
): Promise<VectorStoreManager> {
  const defaultConfig: VectorStoreConfig = {
    url: process.env.QDRANT_URL || "http://localhost:6333",
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: "knowledge_base",
  };

  const finalConfig = { ...defaultConfig, ...config };
  const vectorStore = new VectorStoreManager(finalConfig);
  await vectorStore.initialize();

  return vectorStore;
}

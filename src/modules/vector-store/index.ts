import { QdrantClient } from "@qdrant/js-client-rest";

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
        (col) => col.name === this.config.collectionName
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
        size: 1536, // OpenAI text-embedding-3-small dimension
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
      const points = documents.map((doc, index) => ({
        id: doc.id,
        vector: doc.embedding || [],
        payload: {
          content: doc.content,
          ...doc.metadata,
        },
      }));

      await this.client.upsert(this.config.collectionName, {
        wait: true,
        points,
      });
    } catch (error) {
      console.error("Failed to store vectors:", error);
      throw new Error(`Vector storage failed: ${error}`);
    }
  }

  /**
   * Search for similar documents
   */
  async searchSimilar(
    queryVector: number[],
    limit: number = 5,
    scoreThreshold: number = 0.7
  ): Promise<SearchResult[]> {
    if (!this.client) {
      throw new Error("Vector store not initialized");
    }

    try {
      const searchResult = await this.client.search(
        this.config.collectionName,
        {
          vector: queryVector,
          limit,
          score_threshold: scoreThreshold,
          with_payload: true,
        }
      );

      return searchResult.map((result) => ({
        id: result.id.toString(),
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
        }
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
        `Deleted ${pointIds.length} chunks for filename: ${filename}`
      );
      return pointIds.length;
    } catch (error) {
      console.error(
        `Failed to delete documents by filename ${filename}:`,
        error
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
  config?: Partial<VectorStoreConfig>
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

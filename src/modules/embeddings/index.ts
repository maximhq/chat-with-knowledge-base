import { OpenAI } from "openai";

export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

export interface BatchEmbeddingResult {
  results: EmbeddingResult[];
  totalTokens: number;
  processingTime: number;
}

export class EmbeddingManager {
  private openai: OpenAI;

  constructor() {
    // Use OpenAI SDK with Bifrost's OpenAI-compatible endpoint
    this.openai = new OpenAI({
      baseURL: `${
        process.env.BIFROST_API_URL || "http://localhost:9000"
      }/openai`,
      apiKey: "dummy-api-key", // Handled by Bifrost
    });
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!text.trim()) {
      throw new Error("Text cannot be empty");
    }

    try {
      // Use OpenAI SDK with Bifrost's OpenAI-compatible endpoint
      const response = await this.openai.embeddings.create({
        input: text,
        model: "text-embedding-3-small", // Use efficient embedding model
      });

      const embedding = response.data[0]?.embedding;

      if (!embedding) {
        throw new Error("Invalid embedding response from Bifrost");
      }

      return {
        text,
        embedding,
      };
    } catch (error) {
      console.error("Failed to generate embedding:", error);
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  async generateBatchEmbeddings(
    texts: string[]
  ): Promise<BatchEmbeddingResult> {
    if (!texts.length) {
      throw new Error("No texts provided");
    }

    const startTime = Date.now();
    const results: EmbeddingResult[] = [];

    try {
      // Process all texts (LlamaIndex handles batching internally)
      for (const text of texts) {
        const result = await this.generateEmbedding(text);
        results.push(result);
      }

      const processingTime = Date.now() - startTime;
      const totalTokens = this.estimateTokenCount(texts);

      return {
        results,
        totalTokens,
        processingTime,
      };
    } catch (error) {
      console.error("Failed to generate batch embeddings:", error);
      throw new Error(`Batch embedding generation failed: ${error}`);
    }
  }

  private estimateTokenCount(texts: string[]): number {
    // Simple token estimation: ~4 characters per token
    const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
    return Math.ceil(totalChars / 4);
  }
}

export function createEmbeddingManager(): EmbeddingManager {
  return new EmbeddingManager();
}

// LLM Gateway Module - Interface with Maxim AI Bifrost via OpenAI SDK
import { OpenAI } from "openai";
import type {
  LLMRequest,
  LLMResponse,
  ContextChunk,
  ApiResponse,
} from "@/types";

export interface BifrostConfig {
  apiUrl: string;
  apiKey?: string;
  timeout: number;
  retries: number;
}

export class LLMGateway {
  private openai: OpenAI;
  private config: BifrostConfig;

  constructor(config?: Partial<BifrostConfig>) {
    this.config = {
      apiUrl: process.env.BIFROST_API_URL || "http://localhost:8080",
      apiKey: process.env.BIFROST_API_KEY, // Handled by Bifrost
      timeout: 30000, // 30 seconds
      retries: 3,
      ...config,
    };

    // Use OpenAI SDK with Bifrost's OpenAI-compatible endpoint
    this.openai = new OpenAI({
      baseURL: `${this.config.apiUrl}/openai`,
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
    });
  }

  /**
   * Send a chat completion request to Bifrost via OpenAI SDK
   */
  async chatCompletion(request: LLMRequest): Promise<ApiResponse<LLMResponse>> {
    try {
      // Convert our message format to OpenAI SDK format
      const messages = request.messages.map((msg) => ({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      }));

      // Use OpenAI SDK with Bifrost's OpenAI-compatible endpoint
      const response = await this.openai.chat.completions.create({
        model: request.model || "openai/gpt-4o",
        messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 2000,
        stream: false, // Force non-streaming for type safety
      });

      // Convert OpenAI usage format to our format
      const usage = response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined;

      return {
        success: true,
        data: {
          content: response.choices[0]?.message?.content || "",
          usage,
          model: response.model,
        },
        message: "Chat completion successful",
      };
    } catch (error) {
      console.error("LLM Gateway error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Send a streaming chat completion request using OpenAI SDK
   */
  async streamChatCompletion(
    request: LLMRequest,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      // Convert our message format to OpenAI SDK format
      const messages = request.messages.map((msg) => ({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      }));

      // Use OpenAI SDK for streaming
      const stream = await this.openai.chat.completions.create({
        model: request.model || "openai/gpt-4o",
        messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 2000,
        stream: true,
      });

      // Process the stream
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          onChunk(content);
        }
      }

      onComplete();
    } catch (error) {
      console.error("Streaming chat completion error:", error);
      onError(
        error instanceof Error ? error : new Error("Unknown streaming error")
      );
    }
  }

  /**
   * Generate embeddings for text using OpenAI SDK
   */
  async generateEmbeddings(texts: string[]): Promise<ApiResponse<number[][]>> {
    try {
      console.log(
        `Generating embeddings for ${texts.length} texts using Bifrost`
      );
      console.log(`Bifrost baseURL: ${this.openai.baseURL}`);
      console.log(`First text sample: "${texts[0]?.substring(0, 100)}..."`);

      // Use OpenAI SDK for embeddings with Bifrost-compatible model
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: texts,
      });

      console.log(`Embedding API response:`, JSON.stringify(response, null, 2));

      // Extract embeddings from response
      const embeddings = response.data.map((item) => item.embedding);

      // Validate embeddings are not all zeros
      for (let i = 0; i < embeddings.length; i++) {
        const embedding = embeddings[i];
        const isAllZeros = embedding.every((val) => val === 0);
        if (isAllZeros) {
          console.error(`Warning: Embedding ${i} is all zeros!`);
          throw new Error(
            `Generated embedding ${i} contains all zeros - this indicates an API issue`
          );
        }
      }

      console.log(
        `Successfully generated ${embeddings.length} valid embeddings`
      );

      return {
        success: true,
        data: embeddings,
        message: `Generated embeddings for ${texts.length} texts`,
      };
    } catch (error) {
      console.error("Embeddings generation error:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        baseURL: this.openai.baseURL,
        textsLength: texts.length,
      });
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate embeddings",
      };
    }
  }

  /**
   * Health check for Bifrost service using OpenAI SDK
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Use a simple models list call as health check
      await this.openai.models.list();
      return true;
    } catch (error) {
      console.error("Bifrost health check failed:", error);
      return false;
    }
  }

  /**
   * Get available models using OpenAI SDK
   */
  async getModels(): Promise<ApiResponse<string[]>> {
    try {
      // Use OpenAI SDK to get models
      const response = await this.openai.models.list();
      const models = response.data.map((model) => model.id);

      return {
        success: true,
        data: models,
        message: `Found ${models.length} available models`,
      };
    } catch (error) {
      console.error("Error fetching models:", error);
      return {
        success: false,
        error: "Failed to fetch available models",
      };
    }
  }
}

// Export singleton instances
export const llmGateway = new LLMGateway();

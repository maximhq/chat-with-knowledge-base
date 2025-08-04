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
      apiKey: process.env.BIFROST_API_KEY,
      timeout: 30000, // 30 seconds
      retries: 3,
      ...config,
    };

    // Use OpenAI SDK with Bifrost's OpenAI-compatible endpoint
    this.openai = new OpenAI({
      baseURL: `${this.config.apiUrl}/openai`,
      apiKey: "dummy-api-key", // Handled by Bifrost
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
      // For now, we only support non-streaming responses
      const response = await this.openai.chat.completions.create({
        model: request.model || "gpt-3.5-turbo",
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
   * Send a streaming chat completion request
   */
  async streamChatCompletion(
    request: LLMRequest,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const response = await this.makeRequest("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
          }),
        },
        body: JSON.stringify({
          model: request.model || "gpt-3.5-turbo",
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 2000,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Bifrost API error: ${response.status} - ${
            errorData.error || response.statusText
          }`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body reader available");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            onComplete();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);

              if (data === "[DONE]") {
                onComplete();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;
                if (content) {
                  onChunk(content);
                }
              } catch (parseError) {
                console.warn("Failed to parse streaming chunk:", parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error("Streaming error:", error);
      onError(
        error instanceof Error ? error : new Error("Unknown streaming error")
      );
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbeddings(texts: string[]): Promise<ApiResponse<number[][]>> {
    try {
      const response = await this.makeRequest("/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
          }),
        },
        body: JSON.stringify({
          model: "text-embedding-ada-002",
          input: texts,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Bifrost API error: ${response.status} - ${
            errorData.error || response.statusText
          }`
        );
      }

      const data = (await response.json()) as {
        data: Array<{
          embedding: number[];
          index: number;
          object: string;
        }>;
        model: string;
        object: string;
        usage: {
          prompt_tokens: number;
          total_tokens: number;
        };
      };
      const embeddings = data.data.map((item) => item.embedding);

      return {
        success: true,
        data: embeddings,
        message: `Generated embeddings for ${texts.length} texts`,
      };
    } catch (error) {
      console.error("Embeddings generation error:", error);
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
   * Health check for Bifrost service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest("/health", {
        method: "GET",
        headers: {
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
          }),
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Bifrost health check failed:", error);
      return false;
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<ApiResponse<string[]>> {
    try {
      const response = await this.makeRequest("/v1/models", {
        method: "GET",
        headers: {
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
          }),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = (await response.json()) as {
        data: Array<{
          id: string;
          object: string;
          created: number;
          owned_by: string;
          permission?: Array<{
            id: string;
            object: string;
            created: number;
            allow_create_engine: boolean;
            allow_sampling: boolean;
            allow_logprobs: boolean;
            allow_search_indices: boolean;
            allow_view: boolean;
            allow_fine_tuning: boolean;
            organization: string;
            group?: string;
            is_blocking: boolean;
          }>;
        }>;
        object: string;
      };
      const models = data.data?.map((model) => model.id) || [];

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

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit
  ): Promise<Response> {
    const url = `${this.config.apiUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout
        );

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");

        if (attempt < this.config.retries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("All retry attempts failed");
  }
}

// Chat service that combines LLM with context
export class ChatService {
  private llmGateway: LLMGateway;

  constructor(config?: Partial<BifrostConfig>) {
    this.llmGateway = new LLMGateway(config);
  }

  /**
   * Process chat message with context
   */
  async processMessage(
    messages: Array<{ role: string; content: string }>,
    context?: ContextChunk[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<ApiResponse<LLMResponse>> {
    try {
      // Prepare messages with context
      const processedMessages = this.prepareMessagesWithContext(
        messages,
        context
      );

      const request: LLMRequest = {
        messages: processedMessages,
        model: options?.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        stream: options?.stream,
      };

      return await this.llmGateway.chatCompletion(request);
    } catch (error) {
      console.error("Chat service error:", error);
      return {
        success: false,
        error: "Failed to process chat message",
      };
    }
  }

  /**
   * Process streaming chat message
   */
  async processStreamingMessage(
    messages: Array<{ role: string; content: string }>,
    context: ContextChunk[] | undefined,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<void> {
    try {
      const processedMessages = this.prepareMessagesWithContext(
        messages,
        context
      );

      const request: LLMRequest = {
        messages: processedMessages,
        model: options?.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        stream: true,
      };

      await this.llmGateway.streamChatCompletion(
        request,
        onChunk,
        onComplete,
        onError
      );
    } catch (error) {
      console.error("Streaming chat service error:", error);
      onError(
        error instanceof Error ? error : new Error("Unknown streaming error")
      );
    }
  }

  /**
   * Prepare messages with context injection
   */
  private prepareMessagesWithContext(
    messages: Array<{ role: string; content: string }>,
    context?: ContextChunk[]
  ): Array<{ role: string; content: string }> {
    if (!context || context.length === 0) {
      return messages;
    }

    // Format context
    const contextText = context
      .map(
        (chunk, index) =>
          `[Source ${index + 1}] ${chunk.source}:\n${chunk.content}`
      )
      .join("\n\n");

    // Add context as system message
    const systemMessage = {
      role: "system",
      content: `You are a helpful assistant with access to a knowledge base. Use the following context to help answer questions when relevant:\n\n${contextText}\n\nIf the context doesn't contain relevant information for the user's question, you can still provide a helpful response based on your general knowledge.`,
    };

    return [systemMessage, ...messages];
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return await this.llmGateway.healthCheck();
  }

  /**
   * Get available models
   */
  async getModels(): Promise<ApiResponse<string[]>> {
    return await this.llmGateway.getModels();
  }
}

// Export singleton instances
export const llmGateway = new LLMGateway();
export const chatService = new ChatService();

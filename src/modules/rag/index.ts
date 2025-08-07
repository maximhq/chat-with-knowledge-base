// Re-export from the new LlamaIndex implementation
export type {
  IndexingResult,
  RetrievalResult,
  GenerateResult,
} from "./llamaindex-rag";

export { createLlamaIndexRAGManager as createRAGManager } from "./llamaindex-rag";

// Re-export from the new LlamaIndex implementation
export type {
  IndexingResult,
  RetrievalResult,
  GenerateResult,
} from "./llamaindex-rag";

export {
  LlamaIndexRAGManager as RAGManager,
  createLlamaIndexRAGManager as createRAGManager,
} from "./llamaindex-rag";

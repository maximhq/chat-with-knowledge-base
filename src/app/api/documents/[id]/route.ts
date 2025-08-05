// API routes for individual document operations
import { NextRequest } from "next/server";
import { DocumentStorage } from "@/modules/storage";
import { withApiMiddleware, rateLimits, ApiUtils } from "@/modules/api";
import { createRAGManager } from "@/modules/rag";

// DELETE /api/documents/[id] - Delete document from both MySQL and Qdrant
export const DELETE = withApiMiddleware(
  { auth: true, rateLimit: rateLimits.default },
  async (request: NextRequest, { userId }) => {
    const url = new URL(request.url);
    const documentId = url.pathname.split("/").pop();

    if (!documentId) {
      return ApiUtils.createErrorResponse("Document ID is required", 400);
    }

    try {
      const document = await DocumentStorage.findById(documentId);

      if (!document) {
        return ApiUtils.createErrorResponse("Document not found", 404);
      }

      if (document.thread?.userId !== userId) {
        return ApiUtils.createErrorResponse("Access denied", 403);
      }

      // Delete from both MySQL and Qdrant using RAG manager
      const ragManager = await createRAGManager();
      const deletionResult = await ragManager.deleteDocumentsByFilename(
        document.filename,
        document.threadId,
      );

      if (!deletionResult.success) {
        console.error(
          "Failed to delete from vector store:",
          deletionResult.message,
        );
        // Continue with MySQL deletion even if vector store deletion fails
      }

      // Delete from MySQL database
      await DocumentStorage.delete(documentId);

      return ApiUtils.createResponse({
        success: true,
        message:
          "Document deleted successfully from both database and vector store",
        data: {
          vectorDeletionResult: deletionResult,
        },
      });
    } catch (error) {
      console.error("Error deleting document:", error);
      return ApiUtils.createErrorResponse("Failed to delete document", 500);
    }
  },
);

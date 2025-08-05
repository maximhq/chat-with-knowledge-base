import { NextRequest } from "next/server";
import { writeFile, mkdir, unlink, rmdir, readdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { ThreadStorage } from "@/modules/storage";
import { createRAGManager } from "@/modules/rag";
import { withApiMiddleware, ApiUtils } from "@/modules/api";

export const POST = withApiMiddleware(
  {
    auth: true,
  },
  async (request: NextRequest, { userId }) => {
    let tempDirectoryPath: string | null = null;

    try {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      const threadId = formData.get("threadId") as string;

      if (!file) {
        return ApiUtils.createErrorResponse("No file provided", 400);
      }

      if (!threadId) {
        return ApiUtils.createErrorResponse("Thread ID is required", 400);
      }

      // Validate thread exists and belongs to user
      const thread = await ThreadStorage.findById(threadId);
      if (!thread || thread.userId !== userId) {
        return ApiUtils.createErrorResponse(
          "Thread not found or access denied",
          403,
        );
      }

      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      if (!allowedTypes.includes(file.type)) {
        return ApiUtils.createErrorResponse("Unsupported file type", 400);
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        return ApiUtils.createErrorResponse(
          "File too large. Maximum size is 10MB",
          400,
        );
      }

      // Create unique temporary directory for this upload
      const uploadDir = process.env.UPLOAD_DIR || "uploads";
      const tempDirName = `temp_${uuidv4()}`;
      tempDirectoryPath = join(uploadDir, tempDirName);

      await mkdir(tempDirectoryPath, { recursive: true });
      console.log(`Created temporary directory: ${tempDirectoryPath}`);

      // Save file in the temporary directory with original name
      const tempFilePath = join(tempDirectoryPath, file.name);
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(tempFilePath, buffer);

      console.log(`File saved in directory: ${tempFilePath}`);

      // Index documents from directory using RAG manager
      const ragManager = await createRAGManager();
      const indexingResult = await ragManager.indexDocumentsFromDirectory(
        tempDirectoryPath,
        threadId,
        [
          {
            name: file.name,
            size: file.size,
            mimeType: file.type,
          },
        ],
      );

      // Clean up temporary directory and all files
      try {
        await unlink(tempFilePath);
        await rmdir(tempDirectoryPath);
        console.log(`Temporary directory cleaned up: ${tempDirectoryPath}`);
        tempDirectoryPath = null; // Mark as cleaned up
      } catch (cleanupError) {
        console.warn(
          `Failed to clean up temporary directory: ${tempDirectoryPath}`,
          cleanupError,
        );
      }

      if (!indexingResult.success) {
        return ApiUtils.createErrorResponse("Failed to index document", 500);
      }

      // Return success response
      return ApiUtils.createResponse({
        success: true,
        message: "Document uploaded and indexed successfully",
        data: {
          documentsIndexed: indexingResult.documentsIndexed,
          chunksCreated: indexingResult.chunksCreated,
          filename: file.name,
          size: file.size,
          mimeType: file.type,
          threadId,
        },
      });
    } catch (error) {
      console.error("Upload and indexing error:", error);

      // Clean up temporary directory if it exists
      if (tempDirectoryPath) {
        try {
          // Remove all files in directory first, then the directory
          const files = await readdir(tempDirectoryPath);
          for (const file of files) {
            await unlink(join(tempDirectoryPath, file));
          }
          await rmdir(tempDirectoryPath);
          console.log(
            `Cleaned up temporary directory after error: ${tempDirectoryPath}`,
          );
        } catch (cleanupError) {
          console.warn(
            `Failed to clean up temporary directory: ${tempDirectoryPath}`,
            cleanupError,
          );
        }
      }

      return ApiUtils.createErrorResponse("Internal server error", 500);
    }
  },
);

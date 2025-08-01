// File Upload Module - PDF, DOCX, TXT upload with validation and progress tracking
import { DocumentStorage, DocumentChunkStorage } from "@/modules/storage";
import type {
  Document,
  FileStatus,
  FileUploadProgress,
  ApiResponse,
} from "@/types";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Supported file types and their MIME types
export const SUPPORTED_FILE_TYPES = {
  "application/pdf": { ext: ".pdf", maxSize: 10 * 1024 * 1024 }, // 10MB
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: ".docx",
    maxSize: 10 * 1024 * 1024,
  }, // 10MB
  "application/msword": { ext: ".doc", maxSize: 10 * 1024 * 1024 }, // 10MB
  "text/plain": { ext: ".txt", maxSize: 5 * 1024 * 1024 }, // 5MB
  "text/markdown": { ext: ".md", maxSize: 5 * 1024 * 1024 }, // 5MB
} as const;

export class FileUploadManager {
  private static uploadDir = process.env.UPLOAD_DIR || "./uploads";

  /**
   * Initialize upload directory
   */
  static async initializeUploadDir(): Promise<void> {
    if (!existsSync(this.uploadDir)) {
      await mkdir(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Validate file before upload
   */
  static validateFile(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file type
    if (!SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES]) {
      errors.push(
        `Unsupported file type: ${file.type}. Supported types: PDF, DOCX, DOC, TXT, MD`
      );
    }

    // Check file size
    const typeConfig =
      SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES];
    if (typeConfig && file.size > typeConfig.maxSize) {
      const maxSizeMB = Math.round(typeConfig.maxSize / (1024 * 1024));
      errors.push(`File size exceeds ${maxSizeMB}MB limit`);
    }

    // Check filename
    if (!file.name || file.name.trim().length === 0) {
      errors.push("File name is required");
    }

    if (file.name.length > 255) {
      errors.push("File name is too long (max 255 characters)");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Upload and process file
   */
  static async uploadFile(
    file: File,
    userId: string,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<ApiResponse<Document>> {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(", "),
        };
      }

      // Initialize upload directory
      await this.initializeUploadDir();

      // Generate unique filename
      const fileId = uuidv4();
      const ext = path.extname(file.name);
      const filename = `${fileId}${ext}`;
      const filePath = path.join(this.uploadDir, filename);

      // Report upload start
      onProgress?.({
        filename: file.name,
        progress: 0,
        status: "uploading",
      });

      // Convert File to Buffer and save
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await writeFile(filePath, buffer);

      // Report upload complete
      onProgress?.({
        filename: file.name,
        progress: 50,
        status: "processing",
      });

      // Create document record
      const document = await DocumentStorage.create({
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        path: filePath,
        userId,
        status: "PROCESSING",
      });

      // Start background processing
      this.processFileInBackground(
        document.id,
        filePath,
        file.type,
        onProgress
      );

      return {
        success: true,
        data: document,
        message: "File uploaded successfully",
      };
    } catch (error) {
      console.error("Error uploading file:", error);
      onProgress?.({
        filename: file.name,
        progress: 0,
        status: "error",
        error: "Upload failed",
      });

      return {
        success: false,
        error: "Failed to upload file",
      };
    }
  }

  /**
   * Process file content in background
   */
  private static async processFileInBackground(
    documentId: string,
    filePath: string,
    mimeType: string,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<void> {
    try {
      // Extract text content based on file type
      const content = await this.extractTextContent(filePath, mimeType);

      if (!content) {
        await DocumentStorage.updateStatus(documentId, "ERROR");
        onProgress?.({
          filename: path.basename(filePath),
          progress: 100,
          status: "error",
          error: "Failed to extract content",
        });
        return;
      }

      // Split content into chunks
      const chunks = this.splitIntoChunks(content);

      // Create document chunks
      const chunkData = chunks.map((chunk, index) => ({
        documentId,
        content: chunk,
        embedding: JSON.stringify([]), // Placeholder for embeddings
        chunkIndex: index,
      }));

      await DocumentChunkStorage.createMany(chunkData);

      // Update document status
      await DocumentStorage.updateStatus(documentId, "READY");

      onProgress?.({
        filename: path.basename(filePath),
        progress: 100,
        status: "complete",
      });
    } catch (error) {
      console.error("Error processing file:", error);
      await DocumentStorage.updateStatus(documentId, "ERROR");

      onProgress?.({
        filename: path.basename(filePath),
        progress: 100,
        status: "error",
        error: "Processing failed",
      });
    }
  }

  /**
   * Extract text content from file
   */
  private static async extractTextContent(
    filePath: string,
    mimeType: string
  ): Promise<string | null> {
    try {
      switch (mimeType) {
        case "text/plain":
        case "text/markdown":
          const { readFile } = await import("fs/promises");
          return await readFile(filePath, "utf-8");

        case "application/pdf":
          return await this.extractPDFContent(filePath);

        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        case "application/msword":
          return await this.extractDocxContent(filePath);

        default:
          console.warn(
            `Unsupported file type for content extraction: ${mimeType}`
          );
          return null;
      }
    } catch (error) {
      console.error("Error extracting text content:", error);
      return null;
    }
  }

  /**
   * Extract content from PDF files
   */
  private static async extractPDFContent(
    filePath: string
  ): Promise<string | null> {
    try {
      // Note: In production, you'd use a library like pdf-parse or pdf2pic
      // For now, return a placeholder
      console.log("PDF content extraction not implemented yet");
      return "PDF content extraction will be implemented with pdf-parse library";
    } catch (error) {
      console.error("Error extracting PDF content:", error);
      return null;
    }
  }

  /**
   * Extract content from DOCX files
   */
  private static async extractDocxContent(
    filePath: string
  ): Promise<string | null> {
    try {
      // Note: In production, you'd use a library like mammoth or docx-parser
      // For now, return a placeholder
      console.log("DOCX content extraction not implemented yet");
      return "DOCX content extraction will be implemented with mammoth library";
    } catch (error) {
      console.error("Error extracting DOCX content:", error);
      return null;
    }
  }

  /**
   * Split content into chunks for processing
   */
  private static splitIntoChunks(
    content: string,
    chunkSize: number = 1000
  ): string[] {
    const chunks: string[] = [];
    const sentences = content
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);

    let currentChunk = "";

    for (const sentence of sentences) {
      if (
        currentChunk.length + sentence.length > chunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ". " : "") + sentence;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Get user's uploaded documents
   */
  static async getUserDocuments(
    userId: string
  ): Promise<ApiResponse<Document[]>> {
    try {
      const documents = await DocumentStorage.findByUserId(userId);

      return {
        success: true,
        data: documents,
        message: `Found ${documents.length} documents`,
      };
    } catch (error) {
      console.error("Error fetching user documents:", error);
      return {
        success: false,
        error: "Failed to fetch documents",
      };
    }
  }

  /**
   * Delete a document
   */
  static async deleteDocument(
    documentId: string,
    userId: string
  ): Promise<ApiResponse<void>> {
    try {
      const document = await DocumentStorage.findById(documentId);

      if (!document) {
        return {
          success: false,
          error: "Document not found",
        };
      }

      if (document.userId !== userId) {
        return {
          success: false,
          error: "Access denied",
        };
      }

      // Delete file from filesystem
      try {
        const { unlink } = await import("fs/promises");
        await unlink(document.path);
      } catch (error) {
        console.warn("Failed to delete file from filesystem:", error);
      }

      // Delete from database
      await DocumentStorage.delete(documentId);

      return {
        success: true,
        message: "Document deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting document:", error);
      return {
        success: false,
        error: "Failed to delete document",
      };
    }
  }

  /**
   * Get file type icon
   */
  static getFileTypeIcon(mimeType: string): string {
    switch (mimeType) {
      case "application/pdf":
        return "📄";
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      case "application/msword":
        return "📝";
      case "text/plain":
        return "📃";
      case "text/markdown":
        return "📋";
      default:
        return "📁";
    }
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

export default FileUploadManager;

import { Document, SentenceSplitter } from "llamaindex";
import { TextFileReader } from "@llamaindex/readers/text";
import { PDFReader } from "@llamaindex/readers/pdf";
import { DocxReader } from "@llamaindex/readers/docx";
import { CSVReader } from "@llamaindex/readers/csv";
import { MarkdownReader } from "@llamaindex/readers/markdown";
import { HTMLReader } from "@llamaindex/readers/html";
import { ImageReader } from "@llamaindex/readers/image";
import { SimpleDirectoryReader } from "@llamaindex/readers/directory";
import * as fs from "fs/promises";
import * as path from "path";

// File extension to reader mapping
const FILE_READERS = {
  // Text files
  txt: new TextFileReader(),
  text: new TextFileReader(),

  // Documents
  pdf: new PDFReader(),
  docx: new DocxReader(),

  // Structured data
  csv: new CSVReader(),

  // Markup
  md: new MarkdownReader(),
  markdown: new MarkdownReader(),

  // Web
  html: new HTMLReader(),
  htm: new HTMLReader(),

  // Images
  jpg: new ImageReader(),
  jpeg: new ImageReader(),
  png: new ImageReader(),
  gif: new ImageReader(),
  webp: new ImageReader(),
  bmp: new ImageReader(),
  tiff: new ImageReader(),
} as const;

type SupportedFileType = keyof typeof FILE_READERS;

// Interfaces
export interface DocumentChunk {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface ProcessingResult {
  chunks: DocumentChunk[];
  metadata: {
    fileName: string;
    fileType: string;
    totalChunks: number;
    processingTime: number;
    originalSize: number;
    error?: string;
  };
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  fileSize: number;
  fileType: string;
}

/**
 * Document processor using LlamaIndex defaults
 */
export class DocumentProcessor {
  private splitter: SentenceSplitter;

  constructor() {
    // Use LlamaIndex defaults for sentence splitting
    this.splitter = new SentenceSplitter();
  }

  /**
   * Process a single file
   */
  async processFile(
    filePath: string,
    fileName: string,
    userId?: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      const stats = await fs.stat(filePath);
      const fileType = this.getFileType(fileName);

      // Validate file type
      if (!this.isSupportedFileType(fileType)) {
        throw new Error(`Unsupported file type: ${fileType}`);
      }

      // Read file using appropriate reader
      const documents = await this.readFile(
        filePath,
        fileType as SupportedFileType
      );

      if (!documents.length) {
        throw new Error("No content extracted from file");
      }

      // Process documents into chunks
      const allChunks: DocumentChunk[] = [];

      for (const doc of documents) {
        const chunks = this.createChunks(doc, fileName, fileType, userId);
        allChunks.push(...chunks);
      }

      const processingTime = Date.now() - startTime;

      return {
        chunks: allChunks,
        metadata: {
          fileName,
          fileType,
          totalChunks: allChunks.length,
          processingTime,
          originalSize: stats.size,
        },
      };
    } catch (error) {
      console.error(`Failed to process file ${fileName}:`, error);
      return {
        chunks: [],
        metadata: {
          fileName,
          fileType: this.getFileType(fileName),
          totalChunks: 0,
          processingTime: Date.now() - startTime,
          originalSize: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Process multiple files
   */
  async processFiles(
    files: Array<{ path: string; name: string }>,
    userId?: string
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    for (const file of files) {
      const result = await this.processFile(file.path, file.name, userId);
      results.push(result);
    }

    return results;
  }

  /**
   * Process directory using SimpleDirectoryReader
   */
  async processDirectory(
    directoryPath: string,
    userId?: string
  ): Promise<ProcessingResult[]> {
    try {
      console.log(`Processing directory: ${directoryPath}`);

      const reader = new SimpleDirectoryReader();
      const documents = await reader.loadData(directoryPath);

      const results: ProcessingResult[] = [];

      for (const doc of documents) {
        const fileName =
          doc.metadata?.file_name ||
          doc.metadata?.fileName ||
          `document_${Date.now()}`;
        const fileType = this.getFileType(fileName);

        const chunks = this.createChunks(doc, fileName, fileType, userId);

        results.push({
          chunks,
          metadata: {
            fileName,
            fileType,
            totalChunks: chunks.length,
            processingTime: 0,
            originalSize: doc.getText().length,
          },
        });
      }

      console.log(`Processed ${results.length} files from directory`);
      return results;
    } catch (error) {
      console.error(`Failed to process directory ${directoryPath}:`, error);
      return [];
    }
  }

  /**
   * Validate file before processing
   */
  async validateFile(filePath: string): Promise<FileValidationResult> {
    try {
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      const fileType = this.getFileType(fileName);

      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024;
      if (stats.size > maxSize) {
        return {
          valid: false,
          error: `File size exceeds 10MB limit`,
          fileSize: stats.size,
          fileType,
        };
      }

      // Check supported file types
      if (!this.isSupportedFileType(fileType)) {
        return {
          valid: false,
          error: `Unsupported file type: ${fileType}. Supported: ${this.getSupportedTypes().join(
            ", "
          )}`,
          fileSize: stats.size,
          fileType,
        };
      }

      return {
        valid: true,
        fileSize: stats.size,
        fileType,
      };
    } catch (error) {
      return {
        valid: false,
        error: `File validation failed: ${error}`,
        fileSize: 0,
        fileType: "unknown",
      };
    }
  }

  /**
   * Get supported file types
   */
  getSupportedTypes(): string[] {
    return Object.keys(FILE_READERS);
  }

  /**
   * Read file using appropriate LlamaIndex reader
   */
  private async readFile(
    filePath: string,
    fileType: SupportedFileType
  ): Promise<Document[]> {
    const reader = FILE_READERS[fileType];
    console.log(
      `Using ${fileType.toUpperCase()} reader for ${path.basename(filePath)}`
    );
    return await reader.loadData(filePath);
  }

  /**
   * Create chunks from document
   */
  private createChunks(
    doc: Document,
    fileName: string,
    fileType: string,
    userId?: string
  ): DocumentChunk[] {
    const text = doc.getText();

    // For images and other non-text content, create single chunk
    if (this.isImageType(fileType)) {
      return [
        {
          id: this.generateChunkId(fileName, 0),
          content: text || `[${fileType.toUpperCase()} file: ${fileName}]`,
          metadata: {
            fileName,
            fileType,
            chunkIndex: 0,
            totalChunks: 1,
            uploadedAt: new Date().toISOString(),
            userId,
            contentType: "image",
            ...doc.metadata,
          },
        },
      ];
    }

    // For text-based content, use sentence splitter
    const textChunks = this.splitter.splitText(text);

    return textChunks.map((chunk, index) => ({
      id: this.generateChunkId(fileName, index),
      content: chunk.trim(),
      metadata: {
        fileName,
        fileType,
        chunkIndex: index,
        totalChunks: textChunks.length,
        uploadedAt: new Date().toISOString(),
        userId,
        contentType: "text",
        ...doc.metadata,
      },
    }));
  }

  /**
   * Check if file type is supported
   */
  private isSupportedFileType(fileType: string): fileType is SupportedFileType {
    return fileType in FILE_READERS;
  }

  /**
   * Check if file type is an image
   */
  private isImageType(fileType: string): boolean {
    const imageTypes = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff"];
    return imageTypes.includes(fileType.toLowerCase());
  }

  /**
   * Get file type from filename
   */
  private getFileType(fileName: string): string {
    const extension = path.extname(fileName).toLowerCase().slice(1);
    return extension || "unknown";
  }

  /**
   * Generate unique chunk ID
   */
  private generateChunkId(fileName: string, chunkIndex: number): string {
    const timestamp = Date.now();
    const fileHash = fileName.replace(/[^a-zA-Z0-9]/g, "_");
    return `${fileHash}_${chunkIndex}_${timestamp}`;
  }
}

// Factory function
export function createDocumentProcessor(): DocumentProcessor {
  return new DocumentProcessor();
}

// Note: Types are already exported as interfaces above

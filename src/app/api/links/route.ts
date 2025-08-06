// API routes for link management (now using Document model)
import { NextRequest } from "next/server";
import { DocumentStorage } from "@/modules/storage";
import { WebScraper } from "@/modules/scraper";
import { withApiMiddleware, ApiUtils } from "@/modules/api";
import { z } from "zod";

// Validation schema for link creation
const createLinkSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  threadId: z.string().min(1, "Thread ID is required"),
});

// GET /api/links - Get all link documents for user's threads
export const GET = withApiMiddleware(
  { auth: true },
  async (request: NextRequest, { userId }) => {
    try {
      // Get all documents of type "link" for user's threads
      const links = await DocumentStorage.findByUserId(userId!);
      const linkDocuments = links.filter((doc) => doc.type === "link");

      return ApiUtils.createResponse({
        success: true,
        data: linkDocuments,
      });
    } catch (error) {
      console.error("Error fetching links:", error);
      return ApiUtils.createErrorResponse("Failed to fetch links", 500);
    }
  }
);

// POST /api/links - Add new link with scraping and indexing
export const POST = withApiMiddleware(
  {
    auth: true,
    validation: createLinkSchema,
  },
  async (request: NextRequest, { userId, data }) => {
    try {
      const { url, threadId } = data!;

      // Validate URL format
      if (!WebScraper.isValidUrl(url)) {
        return ApiUtils.createErrorResponse("Invalid URL format", 400);
      }

      // Check if thread exists and belongs to user
      const { ThreadStorage } = await import("@/modules/storage");
      const thread = await ThreadStorage.findById(threadId);
      if (!thread || thread.userId !== userId) {
        return ApiUtils.createErrorResponse(
          "Thread not found or access denied",
          403
        );
      }

      // Scrape the URL content
      const scrapingResult = await WebScraper.scrapeUrl(url);
      if (!scrapingResult.success) {
        return ApiUtils.createErrorResponse(
          `Failed to scrape URL: ${scrapingResult.error}`,
          400
        );
      }

      const scrapedContent = scrapingResult.data!;

      // Index the scraped content using RAG manager (it will create the document record)
      try {
        const ragManager = await import("@/modules/rag").then((m) =>
          m.createRAGManager()
        );

        // Create a temporary file-like structure for indexing
        const fileMetadata = {
          name: `${scrapedContent.title}.txt`,
          size: scrapedContent.size,
          type: "txt/plain",
        };
        // Create unique temporary directory for this scraping
        const { mkdir, writeFile, rm } = await import("fs/promises");
        const { join } = await import("path");
        const { v4: uuidv4 } = await import("uuid");

        const uploadDir = process.env.UPLOAD_DIR || "uploads";
        const tempDirName = `temp_${uuidv4()}`;
        const tempDirectoryPath = join(uploadDir, tempDirName);

        await mkdir(tempDirectoryPath, { recursive: true });
        console.log(`Created temporary directory: ${tempDirectoryPath}`);

        // Save scraped content in the temporary directory
        const tempFilePath = join(tempDirectoryPath, fileMetadata.name);
        await writeFile(tempFilePath, scrapedContent.content, "utf-8");
        console.log(`Scraped content saved: ${tempFilePath}`);

        // Index the content with document type "link"
        const indexingResult = await ragManager.indexDocumentsFromDirectory(
          tempDirectoryPath,
          threadId,
          [fileMetadata],
          "link" // Specify document type as link
        );

        // Clean up temporary directory
        await rm(tempDirectoryPath, { recursive: true, force: true });

        if (!indexingResult.success) {
          console.error(
            "Failed to index scraped content:",
            indexingResult.error
          );
          return ApiUtils.createErrorResponse(
            `Failed to index link content: ${indexingResult.error}`,
            500
          );
        }
      } catch (indexingError) {
        console.error("Error during link indexing:", indexingError);
        return ApiUtils.createErrorResponse(
          "Failed to index link content",
          500
        );
      }

      return ApiUtils.createResponse(
        {
          success: true,
          data: {
            title: scrapedContent.title,
            url: url,
            size: scrapedContent.size,
            threadId,
            status: "READY",
          },
          message: "Link scraped and indexed successfully",
        },
        201
      );
    } catch (error) {
      console.error("Error creating link:", error);
      return ApiUtils.createErrorResponse("Failed to create link", 500);
    }
  }
);

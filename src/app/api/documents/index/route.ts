import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/modules/auth";
import { createRAGManager } from "@/modules/rag";
import { createDocumentProcessor } from "@/modules/document-processing";
import fs from "fs/promises";

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { filePath, fileName, threadId } = body;

    if (!filePath || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields: filePath, fileName" },
        { status: 400 }
      );
    }

    // Verify file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Initialize modules
    const ragManager = await createRAGManager();
    const documentProcessor = await createDocumentProcessor();

    // Validate file
    const validation = await documentProcessor.validateFile(filePath);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Process document
    console.log(
      `Processing document: ${fileName} for user: ${session.user.id}`
    );
    const startTime = Date.now();

    const result = await documentProcessor.processFile(
      filePath,
      fileName,
      session.user.id
    );

    const processingTime = Date.now() - startTime;

    // Index document in RAG system
    const indexResult = await ragManager.indexDocuments(
      [{ path: filePath, name: fileName }],
      session.user.id
    );

    // Check if indexing was successful
    if (!indexResult.success) {
      console.error("Document indexing failed:", indexResult.error);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to index document: ${indexResult.error}`,
          documentProcessed: true, // File was processed but indexing failed
          chunksProcessed: result.chunks.length,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documentId: `doc_${fileName}_${Date.now()}`,
      chunksProcessed: result.chunks.length,
      processingTime,
      metadata: {
        fileName,
        fileType: validation.fileType,
        fileSize: validation.fileSize,
        totalChunks: result.chunks.length,
        vectorsStored: indexResult.chunksCreated,
        threadId,
      },
    });
  } catch (error) {
    console.error("Document indexing error:", error);
    return NextResponse.json(
      { error: "Failed to index document" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json({ error: "Missing filename" }, { status: 400 });
    }

    // Initialize RAG manager and delete documents by filename
    const ragManager = await createRAGManager();
    const deleteResult = await ragManager.deleteDocumentsByFilename(filename);

    if (!deleteResult.success) {
      return NextResponse.json(
        { error: deleteResult.message },
        { status: 500 }
      );
    }

    console.log(
      `Successfully deleted ${deleteResult.deletedCount} chunks for file ${filename} by user ${session.user.id}`
    );

    return NextResponse.json({
      success: true,
      message: deleteResult.message,
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error) {
    console.error("Delete document error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}

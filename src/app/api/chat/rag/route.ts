import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/modules/auth";
import { createRAGManager } from "@/modules/rag";

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Missing query parameter" },
        { status: 400 }
      );
    }

    // Initialize RAG manager
    const ragManager = await createRAGManager();

    // Perform RAG query
    console.log(`RAG query from user ${session.user.id}: "${query}"`);
    const startTime = Date.now();

    // Use the simplified generateResponse method
    const result = await ragManager.generateResponse(query);
    const queryTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      response: result.response,
      context: result.context.contextText,
      sources: result.context.sources,
      metadata: {
        queryTime,
        totalSources: result.context.sources.length,
      },
    });
  } catch (error) {
    console.error("RAG query error:", error);
    return NextResponse.json(
      { error: "Failed to perform RAG query" },
      { status: 500 }
    );
  }
}

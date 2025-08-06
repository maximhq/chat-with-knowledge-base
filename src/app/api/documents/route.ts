import { NextRequest } from "next/server";
import { prisma } from "@/modules/storage";
import { withApiMiddleware, ApiUtils } from "@/modules/api";

export const GET = withApiMiddleware(
  { auth: true },
  async (request: NextRequest, { userId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const threadId = searchParams.get("threadId");

      if (!threadId) {
        return ApiUtils.createErrorResponse(
          "threadId parameter is required",
          400,
        );
      }

      const documents = await prisma.document.findMany({
        where: {
          threadId: threadId,
          thread: {
            userId: userId!,
          },
        },
        include: {
          thread: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const transformedDocuments = documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        size: doc.size,
        threadId: doc.threadId,
        threadTitle: doc.thread?.title,
        createdAt: doc.createdAt.toISOString(),
        status: doc.status,
      }));

      return ApiUtils.createResponse({
        success: true,
        data: transformedDocuments,
        message: `Found ${transformedDocuments.length} documents`,
      });
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      return ApiUtils.createErrorResponse("Failed to fetch documents", 500);
    }
  },
);

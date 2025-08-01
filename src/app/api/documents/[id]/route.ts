// API routes for individual document operations
import { NextRequest } from 'next/server';
import { FileUploadManager } from '@/modules/uploads';
import { withApiMiddleware, rateLimits, ApiUtils } from '@/modules/api';

// DELETE /api/documents/[id] - Delete document
export const DELETE = withApiMiddleware(
  { auth: true, rateLimit: rateLimits.default },
  async (request: NextRequest, { userId }) => {
    const url = new URL(request.url);
    const documentId = url.pathname.split('/').pop();
    
    if (!documentId) {
      return ApiUtils.createErrorResponse('Document ID is required', 400);
    }
    
    const result = await FileUploadManager.deleteDocument(documentId, userId!);
    return ApiUtils.createResponse(result);
  }
);

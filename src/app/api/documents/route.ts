// API routes for document management
import { NextRequest } from 'next/server';
import { FileUploadManager } from '@/modules/uploads';
import { withApiMiddleware, rateLimits, ApiUtils } from '@/modules/api';

// GET /api/documents - Get all documents for authenticated user
export const GET = withApiMiddleware(
  { auth: true, rateLimit: rateLimits.default },
  async (request: NextRequest, { userId }) => {
    const result = await FileUploadManager.getUserDocuments(userId!);
    return ApiUtils.createResponse(result);
  }
);

// POST /api/documents - Upload new document
export const POST = withApiMiddleware(
  { auth: true, rateLimit: rateLimits.upload },
  async (request: NextRequest, { userId }) => {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return ApiUtils.createErrorResponse('No file provided', 400);
      }

      const result = await FileUploadManager.uploadFile(file, userId!);
      return ApiUtils.createResponse(result, result.success ? 201 : 400);
    } catch (error) {
      console.error('Document upload error:', error);
      return ApiUtils.createErrorResponse('Failed to upload document', 500);
    }
  }
);

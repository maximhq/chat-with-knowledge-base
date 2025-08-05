// API routes for thread management
import { NextRequest } from "next/server";
import { withApiMiddleware, ApiUtils } from "@/modules/api";
import OpenAI from "openai";

export const POST = withApiMiddleware(
  {
    auth: false,
  },
  async (request: NextRequest) => {
    const openai = new OpenAI({
      baseURL: `http://localhost:8080/openai`,
      apiKey: "",
    });
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: ["Hello"],
      encoding_format: "float",
    });
    return ApiUtils.createResponse({
      success: true,
      data: response.data,
    });
  },
);

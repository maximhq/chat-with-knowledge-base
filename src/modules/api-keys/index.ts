import { prisma } from "../storage";
import { createHash, randomBytes } from "crypto";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";

export interface ApiKeyData {
  id: string;
  name: string;
  keyPrefix: string;
  userId: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApiKeyRequest {
  name: string;
  userId: string;
  expiresAt?: Date;
  permissions?: Record<string, unknown>;
}

export interface CreateApiKeyResponse {
  apiKey: string; // The actual key (only returned once)
  keyData: ApiKeyData;
}

export class ApiKeyManager {
  /**
   * Generate a new API key with the format: ak_[8-char-prefix]_[32-char-secret]
   */
  private static generateApiKey(): {
    key: string;
    prefix: string;
    hash: string;
  } {
    const prefix = randomBytes(4).toString("hex"); // 8 characters
    const secret = randomBytes(16).toString("hex"); // 32 characters
    const key = `ak_${prefix}_${secret}`;
    const hash = createHash("sha256").update(key).digest("hex");

    return {
      key,
      prefix: `ak_${prefix}`,
      hash,
    };
  }

  /**
   * Create a new API key for a user
   */
  static async createApiKey(
    request: CreateApiKeyRequest,
  ): Promise<CreateApiKeyResponse> {
    const { key, prefix, hash } = this.generateApiKey();

    const apiKeyRecord = await prisma.apiKey.create({
      data: {
        id: createId(),
        name: request.name,
        keyHash: hash,
        keyPrefix: prefix,
        userId: request.userId,
        isActive: true,
        expiresAt: request.expiresAt || null,
        permissions:
          request.permissions as unknown as Prisma.NullableJsonNullValueInput,
      },
    });

    return {
      apiKey: key, // Return the actual key only once
      keyData: {
        id: apiKeyRecord.id,
        name: apiKeyRecord.name,
        keyPrefix: apiKeyRecord.keyPrefix,
        userId: apiKeyRecord.userId,
        isActive: apiKeyRecord.isActive,
        lastUsedAt: apiKeyRecord.lastUsedAt,
        expiresAt: apiKeyRecord.expiresAt,
        createdAt: apiKeyRecord.createdAt,
        updatedAt: apiKeyRecord.updatedAt,
      },
    };
  }

  /**
   * Validate an API key and return user information
   */
  static async validateApiKey(
    apiKey: string,
  ): Promise<{ userId: string; keyId: string } | null> {
    if (!apiKey || !apiKey.startsWith("ak_")) {
      return null;
    }

    try {
      const hash = createHash("sha256").update(apiKey).digest("hex");

      const apiKeyRecord = await prisma.apiKey.findUnique({
        where: {
          keyHash: hash,
        },
        include: {
          user: true,
        },
      });

      if (!apiKeyRecord || !apiKeyRecord.isActive) {
        return null;
      }

      // Check expiration
      if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
        return null;
      }

      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        userId: apiKeyRecord.userId,
        keyId: apiKeyRecord.id,
      };
    } catch (error) {
      console.error("API key validation error:", error);
      return null;
    }
  }

  /**
   * List API keys for a user (without revealing the actual keys)
   */
  static async listApiKeys(userId: string): Promise<ApiKeyData[]> {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      userId: key.userId,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }));
  }

  /**
   * Revoke (deactivate) an API key
   */
  static async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    try {
      const result = await prisma.apiKey.updateMany({
        where: {
          id: keyId,
          userId, // Ensure user owns the key
        },
        data: {
          isActive: false,
        },
      });

      return result.count > 0;
    } catch (error) {
      console.error("API key revocation error:", error);
      return false;
    }
  }

  /**
   * Delete an API key permanently
   */
  static async deleteApiKey(keyId: string, userId: string): Promise<boolean> {
    try {
      const result = await prisma.apiKey.deleteMany({
        where: {
          id: keyId,
          userId, // Ensure user owns the key
        },
      });

      return result.count > 0;
    } catch (error) {
      console.error("API key deletion error:", error);
      return false;
    }
  }
}

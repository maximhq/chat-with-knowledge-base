// Storage Adapter Module - Abstracts database operations using Prisma ORM
import { PrismaClient } from "@prisma/client";
import type {
  User,
  Thread,
  Message,
  Document,
  DocumentChunk,
  ExternalLink,
  FileStatus,
} from "@/types";

// Singleton Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// User operations
export class UserStorage {
  static async findById(id: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id },
    });
  }

  static async findByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  static async create(
    data: Omit<User, "id" | "createdAt" | "updatedAt">
  ): Promise<User> {
    return await prisma.user.create({
      data,
    });
  }

  static async update(id: string, data: Partial<User>): Promise<User> {
    return await prisma.user.update({
      where: { id },
      data,
    });
  }
}

// Thread operations
export class ThreadStorage {
  static async findByUserId(userId: string): Promise<Thread[]> {
    return await prisma.thread.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1, // Only get the first message for preview
        },
      },
    });
  }

  static async findById(id: string): Promise<Thread | null> {
    return await prisma.thread.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  static async create(
    data: { title: string; userId: string }
  ): Promise<Thread> {
    return await prisma.thread.create({
      data,
    });
  }

  static async update(id: string, data: { title?: string; updatedAt?: Date }): Promise<Thread> {
    return await prisma.thread.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string): Promise<void> {
    await prisma.thread.delete({
      where: { id },
    });
  }
}

// Message operations
export class MessageStorage {
  static async findByThreadId(threadId: string): Promise<Message[]> {
    return await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
    });
  }

  static async create(
    data: Omit<Message, "id" | "createdAt">
  ): Promise<Message> {
    return await prisma.message.create({
      data,
    });
  }

  static async findById(id: string): Promise<Message | null> {
    return await prisma.message.findUnique({
      where: { id },
    });
  }

  static async delete(id: string): Promise<void> {
    await prisma.message.delete({
      where: { id },
    });
  }
}

// Document operations
export class DocumentStorage {
  static async findByUserId(userId: string): Promise<Document[]> {
    return await prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        chunks: true,
      },
    });
  }

  static async findById(id: string): Promise<Document | null> {
    return await prisma.document.findUnique({
      where: { id },
      include: {
        chunks: true,
      },
    });
  }

  static async create(
    data: {
      filename: string;
      originalName: string;
      mimeType: string;
      size: number;
      path: string;
      status: FileStatus;
      userId: string;
    }
  ): Promise<Document> {
    return await prisma.document.create({
      data,
    });
  }

  static async updateStatus(id: string, status: FileStatus): Promise<Document> {
    return await prisma.document.update({
      where: { id },
      data: { status },
    });
  }

  static async delete(id: string): Promise<void> {
    await prisma.document.delete({
      where: { id },
    });
  }
}

// Document chunk operations
export class DocumentChunkStorage {
  static async createMany(
    chunks: Omit<DocumentChunk, "id" | "createdAt">[]
  ): Promise<void> {
    await prisma.documentChunk.createMany({
      data: chunks,
    });
  }

  static async findByDocumentId(documentId: string): Promise<DocumentChunk[]> {
    return await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: "asc" },
    });
  }

  static async searchSimilar(
    embedding: string,
    limit: number = 10
  ): Promise<DocumentChunk[]> {
    // Note: This is a simplified version. In production, you'd use vector similarity search
    // with a vector database like Pinecone, Weaviate, or PostgreSQL with pgvector
    return await prisma.documentChunk.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  static async deleteByDocumentId(documentId: string): Promise<void> {
    await prisma.documentChunk.deleteMany({
      where: { documentId },
    });
  }
}

// External link operations
export class ExternalLinkStorage {
  static async findByUserId(userId: string): Promise<ExternalLink[]> {
    return await prisma.externalLink.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async create(
    data: Omit<ExternalLink, "id" | "createdAt" | "updatedAt">
  ): Promise<ExternalLink> {
    return await prisma.externalLink.create({
      data,
    });
  }

  static async update(
    id: string,
    data: Partial<ExternalLink>
  ): Promise<ExternalLink> {
    return await prisma.externalLink.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string): Promise<void> {
    await prisma.externalLink.delete({
      where: { id },
    });
  }
}

// Database utilities
export class DatabaseUtils {
  static async healthCheck(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error("Database health check failed:", error);
      return false;
    }
  }

  static async disconnect(): Promise<void> {
    await prisma.$disconnect();
  }
}

"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Link, FileText, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { FileUploadDropzone } from "./FileUploadDropzone";
import { useThreadStore } from "@/stores";

// Type definition for upload results
type UploadResult = {
  fileName: string;
  success: boolean;
  documentId?: string;
  chunksProcessed?: number;
  error?: string;
};
import type { Document } from "@/types";

export function KnowledgeBaseInterface() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const selectedThreadId = useThreadStore((state) => state.selectedThreadId!);

  useEffect(() => {
    fetchDocuments();
  }, [selectedThreadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDocuments = async () => {
    try {
      const response = await fetch(
        "/api/documents?threadId=" + selectedThreadId
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDocuments(data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    // Called when files are selected (before upload)
    console.log(`Selected ${files.length} files for upload`);
  };

  const handleUploadComplete = async (results: UploadResult[]) => {
    // Called after upload and indexing is complete
    console.log("Upload completed:", results);

    // Check if any uploads were successful
    const successfulUploads = results.filter((result) => result.success);
    if (successfulUploads.length > 0) {
      console.log(
        `${successfulUploads.length} files uploaded successfully, refreshing documents list`
      );
      toast.success(
        `${successfulUploads.length} document${
          successfulUploads.length > 1 ? "s" : ""
        } uploaded and indexed successfully!`
      );
      await fetchDocuments();
    }

    // Show error for failed uploads
    const failedUploads = results.filter((result) => !result.success);
    if (failedUploads.length > 0) {
      toast.error(
        `${failedUploads.length} document${
          failedUploads.length > 1 ? "s" : ""
        } failed to upload. Use the retry button to try again.`
      );
    }
  };

  const handleAddLink = async () => {
    if (!newLinkUrl.trim()) return;

    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newLinkUrl.trim(),
          threadId: selectedThreadId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Refresh both documents and links since they're now unified
          await fetchDocuments();
          setNewLinkUrl("");
          toast.success("Link scraped and indexed successfully");
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to add link");
      }
    } catch (error) {
      console.error("Error adding link:", error);
      toast.error("Error adding link");
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
        toast.success("Document deleted successfully");
      } else {
        toast.error("Failed to delete document");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Error deleting document");
    }
  };

  const getFileIcon = (mimeType: string) => {
    switch (mimeType) {
      case "application/pdf":
        return "📄";
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      case "application/msword":
        return "📝";
      case "text/plain":
        return "📃";
      case "text/markdown":
        return "📋";
      case "link":
        return "🔗";
      default:
        return "📁";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "READY":
        return "text-green-600 bg-green-100 dark:bg-green-900/20";
      case "PROCESSING":
        return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20";
      case "ERROR":
        return "text-red-600 bg-red-100 dark:bg-red-900/20";
      default:
        return "text-gray-600 bg-gray-100 dark:bg-gray-900/20";
    }
  };

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <div className="p-6">
          <div className="max-w-6xl mx-auto flex flex-col">
            <div className="mb-6 flex-shrink-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Knowledge Base
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Upload documents and add links to build your knowledge base for
                AI-powered conversations.
              </p>
            </div>

            <Tabs
              defaultValue="documents"
              className="flex flex-col flex-1 min-h-0"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="documents"
                  className="flex items-center space-x-2"
                >
                  <FileText className="h-4 w-4" />
                  <span>Documents</span>
                </TabsTrigger>
                <TabsTrigger
                  value="links"
                  className="flex items-center space-x-2"
                >
                  <Link className="h-4 w-4" />
                  <span>External Links</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="documents"
                className="flex flex-col flex-1 min-h-0 space-y-6"
              >
                {/* File Upload Area */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Upload className="h-5 w-5" />
                      <span>Upload Documents</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FileUploadDropzone
                      onFilesSelected={handleFileUpload}
                      onUploadComplete={handleUploadComplete}
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Supported formats: PDF, DOCX, DOC, TXT, MD (Max 10MB per
                      file)
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent
                value="links"
                className="flex flex-col flex-1 min-h-0"
              >
                <div className="space-y-6 p-1">
                  {/* Add Link */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Plus className="h-5 w-5" />
                        <span>Add External Link</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex space-x-2">
                        <Input
                          placeholder="Enter URL (e.g., https://example.com)"
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleAddLink();
                            }
                          }}
                        />
                        <Button
                          onClick={handleAddLink}
                          disabled={!newLinkUrl.trim()}
                        >
                          Add Link
                        </Button>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Add web pages, articles, or any online content to your
                        knowledge base
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

            {/* Documents List */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Uploaded Documents ({documents.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No documents uploaded yet</p>
                    <p className="text-sm mt-1">
                      Upload your first document to get started
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((document) => (
                      <div
                        key={document.id}
                        className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">
                            {getFileIcon(document.type)}
                          </span>
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {document.type === "link"
                                ? document.title.replace(".txt", "")
                                : document.title}
                            </h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                              <span>{formatFileSize(document.size)}</span>
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${getStatusColor(
                                  document.status
                                )}`}
                              >
                                {document.status}
                              </span>
                              <span>
                                {new Date(
                                  document.createdAt
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleDeleteDocument(document.id)}
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default KnowledgeBaseInterface;

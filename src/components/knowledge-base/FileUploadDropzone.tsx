"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  onUploadComplete?: (results: UploadResult[]) => void;
  threadId?: string;
  maxFiles?: number;
  maxSize?: number;
  acceptedTypes?: string[];
  autoIndex?: boolean; // Automatically index files after upload
}

interface UploadResult {
  fileName: string;
  success: boolean;
  documentId?: string;
  chunksProcessed?: number;
  error?: string;
}

export function FileUploadDropzone({
  onFilesSelected,
  onUploadComplete,
  threadId,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB
  acceptedTypes = [
    // Documents
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    // Text files
    "text/plain",
    "text/markdown",
    "text/html",
    "text/csv",
    // Images (for LlamaIndex image reader)
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "image/svg+xml",
    // Audio files
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    // Video files
    "video/mp4",
    "video/webm",
    "video/ogg",
    // Archives
    "application/zip",
    "application/gzip",
    "application/x-tar",
    // LlamaIndex specific file types
    "application/json",
    "application/msgpack",
    "application/x-msgpack",
  ],
  autoIndex = true,
}: FileUploadDropzoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setSelectedFiles((prev) =>
        [...prev, ...acceptedFiles].slice(0, maxFiles)
      );
    },
    [maxFiles]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: acceptedTypes.reduce((acc, type) => {
        acc[type] = [];
        return acc;
      }, {} as Record<string, string[]>),
      maxSize,
      maxFiles,
      multiple: true,
    });

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    const results: UploadResult[] = [];

    try {
      // First, call the original onFilesSelected callback
      onFilesSelected(selectedFiles);

      // If autoIndex is enabled, process files through RAG pipeline
      if (autoIndex) {
        for (const file of selectedFiles) {
          try {
            // Create FormData for file upload
            const formData = new FormData();
            formData.append("file", file);
            if (threadId) {
              formData.append("threadId", threadId);
            }

            // Upload file to server
            const uploadResponse = await fetch("/api/documents/upload", {
              method: "POST",
              body: formData,
            });

            if (!uploadResponse.ok) {
              throw new Error(`Upload failed: ${uploadResponse.statusText}`);
            }

            const uploadData = await uploadResponse.json();
            const filePath = uploadData.filePath;

            // Index the document
            const indexResponse = await fetch("/api/documents/index", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                filePath,
                fileName: file.name,
                threadId,
              }),
            });

            if (!indexResponse.ok) {
              throw new Error(`Indexing failed: ${indexResponse.statusText}`);
            }

            const indexData = await indexResponse.json();

            results.push({
              fileName: file.name,
              success: true,
              documentId: indexData.documentId,
              chunksProcessed: indexData.chunksProcessed,
            });
          } catch (error) {
            console.error(`Failed to process file ${file.name}:`, error);
            results.push({
              fileName: file.name,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      }

      setUploadResults(results);
      onUploadComplete?.(results);
      setSelectedFiles([]);
    } catch (error) {
      console.error("Upload process failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-blue-600 dark:text-blue-400">
            Drop the files here...
          </p>
        ) : (
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Drag & drop files here, or click to select files
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              PDF, DOCX, TXT, MD, HTML, CSV, Images up to{" "}
              {formatFileSize(maxSize)}
            </p>
          </div>
        )}
      </div>

      {/* File Rejections */}
      {fileRejections.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
            Some files were rejected:
          </h4>
          <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
            {fileRejections.map(({ file, errors }) => (
              <li key={file.name}>
                <strong>{file.name}</strong>:
                {errors.map((error) => (
                  <span key={error.code} className="ml-2">
                    {error.message}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Selected Files ({selectedFiles.length})
          </h4>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <File className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => removeFile(index)}
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full sm:w-auto"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                `${autoIndex ? "Upload & Index" : "Upload"} ${
                  selectedFiles.length
                } file${selectedFiles.length !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Upload Results
          </h4>
          <div className="space-y-2">
            {uploadResults.map((result, index) => (
              <div
                key={`result-${index}`}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  result.success
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <File
                    className={`h-5 w-5 ${
                      result.success ? "text-green-600" : "text-red-600"
                    }`}
                  />
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        result.success
                          ? "text-green-900 dark:text-green-100"
                          : "text-red-900 dark:text-red-100"
                      }`}
                    >
                      {result.fileName}
                    </p>
                    <p
                      className={`text-xs ${
                        result.success
                          ? "text-green-700 dark:text-green-300"
                          : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      {result.success
                        ? `✓ Indexed ${result.chunksProcessed} chunks`
                        : `✗ ${result.error}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FileUploadDropzone;

'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number;
  acceptedTypes?: string[];
}

export function FileUploadDropzone({
  onFilesSelected,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB
  acceptedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown'
  ]
}: FileUploadDropzoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(prev => [...prev, ...acceptedFiles].slice(0, maxFiles));
  }, [maxFiles]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize,
    maxFiles,
    multiple: true
  });

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
      setSelectedFiles([]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
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
              PDF, DOCX, DOC, TXT, MD files up to {formatFileSize(maxSize)}
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
                {errors.map(error => (
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
            <Button onClick={handleUpload} className="w-full sm:w-auto">
              Upload {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileUploadDropzone;

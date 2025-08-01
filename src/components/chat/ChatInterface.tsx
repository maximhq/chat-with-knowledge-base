"use client";

import React, { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useThreadStore,
  useMessageStore,
  useThreadMessages,
  useIsStreamingForThread,
} from "@/stores";

interface ChatInterfaceProps {
  threadId: string | null;
  onThreadSelect: (threadId: string) => void;
}

export function ChatInterface({
  threadId,
  onThreadSelect,
}: ChatInterfaceProps) {
  const messages = useThreadMessages(threadId);
  const isStreaming = useIsStreamingForThread(threadId);
  const createThread = useThreadStore((state) => state.createThread);
  const sendMessage = useMessageStore((state) => state.sendMessage);
  const fetchMessages = useMessageStore((state) => state.fetchMessages);
  const isLoading = useMessageStore((state) => state.isLoading);

  const [inputValue, setInputValue] = React.useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (threadId) {
      fetchMessages(threadId);
    }
  }, [threadId, fetchMessages]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleNewThread = async () => {
    const newThread = await createThread("New Chat");
    if (newThread) {
      onThreadSelect(newThread.id);
      // Focus on the textarea after creating new thread
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return;

    const messageContent = inputValue.trim();
    setInputValue("");

    // If no thread is selected, create a new one
    let currentThreadId = threadId;
    if (!currentThreadId) {
      const newThread = await createThread("New Chat");
      if (newThread) {
        currentThreadId = newThread.id;
        onThreadSelect(currentThreadId);
      } else {
        toast.error("Failed to create new chat");
        return;
      }
    }

    // Send message using store
    await sendMessage(currentThreadId, messageContent);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageContent = (content: string) => {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(
        /`(.*?)`/g,
        '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>'
      )
      .replace(/\n/g, "<br>");
  };

  if (!threadId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="max-w-md">
          <Bot className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Welcome to your Knowledge Base Chat
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Start a new conversation or select an existing thread from the
            sidebar to begin chatting with your AI assistant.
          </p>
          <Button onClick={() => handleNewThread()}>Start New Chat</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${
                  message.role === "USER" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "ASSISTANT" && (
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-3xl rounded-lg px-4 py-2 ${
                    message.role === "USER"
                      ? "bg-blue-500 text-white ml-12"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white mr-12"
                  }`}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: formatMessageContent(message.content),
                    }}
                  />
                  {message.role === "ASSISTANT" &&
                    isStreaming &&
                    message.content === "" && (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    )}
                </div>

                {message.role === "USER" && (
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                className="min-h-[44px] max-h-32 resize-none pr-12"
                disabled={isLoading || isStreaming}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading || isStreaming}
                size="sm"
                className="absolute right-2 bottom-2 h-8 w-8 p-0"
              >
                {isLoading || isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;

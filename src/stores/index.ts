// Thread management
export {
  useThreadStore,
  useSelectedThread,
  useThreadsCount,
} from "./threadStore";

// Message management
export {
  useMessageStore,
  useThreadMessages,
  useIsStreamingForThread,
} from "./messageStore";

// UI state management
export {
  useUIStore,
  useActiveTab,
  useSidebarCollapsed,
  useTheme,
} from "./uiStore";

// Re-export store hooks for convenience
export * from "./threadStore";
export * from "./messageStore";
export * from "./uiStore";

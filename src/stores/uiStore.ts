import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type ActiveTab = "messages" | "knowledge-base";

interface UIState {
  // State
  activeTab: ActiveTab;
  sidebarCollapsed: boolean;
  theme: "light" | "dark" | "system";

  // Actions
  setActiveTab: (tab: ActiveTab) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      immer((set) => ({
        // Initial state
        activeTab: "messages",
        sidebarCollapsed: false,
        theme: "system",

        // Actions
        setActiveTab: (tab) =>
          set((state) => {
            state.activeTab = tab;
          }),

        toggleSidebar: () =>
          set((state) => {
            state.sidebarCollapsed = !state.sidebarCollapsed;
          }),

        setSidebarCollapsed: (collapsed) =>
          set((state) => {
            state.sidebarCollapsed = collapsed;
          }),

        setTheme: (theme) =>
          set((state) => {
            state.theme = theme;
          }),
      })),
      {
        name: "ui-store",
        partialize: (state) => ({
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
        }),
      },
    ),
    { name: "ui-store" },
  ),
);

// Selectors
export const useActiveTab = () => useUIStore((state) => state.activeTab);
export const useSidebarCollapsed = () =>
  useUIStore((state) => state.sidebarCollapsed);
export const useTheme = () => useUIStore((state) => state.theme);

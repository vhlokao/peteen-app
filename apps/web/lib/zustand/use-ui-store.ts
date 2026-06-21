"use client";

import { create } from "zustand";

type UiState = {
  isMobileNavOpen: boolean;
  isSidebarCollapsed: boolean;
  setMobileNavOpen: (open: boolean) => void;
  toggleMobileNav: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  isMobileNavOpen: false,
  isSidebarCollapsed: false,
  setMobileNavOpen: (open) => set({ isMobileNavOpen: open }),
  toggleMobileNav: () =>
    set((state) => ({ isMobileNavOpen: !state.isMobileNavOpen })),
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
}));

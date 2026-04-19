import { create } from 'zustand';

export type StatusFilter = 'all' | 'caught';
export type SortBy = 'date_added' | 'weight';

type StoreState = {
  currentUser: any | null;
  setCurrentUser: (user: any | null) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (status: StatusFilter) => void;
  sortBy: SortBy;
  setSortBy: (sortBy: SortBy) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
};

export const useFishlogStore = create<StoreState>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  statusFilter: 'all',
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  sortBy: 'date_added',
  setSortBy: (sortBy) => set({ sortBy }),
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
